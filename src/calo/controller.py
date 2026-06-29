from __future__ import annotations

import os
import signal
import shutil
from pathlib import Path

from .artifacts import ensure_artifact_dirs, read_json, write_json, write_text
from .codex_runner import CodexRunner, LocalDeterministicCodexRunner
from .git_adapter import GitAdapter
from .models import (
    CallbackPayload,
    Decision,
    LoopContract,
    LoopState,
    LoopStatus,
    OperatorGuidance,
    OperatorGuidanceRequest,
    TaskGraph,
    TaskNode,
    TaskRunRecord,
    TaskStatus,
    utc_now,
)
from .policy import PolicyEngine
from .store import StateStore
from .task_runner import TaskRunner, write_fake_training_script


class LoopController:
    def __init__(
        self,
        store: StateStore,
        runner: CodexRunner | None = None,
        task_runner: TaskRunner | None = None,
        policy: PolicyEngine | None = None,
    ):
        self.store = store
        self.runner = runner or LocalDeterministicCodexRunner()
        self.task_runner = task_runner or TaskRunner()
        self.policy = policy or PolicyEngine()

    def create_loop(self, contract: LoopContract) -> LoopState:
        contract.repo_path.mkdir(parents=True, exist_ok=True)
        ensure_artifact_dirs(contract.artifact_root)
        write_json(contract.artifact_root / "contract.json", contract)
        git = GitAdapter(contract.repo_path)
        git.ensure_repo()
        if contract.task_adapter_mode == "demo":
            write_fake_training_script(contract.repo_path)
            if not (contract.repo_path / "target_app.py").exists():
                (contract.repo_path / "target_app.py").write_text("SCORE = 0.50\n\n\ndef score():\n    return SCORE\n", encoding="utf-8")
            git.commit("initial target app")
        state = LoopState(loop_id=contract.loop_id, status=LoopStatus.READY)
        self.store.save_state(state, contract)
        self.store.add_event(
            contract.loop_id,
            "loop.created",
            {
                "contract_path": str(contract.artifact_root / "contract.json"),
                "runner_kind": contract.runner_kind,
                "runner_model": contract.runner_model,
                "task_adapter_mode": contract.task_adapter_mode,
            },
        )
        write_json(contract.artifact_root / "state.json", state)
        return state

    def load_contract(self, loop_id: str) -> LoopContract:
        return self.store.load_contract(loop_id)

    def run_until_done(self, contract: LoopContract) -> LoopState:
        state = self.store.load_state(contract.loop_id)
        stop_statuses = {
            LoopStatus.COMPLETED,
            LoopStatus.FAILED,
            LoopStatus.CANCELLED,
            LoopStatus.PAUSED,
            LoopStatus.REVIEW_REQUIRED,
            LoopStatus.NEEDS_SETUP,
            LoopStatus.WAITING_CALLBACK,
        }
        while state.status not in stop_statuses:
            state = self.run_one_turn(contract, state)
        return state

    def run_one_turn(self, contract: LoopContract, state: LoopState | None = None) -> LoopState:
        state = state or self.store.load_state(contract.loop_id)
        if state.status != LoopStatus.READY:
            raise ValueError(f"cannot run a turn while loop status is {state.status}")
        state.turn += 1
        turn_id = f"turn_{state.turn:04d}"
        evidence = self._build_evidence(contract, state, turn_id)
        runner_meta = self._runner_metadata(contract)

        state.status = LoopStatus.PLANNING
        self._save(contract, state, "codex.planner.started", {"turn_id": turn_id, **runner_meta})
        plan = self.runner.planner(contract.artifact_root, turn_id, evidence)
        graph = self._record_task_graph(contract, plan)
        self.store.add_event(
            contract.loop_id,
            "codex.planner.completed",
            {
                "turn_id": turn_id,
                "plan_path": str(contract.artifact_root / "plan" / f"{turn_id}.json"),
                "task_graph_path": graph.artifact_path,
                "last_message_path": str(contract.artifact_root / "plan" / f"{turn_id}_last_message.txt")
                if runner_meta["runner_kind"] == "codex-cli"
                else None,
                **runner_meta,
            },
        )

        state.status = LoopStatus.CODEX_RUNNING
        self._save(contract, state, "codex.worker.started", {"turn_id": turn_id, **runner_meta})
        worker = self.runner.worker(contract.repo_path, contract.artifact_root, plan)
        worker_payload = worker.model_dump(mode="json")
        worker_payload.update(
            {
                "last_message_path": str(contract.artifact_root / "worker" / f"{turn_id}_last_message.txt")
                if runner_meta["runner_kind"] == "codex-cli"
                else None,
                **runner_meta,
            }
        )
        self.store.add_event(contract.loop_id, "codex.worker.completed", worker_payload)

        state.status = LoopStatus.VALIDATION_RUNNING
        validation_passed, validation_output = self.task_runner.validate(contract)
        validation_path = contract.artifact_root / "evidence" / f"{turn_id}_validation.txt"
        write_text(validation_path, validation_output)
        self.store.add_event(contract.loop_id, "validation.completed", {"turn_id": turn_id, "passed": validation_passed})

        state.status = LoopStatus.JUDGING
        latest_metric = state.best_metric
        judge_evidence = self._build_evidence(
            contract,
            state,
            turn_id,
            validation_passed=validation_passed,
            latest_metric=latest_metric,
        )
        judge = self.runner.judge(contract.artifact_root, turn_id, judge_evidence)
        judge_payload = judge.model_dump(mode="json")
        judge_payload.update(
            {
                "last_message_path": str(contract.artifact_root / "judge" / f"{turn_id}_last_message.txt")
                if runner_meta["runner_kind"] == "codex-cli"
                else None,
                **runner_meta,
            }
        )
        self.store.add_event(contract.loop_id, "codex.judge.completed", judge_payload)

        state.status = LoopStatus.POLICY_CHECKING
        first_policy = self.policy.evaluate_after_judge(contract, state, judge)
        self.store.add_event(contract.loop_id, "policy.checked", first_policy.model_dump(mode="json"))
        if not validation_passed or not first_policy.should_commit:
            state.status = first_policy.next_status
            state.last_decision = first_policy.decision
            self._save(contract, state, "loop.turn.finished", {"turn_id": turn_id})
            return state

        if contract.task_adapter_mode == "none":
            state.status = LoopStatus.NEEDS_SETUP
            state.last_decision = Decision.BLOCKED_NEEDS_USER
            self._save(
                contract,
                state,
                "task.adapter.required",
                {
                    "turn_id": turn_id,
                    "reason": "no TaskRun adapter is configured; long work was not launched and changes were not auto-committed",
                    "next_step": "choose a command adapter, demo adapter, or submit a manual callback integration before continuing",
                    "task_adapter_mode": contract.task_adapter_mode,
                    **runner_meta,
                },
            )
            return state

        git = GitAdapter(contract.repo_path)
        commit_sha = git.commit(f"agent-loop({contract.loop_id}): {turn_id} {plan.objective[:48]}")
        self.store.add_event(contract.loop_id, "git.commit.created", {"turn_id": turn_id, "sha": commit_sha})

        if not first_policy.should_launch_training:
            state.status = first_policy.next_status
            state.last_decision = first_policy.decision
            self._save(contract, state, "loop.turn.finished", {"turn_id": turn_id})
            return state

        state.status = LoopStatus.TRAINING_RUNNING
        run_id = f"run_{state.turn:04d}"
        state.last_run_id = run_id
        self.store.save_task_run(
            TaskRunRecord(
                loop_id=contract.loop_id,
                run_id=run_id,
                turn_id=turn_id,
                status=TaskStatus.RUNNING,
                external_task_control="owned",
            )
        )
        self._save(contract, state, "run.started", {"turn_id": turn_id, "run_id": run_id})
        if contract.execution_mode == "async":
            manifest_path = self.task_runner.launch_training_async(contract, turn_id, run_id)
            manifest = read_json(manifest_path)
            owner = manifest.get("owner")
            wake_path = manifest.get("wake_path") or manifest.get("callback_file")
            if not owner or not wake_path:
                state.status = LoopStatus.FAILED
                state.last_decision = Decision.FAILED_NEEDS_ACTION
                self._save(
                    contract,
                    state,
                    "run.launch_failed",
                    {
                        "turn_id": turn_id,
                        "run_id": run_id,
                        "reason": "async run manifest must include owner and wake_path before operational pause",
                        "manifest_path": str(manifest_path),
                    },
                )
                return state
            self.store.save_task_run(
                TaskRunRecord(
                    loop_id=contract.loop_id,
                    run_id=run_id,
                    turn_id=turn_id,
                    status=TaskStatus.RUNNING,
                    owner=owner,
                    command=manifest.get("command"),
                    pid=manifest.get("pid"),
                    wake_path=wake_path,
                    stdout_path=manifest.get("stdout_file"),
                    manifest_path=str(manifest_path),
                    external_task_control="released",
                )
            )
            state.status = LoopStatus.WAITING_CALLBACK
            state.last_decision = Decision.OPERATIONAL_PAUSE
            self._save(
                contract,
                state,
                "run.launched_async",
                {
                    "turn_id": turn_id,
                    "run_id": run_id,
                    "manifest_path": str(manifest_path),
                    "owner": owner,
                    "wake_path": wake_path,
                    "codex_control": manifest.get("codex_control", "released"),
                },
            )
            self.store.add_event(
                contract.loop_id,
                "loop.operational_pause",
                {
                    "turn_id": turn_id,
                    "run_id": run_id,
                    "owner": owner,
                    "wake_path": wake_path,
                    "codex_control": manifest.get("codex_control", "released"),
                    "reason": "external owner accepted long-running work; Codex turn is not monitoring",
                },
            )
            return state
        callback = self.task_runner.run_training_sync(contract, turn_id, run_id)
        return self.handle_callback(contract, callback)

    def collect_callback_file(self, contract: LoopContract, run_id: str | None = None) -> LoopState:
        state = self.store.load_state(contract.loop_id)
        target_run_id = run_id or state.last_run_id
        if target_run_id is None:
            raise ValueError("no run_id available for callback collection")
        if state.last_run_id is None:
            raise ValueError("no active run is waiting for a callback")
        if target_run_id != state.last_run_id:
            raise ValueError(f"callback run_id {target_run_id} does not match active run {state.last_run_id}")
        if state.status not in {LoopStatus.TRAINING_RUNNING, LoopStatus.WAITING_CALLBACK}:
            raise ValueError(f"cannot collect callback while loop status is {state.status}")
        callback = self.task_runner.read_callback_file(contract, target_run_id)
        if callback.loop_id != contract.loop_id:
            raise ValueError(f"callback loop_id {callback.loop_id} does not match {contract.loop_id}")
        if callback.run_id != target_run_id:
            raise ValueError(f"callback run_id {callback.run_id} does not match {target_run_id}")
        if state.last_run_id is not None and target_run_id == state.last_run_id and callback.turn_id != f"turn_{state.turn:04d}":
            raise ValueError(f"callback turn_id {callback.turn_id} does not match current turn {state.turn:04d}")
        return self.handle_callback(contract, callback)

    def pause_loop(self, contract: LoopContract) -> LoopState:
        state = self.store.load_state(contract.loop_id)
        if state.status == LoopStatus.WAITING_CALLBACK:
            self.store.add_event(
                contract.loop_id,
                "loop.pause.rejected",
                {
                    "run_id": state.last_run_id,
                    "reason": "loop is already in operational pause; collect the callback or cancel orchestration instead",
                },
            )
            raise ValueError("cannot pause while waiting_callback; Codex control is already released")
        state.status = LoopStatus.PAUSED
        self._save(contract, state, "loop.paused", {})
        return state

    def resume_loop(self, contract: LoopContract) -> LoopState:
        state = self.store.load_state(contract.loop_id)
        if state.status == LoopStatus.PAUSED:
            state.status = LoopStatus.READY
            self._save(contract, state, "loop.resumed", {})
        return state

    def cancel_loop(self, contract: LoopContract) -> LoopState:
        state = self.store.load_state(contract.loop_id)
        payload: dict = {}
        if state.status in {LoopStatus.TRAINING_RUNNING, LoopStatus.WAITING_CALLBACK} and state.last_run_id:
            task_record = self.store.load_task_run(contract.loop_id, state.last_run_id)
            manifest_path = contract.artifact_root / "runs" / f"{state.last_run_id}_manifest.json"
            if manifest_path.exists():
                manifest = read_json(manifest_path)
                manifest.update(
                    {
                        "orchestrator_status": "cancelled",
                        "external_task_control": "not_terminated",
                        "cancelled_at": utc_now(),
                    }
                )
                write_json(manifest_path, manifest)
                payload = {
                    "run_id": state.last_run_id,
                    "owner": manifest.get("owner"),
                    "wake_path": manifest.get("wake_path") or manifest.get("callback_file"),
                    "external_task_control": "not_terminated",
                    "reason": "orchestrator cancelled; external TaskRun remains owned outside Codex",
                }
                if task_record is not None:
                    task_record.status = TaskStatus.CANCELLED
                    task_record.external_task_control = "not_terminated"
                    task_record.callback_processed = False
                    self.store.save_task_run(task_record)
        state.status = LoopStatus.CANCELLED
        self._save(contract, state, "loop.cancelled", payload)
        return state

    def terminate_task_run(self, contract: LoopContract, run_id: str | None = None) -> TaskRunRecord:
        state = self.store.load_state(contract.loop_id)
        target_run_id = run_id or state.last_run_id
        if target_run_id is None:
            raise ValueError("no run_id available for termination")
        if state.last_run_id is not None and target_run_id != state.last_run_id:
            raise ValueError(f"run_id {target_run_id} does not match active run {state.last_run_id}")
        record = self.store.load_task_run(contract.loop_id, target_run_id)
        manifest_path = contract.artifact_root / "runs" / f"{target_run_id}_manifest.json"
        if record is None and not manifest_path.exists():
            raise ValueError(f"unknown TaskRun: {target_run_id}")
        manifest = read_json(manifest_path) if manifest_path.exists() else {}
        owner = manifest.get("owner") or (record.owner if record else None)
        pid = manifest.get("process_group_id") or manifest.get("pid") or (record.pid if record else None)
        if owner != "local_subprocess" or not pid:
            raise ValueError("only local_subprocess TaskRuns with a recorded pid can be terminated")
        control = "terminated"
        try:
            os.killpg(int(pid), signal.SIGTERM)
        except ProcessLookupError:
            control = "already_exited"
        manifest.update(
            {
                "status": "cancelled",
                "orchestrator_status": "cancelled",
                "external_task_control": control,
                "terminated_at": utc_now(),
            }
        )
        if manifest_path.exists():
            write_json(manifest_path, manifest)
        if record is None:
            record = TaskRunRecord(loop_id=contract.loop_id, run_id=target_run_id, turn_id=manifest.get("turn_id", f"turn_{state.turn:04d}"))
        record.status = TaskStatus.CANCELLED
        record.owner = owner
        record.pid = int(pid)
        record.manifest_path = str(manifest_path)
        record.external_task_control = control
        self.store.save_task_run(record)
        state.status = LoopStatus.CANCELLED
        self._save(
            contract,
            state,
            "run.termination.requested",
            {"run_id": target_run_id, "owner": owner, "pid": int(pid), "external_task_control": control},
        )
        return record

    def submit_operator_guidance(self, contract: LoopContract, request: OperatorGuidanceRequest) -> OperatorGuidance:
        state = self.store.load_state(contract.loop_id)
        previous_objective = contract.objective
        if request.revised_objective:
            contract.objective = request.revised_objective
        created_at = utc_now()
        safe_stamp = created_at.replace(":", "").replace("+", "Z")
        guidance_path = contract.artifact_root / "guidance" / f"{safe_stamp}.json"
        guidance = OperatorGuidance(
            loop_id=contract.loop_id,
            message=request.message,
            applies_to=request.applies_to,
            revised_objective=request.revised_objective,
            previous_objective=previous_objective if request.revised_objective else None,
            artifact_path=str(guidance_path),
            created_at=created_at,
        )
        write_json(guidance_path, guidance)
        write_text(
            guidance_path.with_suffix(".md"),
            (
                f"# Operator Guidance\n\n"
                f"Applies to: `{guidance.applies_to}`\n\n"
                f"Message:\n\n{guidance.message}\n\n"
                + (
                    f"Previous objective:\n\n{previous_objective}\n\n"
                    f"Revised objective:\n\n{request.revised_objective}\n"
                    if request.revised_objective
                    else ""
                )
            ),
        )
        if request.revised_objective:
            write_json(contract.artifact_root / "contract.json", contract)
        self.store.save_state(state, contract)
        self.store.add_event(contract.loop_id, "operator.guidance.submitted", guidance.model_dump(mode="json"))
        write_json(contract.artifact_root / "state.json", state)
        return guidance

    def handle_callback(self, contract: LoopContract, callback: CallbackPayload) -> LoopState:
        state = self.store.load_state(contract.loop_id)
        if self.store.has_callback(contract.loop_id, callback.run_id):
            self.store.add_event(contract.loop_id, "run.callback.duplicate", {"run_id": callback.run_id})
            return state
        self._validate_callback(contract, state, callback)
        if not self.store.claim_callback(contract.loop_id, callback.run_id, callback.model_dump(mode="json")):
            self.store.add_event(contract.loop_id, "run.callback.duplicate", {"run_id": callback.run_id})
            return self.store.load_state(contract.loop_id)
        self._mark_run_manifest_callback(contract, callback)
        metric = callback.metrics.get(contract.target_metric)
        if metric is not None:
            if state.best_metric is None or metric > state.best_metric + contract.iteration_limits.min_delta:
                state.best_metric = metric
                state.no_improvement_turns = 0
            else:
                state.no_improvement_turns += 1
        turn_id = callback.turn_id
        evidence = self._build_evidence(contract, state, turn_id, validation_passed=True, latest_metric=metric)
        judge = self.runner.judge(contract.artifact_root, turn_id, evidence)
        policy = self.policy.evaluate_after_judge(contract, state, judge, callback)
        state.status = policy.next_status if not policy.should_continue or policy.next_status == LoopStatus.COMPLETED else LoopStatus.READY
        state.last_decision = policy.decision
        self._mark_task_run_callback(contract, callback)
        self.store.add_event(contract.loop_id, "run.completed", callback.model_dump(mode="json"))
        self.store.add_event(contract.loop_id, "policy.checked", policy.model_dump(mode="json"))
        if state.status == LoopStatus.COMPLETED:
            self._write_final_report(contract, state, policy.reason)
        self._save(contract, state, "loop.callback.handled", {"turn_id": turn_id, "decision": policy.decision})
        return state

    def _record_task_graph(self, contract: LoopContract, plan) -> TaskGraph:
        graph_path = contract.artifact_root / "task_graph" / f"{plan.turn_id}.json"
        graph = TaskGraph(
            loop_id=contract.loop_id,
            turn_id=plan.turn_id,
            objective=plan.objective,
            nodes=[
                TaskNode(
                    id=task.id,
                    turn_id=plan.turn_id,
                    type=task.type,
                    target_files=task.target_files,
                    instruction=task.instruction,
                    status=TaskStatus.APPROVED,
                )
                for task in plan.tasks
            ],
            artifact_path=str(graph_path),
        )
        write_json(graph_path, graph)
        self.store.save_task_graph(graph)
        return graph

    def _mark_task_run_callback(self, contract: LoopContract, callback: CallbackPayload) -> None:
        record = self.store.load_task_run(contract.loop_id, callback.run_id)
        if record is None:
            record = TaskRunRecord(loop_id=contract.loop_id, run_id=callback.run_id, turn_id=callback.turn_id)
        status_map = {
            "succeeded": TaskStatus.SUCCEEDED,
            "failed": TaskStatus.FAILED,
            "cancelled": TaskStatus.CANCELLED,
            "timeout": TaskStatus.FAILED,
            "partial": TaskStatus.FAILED,
        }
        record.status = status_map.get(callback.status.value, TaskStatus.FAILED)
        record.callback_processed = True
        record.external_task_control = "released"
        self.store.save_task_run(record)

    def _validate_callback(self, contract: LoopContract, state: LoopState, callback: CallbackPayload) -> None:
        if callback.loop_id != contract.loop_id:
            raise ValueError(f"callback loop_id {callback.loop_id} does not match {contract.loop_id}")
        if state.last_run_id is None:
            raise ValueError("no active run is waiting for a callback")
        if callback.run_id != state.last_run_id:
            raise ValueError(f"callback run_id {callback.run_id} does not match active run {state.last_run_id}")
        expected_turn_id = f"turn_{state.turn:04d}"
        if callback.turn_id != expected_turn_id:
            raise ValueError(f"callback turn_id {callback.turn_id} does not match current turn {expected_turn_id}")
        allowed_statuses = {LoopStatus.TRAINING_RUNNING, LoopStatus.WAITING_CALLBACK}
        if state.status not in allowed_statuses:
            raise ValueError(f"cannot handle callback while loop status is {state.status}")

    def _mark_run_manifest_callback(self, contract: LoopContract, callback: CallbackPayload) -> None:
        manifest_path = contract.artifact_root / "runs" / f"{callback.run_id}_manifest.json"
        if not manifest_path.exists():
            return
        manifest = read_json(manifest_path)
        manifest.update(
            {
                "status": callback.status.value,
                "callback_processed": True,
                "completed_at": utc_now(),
                "metrics": callback.metrics,
                "summary": callback.summary,
                "error": callback.error,
            }
        )
        write_json(manifest_path, manifest)

    def _build_evidence(
        self,
        contract: LoopContract,
        state: LoopState,
        turn_id: str,
        validation_passed: bool | None = None,
        latest_metric: float | None = None,
    ) -> dict:
        git = GitAdapter(contract.repo_path)
        evidence = {
            "contract": contract.model_dump(mode="json"),
            "state": state.model_dump(mode="json"),
            "turn_id": turn_id,
            "latest_metric": latest_metric,
            "validation_passed": validation_passed,
            "git_status": git.status_short(),
            "git_diff_summary": git.diff_summary(),
            "operator_guidance": [item.model_dump(mode="json") for item in self.store.list_operator_guidance(contract.loop_id, limit=5)],
        }
        write_json(contract.artifact_root / "evidence" / f"{turn_id}.json", evidence)
        return evidence

    def _runner_metadata(self, contract: LoopContract) -> dict:
        runner_kind = getattr(self.runner, "runner_kind", contract.runner_kind)
        runner_label = getattr(self.runner, "runner_label", runner_kind)
        runner_is_simulated = bool(getattr(self.runner, "runner_is_simulated", runner_kind == "local"))
        return {
            "runner_kind": runner_kind,
            "runner_label": runner_label,
            "runner_model": contract.runner_model,
            "runner_is_simulated": runner_is_simulated,
        }

    def _write_final_report(self, contract: LoopContract, state: LoopState, reason: str) -> None:
        report = (
            f"# Final Report: {contract.loop_id}\n\n"
            f"Objective: {contract.objective}\n\n"
            f"Final status: {state.status}\n\n"
            f"Best {contract.target_metric}: {state.best_metric}\n\n"
            f"Stop reason: {reason}\n"
        )
        write_text(contract.artifact_root / "reports" / "final_report.md", report)

    def _save(self, contract: LoopContract, state: LoopState, event_type: str, payload: dict) -> None:
        self.store.save_state(state, contract)
        write_json(contract.artifact_root / "state.json", state)
        self.store.add_event(contract.loop_id, event_type, payload)


def copy_prd(project_root: Path, source: Path | None = None) -> None:
    source = source or Path("/root/autodl-tmp/projects/Codex_Agent_Loop_Orchestrator_PRD_v2.md")
    if source.exists():
        shutil.copy2(source, project_root / "docs" / "PRD.md")
