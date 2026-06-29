from __future__ import annotations

import re
import subprocess
from pathlib import Path
from typing import Any, Protocol

from .artifacts import read_json, write_json, write_text
from .models import JudgeReport, Plan, PlannerTask, WorkerSummary

LOOP_CONTROL_BOUNDARY = "Do not create, start, pause, resume, cancel, or recursively orchestrate loops."


class CodexRunner(Protocol):
    def planner(self, artifact_root: Path, turn_id: str, evidence: dict[str, Any]) -> Plan: ...
    def worker(self, repo_path: Path, artifact_root: Path, plan: Plan) -> WorkerSummary: ...
    def judge(self, artifact_root: Path, turn_id: str, evidence: dict[str, Any]) -> JudgeReport: ...


class LocalDeterministicCodexRunner:
    """Deterministic stand-in for Codex SDK turns.

    The interface is intentionally role-based so a real SDK adapter can replace
    this class without changing the loop controller.
    """

    runner_kind = "local"
    runner_label = "Local deterministic demo"
    runner_is_simulated = True

    def planner(self, artifact_root: Path, turn_id: str, evidence: dict[str, Any]) -> Plan:
        current_score = evidence.get("latest_metric")
        objective = evidence["contract"]["objective"]
        hypothesis = "No prior metric is available; create a measurable baseline improvement."
        if current_score is not None:
            hypothesis = f"Current score is {current_score:.3f}; apply a small deterministic improvement."
        plan = Plan(
            turn_id=turn_id,
            objective=objective,
            hypothesis=hypothesis,
            tasks=[
                PlannerTask(
                    id="task_1",
                    type="code_change",
                    target_files=["target_app.py"],
                    instruction="Increase the SCORE constant by a bounded increment.",
                )
            ],
            expected_impact={"metric": evidence["contract"]["target_metric"], "direction": "increase"},
        )
        write_json(artifact_root / "plan" / f"{turn_id}.json", plan)
        write_text(
            artifact_root / "plan" / f"{turn_id}.md",
            f"# Plan {turn_id}\n\n{plan.hypothesis}\n\n- Update `target_app.py` score constant.\n",
        )
        return plan

    def worker(self, repo_path: Path, artifact_root: Path, plan: Plan) -> WorkerSummary:
        target = repo_path / "target_app.py"
        if not target.exists():
            target.write_text("SCORE = 0.50\n\n\ndef score():\n    return SCORE\n", encoding="utf-8")
        text = target.read_text(encoding="utf-8")
        match = re.search(r"SCORE\s*=\s*([0-9.]+)", text)
        current = float(match.group(1)) if match else 0.5
        new_score = min(current + 0.1, 0.99)
        updated = re.sub(r"SCORE\s*=\s*[0-9.]+", f"SCORE = {new_score:.2f}", text)
        if updated == text:
            updated = f"SCORE = {new_score:.2f}\n\n\ndef score():\n    return SCORE\n"
        target.write_text(updated, encoding="utf-8")
        handoff = (
            f"# Handoff {plan.turn_id}\n\n"
            f"Objective: {plan.objective}\n\n"
            f"Changed `target_app.py` SCORE from {current:.2f} to {new_score:.2f}.\n"
        )
        write_text(artifact_root / "handoff" / f"{plan.turn_id}.md", handoff)
        summary = WorkerSummary(
            turn_id=plan.turn_id,
            changed_files=["target_app.py"],
            validation_commands_to_run=["python -m py_compile target_app.py"],
            risk_notes=["Deterministic MVP worker only edits a simple SCORE constant."],
            expected_metric_impact="score should increase by 0.1",
        )
        write_json(artifact_root / "worker" / f"{plan.turn_id}.json", summary)
        return summary

    def judge(self, artifact_root: Path, turn_id: str, evidence: dict[str, Any]) -> JudgeReport:
        metric = evidence.get("latest_metric")
        target = evidence["contract"]["target_value"]
        validation_passed = evidence.get("validation_passed", False)
        if metric is not None and metric >= target and validation_passed:
            verdict = "stop_success"
            next_step = "Finalize the loop."
        elif validation_passed:
            verdict = "continue_next_iteration"
            next_step = "Continue with another bounded score improvement."
        else:
            verdict = "needs_fix"
            next_step = "Fix validation failure before training."
        report = JudgeReport(
            turn_id=turn_id,
            verdict=verdict,
            confidence="high" if validation_passed else "medium",
            accept_change=validation_passed,
            evidence=[
                f"validation_passed={validation_passed}",
                f"latest_metric={metric}",
                f"target_value={target}",
            ],
            risks=[] if validation_passed else ["Validation failed."],
            next_step_recommendation=next_step,
        )
        write_json(artifact_root / "judge" / f"{turn_id}.json", report)
        write_text(
            artifact_root / "judge" / f"{turn_id}.md",
            f"# Judge {turn_id}\n\nVerdict: `{report.verdict}`\n\n{next_step}\n",
        )
        return report


