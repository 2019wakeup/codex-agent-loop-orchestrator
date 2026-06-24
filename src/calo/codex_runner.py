from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Protocol

from .artifacts import write_json, write_text
from .models import JudgeReport, Plan, PlannerTask, WorkerSummary


class CodexRunner(Protocol):
    def planner(self, artifact_root: Path, turn_id: str, evidence: dict[str, Any]) -> Plan: ...
    def worker(self, repo_path: Path, artifact_root: Path, plan: Plan) -> WorkerSummary: ...
    def judge(self, artifact_root: Path, turn_id: str, evidence: dict[str, Any]) -> JudgeReport: ...


class LocalDeterministicCodexRunner:
    """Deterministic stand-in for Codex SDK turns.

    The interface is intentionally role-based so a real SDK adapter can replace
    this class without changing the loop controller.
    """

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
