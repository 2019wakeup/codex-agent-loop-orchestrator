from __future__ import annotations

import shutil
from pathlib import Path

from .artifacts import ensure_artifact_dirs, read_json, write_json, write_text
from .codex_runner import CodexRunner, LocalDeterministicCodexRunner
from .git_adapter import GitAdapter
from .models import CallbackPayload, LoopContract, LoopState, LoopStatus
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
        write_fake_training_script(contract.repo_path)
        if not (contract.repo_path / "target_app.py").exists():
            (contract.repo_path / "target_app.py").write_text("SCORE = 0.50\n\n\ndef score():\n    return SCORE\n", encoding="utf-8")
        git.commit("initial target app")
        state = LoopState(loop_id=contract.loop_id, status=LoopStatus.READY)
        self.store.save_state(state)
        self.store.add_event(contract.loop_id, "loop.created", {"contract_path": str(contract.artifact_root / "contract.json")})
        write_json(contract.artifact_root / "state.json", state)
        return state

    def load_contract(self, loop_id: str, repo_path: Path) -> LoopContract:
        return LoopContract.model_validate(read_json(repo_path / ".codex" / "agent-loop" / loop_id / "contract.json"))

    def run_until_done(self, contract: LoopContract) -> LoopState:
        state = self.store.load_state(contract.loop_id)
        while state.status not in {LoopStatus.COMPLETED, LoopStatus.FAILED, LoopStatus.CANCELLED, LoopStatus.PAUSED, LoopStatus.REVIEW_REQUIRED}:
            state = self.run_one_turn(contract, state)
        return state

    def run_one_turn(self, contract: LoopContract, state: LoopState | None = None) -> LoopState:
        state = state or self.store.load_state(contract.loop_id)
        state.turn += 1
        turn_id = f"turn_{state.turn:04d}"
        evidence = self._build_evidence(contract, state, turn_id)

        state.status = LoopStatus.PLANNING
        self._save(contract, state, "codex.planner.started", {"turn_id": turn_id})
        plan = self.runner.planner(contract.artifact_root, turn_id, evidence)
        self.store.add_event(contract.loop_id, "codex.planner.completed", {"turn_id": turn_id})

        state.status = LoopStatus.CODEX_RUNNING
        self._save(contract, state, "codex.worker.started", {"turn_id": turn_id})
        worker = self.runner.worker(contract.repo_path, contract.artifact_root, plan)
        self.store.add_event(contract.loop_id, "codex.worker.completed", worker.model_dump(mode="json"))

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
        self.store.add_event(contract.loop_id, "codex.judge.completed", judge.model_dump(mode="json"))

        state.status = LoopStatus.POLICY_CHECKING
        first_policy = self.policy.evaluate_after_judge(contract, state, judge)
        self.store.add_event(contract.loop_id, "policy.checked", first_policy.model_dump(mode="json"))
        if not validation_passed or not first_policy.should_commit:
            state.status = first_policy.next_status
            state.last_decision = first_policy.decision
            self._save(contract, state, "loop.turn.finished", {"turn_id": turn_id})
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
        self._save(contract, state, "run.started", {"turn_id": turn_id, "run_id": run_id})
        callback = self.task_runner.run_training_sync(contract, turn_id, run_id)
        return self.handle_callback(contract, callback)

    def handle_callback(self, contract: LoopContract, callback: CallbackPayload) -> LoopState:
        state = self.store.load_state(contract.loop_id)
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
        self.store.add_event(contract.loop_id, "run.completed", callback.model_dump(mode="json"))
        self.store.add_event(contract.loop_id, "policy.checked", policy.model_dump(mode="json"))
        if state.status == LoopStatus.COMPLETED:
            self._write_final_report(contract, state, policy.reason)
        self._save(contract, state, "loop.callback.handled", {"turn_id": turn_id, "decision": policy.decision})
        return state

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
        }
        write_json(contract.artifact_root / "evidence" / f"{turn_id}.json", evidence)
        return evidence

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
        self.store.save_state(state)
        write_json(contract.artifact_root / "state.json", state)
        self.store.add_event(contract.loop_id, event_type, payload)


def copy_prd(project_root: Path, source: Path | None = None) -> None:
    source = source or Path("/root/autodl-tmp/projects/Codex_Agent_Loop_Orchestrator_PRD_v2.md")
    if source.exists():
        shutil.copy2(source, project_root / "docs" / "PRD.md")