class CodexCliRunner:
    """Codex CLI implementation of the role runner.

    It uses `codex exec` for short-lived Planner, Worker, and Judge turns. Each
    turn must write the same artifacts as the deterministic local runner.
    """

    runner_kind = "codex-cli"
    runner_label = "Codex CLI"
    runner_is_simulated = False

    def __init__(self, sandbox: str = "workspace-write", model: str | None = None, timeout_seconds: int = 1800):
        self.sandbox = sandbox
        self.model = model
        self.timeout_seconds = timeout_seconds

    def planner(self, artifact_root: Path, turn_id: str, evidence: dict[str, Any]) -> Plan:
        evidence_path = artifact_root / "evidence" / f"{turn_id}.json"
        plan_json = artifact_root / "plan" / f"{turn_id}.json"
        plan_md = artifact_root / "plan" / f"{turn_id}.md"
        prompt = f"""
You are the Planner role for Codex Agent Loop Orchestrator.

Read evidence from:
{evidence_path}

Write a JSON plan to:
{plan_json}

Write a concise Markdown plan to:
{plan_md}

The JSON must match this shape:
{{
  "turn_id": "{turn_id}",
  "objective": "...",
  "hypothesis": "...",
  "tasks": [
    {{"id": "task_1", "type": "code_change", "target_files": ["..."], "instruction": "..."}}
  ],
  "expected_impact": {{"metric": "...", "direction": "increase"}},
  "requires_human": false
}}

Do not edit source files. Do not start training.
{LOOP_CONTROL_BOUNDARY}
The Orchestrator owns all lifecycle transitions.
"""
        self._exec(artifact_root.parents[2], prompt, artifact_root / "plan" / f"{turn_id}_last_message.txt")
        return Plan.model_validate(read_json(plan_json))

    def worker(self, repo_path: Path, artifact_root: Path, plan: Plan) -> WorkerSummary:
        plan_path = artifact_root / "plan" / f"{plan.turn_id}.json"
        handoff_path = artifact_root / "handoff" / f"{plan.turn_id}.md"
        summary_path = artifact_root / "worker" / f"{plan.turn_id}.json"
        prompt = f"""
You are the Worker role for Codex Agent Loop Orchestrator.

Read the plan from:
{plan_path}

Apply the smallest necessary source changes in the repository.
Write handoff Markdown to:
{handoff_path}

Write worker summary JSON to:
{summary_path}

The worker summary JSON must include:
{{
  "turn_id": "{plan.turn_id}",
  "changed_files": ["..."],
  "validation_commands_to_run": ["..."],
  "risk_notes": [],
  "expected_metric_impact": "..."
}}

Do not run long training. Do not delete data or perform destructive recovery.
{LOOP_CONTROL_BOUNDARY}
Only modify repository files needed by the provided plan.
"""
        self._exec(repo_path, prompt, artifact_root / "worker" / f"{plan.turn_id}_last_message.txt")
        return WorkerSummary.model_validate(read_json(summary_path))

    def judge(self, artifact_root: Path, turn_id: str, evidence: dict[str, Any]) -> JudgeReport:
        evidence_path = artifact_root / "evidence" / f"{turn_id}.json"
        judge_json = artifact_root / "judge" / f"{turn_id}.json"
        judge_md = artifact_root / "judge" / f"{turn_id}.md"
        prompt = f"""
You are the Judge role for Codex Agent Loop Orchestrator.

Read evidence from:
{evidence_path}

Write judge JSON to:
{judge_json}

Write readable Markdown to:
{judge_md}

The JSON must match this shape:
{{
  "turn_id": "{turn_id}",
  "verdict": "accept_change|needs_fix|continue_next_iteration|stop_success|stop_no_progress|rollback_recommended|needs_human_review",
  "confidence": "low|medium|high",
  "accept_change": true,
  "rollback_recommended": false,
  "evidence": ["..."],
  "risks": [],
  "next_step_recommendation": "...",
  "requires_human": false
}}

Do not edit source files. Do not start training. Your verdict is advisory.
{LOOP_CONTROL_BOUNDARY}
The Policy Engine is the only component allowed to turn your verdict into a lifecycle transition.
"""
        self._exec(artifact_root.parents[2], prompt, artifact_root / "judge" / f"{turn_id}_last_message.txt")
        return JudgeReport.model_validate(read_json(judge_json))

    def _exec(self, cwd: Path, prompt: str, output_path: Path) -> None:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        cmd = [
            "codex",
            "exec",
            "--cd",
            str(cwd),
            "--sandbox",
            self.sandbox,
            "--output-last-message",
            str(output_path),
        ]
        if self.model:
            cmd.extend(["--model", self.model])
        cmd.append(prompt)
        result = subprocess.run(
            cmd,
            cwd=cwd,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=self.timeout_seconds,
        )
        if result.returncode != 0:
            raise RuntimeError(f"codex exec failed with code {result.returncode}:\n{result.stdout}")
