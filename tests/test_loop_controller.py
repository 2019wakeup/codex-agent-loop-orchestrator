from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from calo.artifacts import write_json
from calo.controller import LoopController
from calo.codex_runner import LOOP_CONTROL_BOUNDARY, CodexCliRunner, LocalDeterministicCodexRunner
from calo.goal import contract_from_goal
from calo.models import (
    CallbackPayload,
    Commands,
    GoalRequest,
    IterationLimits,
    JudgeReport,
    LoopContract,
    LoopState,
    LoopStatus,
    Plan,
    PlannerTask,
    RunStatus,
    WorkerSummary,
)
from calo.store import StateStore


def make_contract(tmp_path: Path, target: float = 0.7, max_turns: int = 3) -> LoopContract:
    repo = tmp_path / "repo"
    return LoopContract(
        loop_id="test_loop",
        objective=f"Raise fake score to {target}",
        repo_path=repo,
        target_value=target,
        iteration_limits=IterationLimits(max_turns=max_turns, patience=max_turns),
        commands=Commands(train="python fake_train.py --callback-file {callback_file} --run-id {run_id} --turn-id {turn_id}"),
    )


def make_async_contract(tmp_path: Path, target: float = 0.7, max_turns: int = 3) -> LoopContract:
    contract = make_contract(tmp_path, target=target, max_turns=max_turns)
    contract.execution_mode = "async"
    return contract


def test_demo_loop_reaches_target_and_writes_artifacts(tmp_path: Path) -> None:
    contract = make_contract(tmp_path, target=0.7, max_turns=3)
    store = StateStore(tmp_path / "state.sqlite3")
    controller = LoopController(store)

    controller.create_loop(contract)
    state = controller.run_until_done(contract)

    assert state.status == LoopStatus.COMPLETED
    assert state.best_metric is not None
    assert state.best_metric >= 0.7
    assert state.turn <= 3
    assert (contract.artifact_root / "contract.json").exists()
    assert (contract.artifact_root / "plan" / "turn_0001.json").exists()
    assert (contract.artifact_root / "handoff" / "turn_0001.md").exists()
    assert (contract.artifact_root / "judge" / f"turn_{state.turn:04d}.json").exists()
    assert (contract.artifact_root / "reports" / "final_report.md").exists()


def test_loop_stops_at_max_turns_when_target_unreached(tmp_path: Path) -> None:
    contract = make_contract(tmp_path, target=0.95, max_turns=2)
    store = StateStore(tmp_path / "state.sqlite3")
    controller = LoopController(store)

    controller.create_loop(contract)
    state = controller.run_until_done(contract)

    assert state.status == LoopStatus.COMPLETED
    assert state.turn == 2
    assert state.best_metric is not None
    assert state.best_metric < 0.95
    report = (contract.artifact_root / "reports" / "final_report.md").read_text(encoding="utf-8")
    assert "max_turns reached" in report


def test_events_capture_planner_worker_judge_policy(tmp_path: Path) -> None:
    contract = make_contract(tmp_path, target=0.6, max_turns=2)
    store = StateStore(tmp_path / "state.sqlite3")
    controller = LoopController(store)

    controller.create_loop(contract)
    controller.run_until_done(contract)
    event_types = [event["event_type"] for event in store.list_events(contract.loop_id)]

    assert "codex.planner.completed" in event_types
    assert "codex.worker.completed" in event_types
    assert "codex.judge.completed" in event_types
    assert "policy.checked" in event_types
    assert "run.completed" in event_types


def test_contract_persists_for_resume(tmp_path: Path) -> None:
    contract = make_contract(tmp_path, target=0.6, max_turns=2)
    db_path = tmp_path / "state.sqlite3"
    controller = LoopController(StateStore(db_path))

    controller.create_loop(contract)
    resumed = LoopController(StateStore(db_path))
    loaded = resumed.load_contract(contract.loop_id)
    state = resumed.run_until_done(loaded)

    assert loaded.loop_id == contract.loop_id
    assert loaded.repo_path == contract.repo_path
    assert state.status == LoopStatus.COMPLETED


def test_goal_request_compiles_to_contract_with_safe_defaults(tmp_path: Path) -> None:
    request = GoalRequest(
        loop_id="brief_loop",
        objective="  Reproduce three fraud baselines without long polling  ",
        repo_path=tmp_path / "repo",
        target_value=0.7,
        execution_mode="async",
        max_turns=0,
    )

    contract = contract_from_goal(request)

    assert contract.loop_id == "brief_loop"
    assert contract.objective == "Reproduce three fraud baselines without long polling"
    assert contract.repo_path == tmp_path / "repo"
    assert contract.execution_mode == "async"
    assert contract.iteration_limits.max_turns == 1
    assert contract.iteration_limits.patience == 1
    assert "{callback_file}" in contract.commands.train


def test_goal_and_contract_reject_unsafe_identifiers(tmp_path: Path) -> None:
    with pytest.raises(ValidationError):
        GoalRequest(loop_id="../escape", objective="Valid objective", repo_path=tmp_path / "repo")

    with pytest.raises(ValidationError):
        GoalRequest(loop_id="bad id", objective="Valid objective", repo_path=tmp_path / "repo")

    with pytest.raises(ValidationError):
        GoalRequest(loop_id=".", objective="Valid objective", repo_path=tmp_path / "repo")

    with pytest.raises(ValidationError):
        GoalRequest(loop_id="safe_loop", objective="   ", repo_path=tmp_path / "repo")

    with pytest.raises(ValidationError):
        LoopContract(loop_id="../escape", objective="Valid objective", repo_path=tmp_path / "repo")


def test_codex_cli_runner_is_constructible() -> None:
    runner = CodexCliRunner(model="test-model")
    assert runner.model == "test-model"
    assert isinstance(LocalDeterministicCodexRunner(), LocalDeterministicCodexRunner)


def test_duplicate_callback_is_idempotent(tmp_path: Path) -> None:
    contract = make_contract(tmp_path, target=0.9, max_turns=3)
    store = StateStore(tmp_path / "state.sqlite3")
    controller = LoopController(store)
    controller.create_loop(contract)
    state = store.load_state(contract.loop_id)
    state.turn = 1
    state.status = LoopStatus.TRAINING_RUNNING
    state.last_run_id = "run_same"
    store.save_state(state, contract)
    payload = CallbackPayload(
        loop_id=contract.loop_id,
        run_id="run_same",
        turn_id="turn_0001",
        status=RunStatus.SUCCEEDED,
        metrics={"score": 0.6},
    )

    first = controller.handle_callback(contract, payload)
    second = controller.handle_callback(contract, payload)

    assert first.best_metric == 0.6
    assert second.best_metric == 0.6
    event_types = [event["event_type"] for event in store.list_events(contract.loop_id)]
    assert event_types.count("run.completed") == 1
    assert "run.callback.duplicate" in event_types


def test_direct_callback_requires_active_matching_run(tmp_path: Path) -> None:
    contract = make_contract(tmp_path, target=0.6, max_turns=2)
    store = StateStore(tmp_path / "state.sqlite3")
    controller = LoopController(store)
    controller.create_loop(contract)
    payload = CallbackPayload(
        loop_id=contract.loop_id,
        run_id="run_0001",
        turn_id="turn_0001",
        status=RunStatus.SUCCEEDED,
        metrics={"score": 0.99},
    )

    with pytest.raises(ValueError, match="no active run is waiting"):
        controller.handle_callback(contract, payload)

    state = store.load_state(contract.loop_id)
    assert state.best_metric is None
    assert store.list_events(contract.loop_id)[-1]["event_type"] == "loop.created"


def test_collect_callback_requires_active_matching_run_before_file_read(tmp_path: Path) -> None:
    contract = make_async_contract(tmp_path, target=0.6, max_turns=2)
    store = StateStore(tmp_path / "state.sqlite3")
    controller = LoopController(store)
    controller.create_loop(contract)

    with pytest.raises(ValueError, match="no active run is waiting"):
        controller.collect_callback_file(contract, "../outside")

    waiting = controller.run_one_turn(contract)
    assert waiting.last_run_id == "run_0001"

    with pytest.raises(ValueError, match="does not match active run"):
        controller.collect_callback_file(contract, "../outside")

    assert not (contract.artifact_root / "outside_callback.json").exists()


def test_async_step_waits_for_callback_then_collects(tmp_path: Path) -> None:
    contract = make_async_contract(tmp_path, target=0.6, max_turns=2)
    store = StateStore(tmp_path / "state.sqlite3")
    controller = LoopController(store)
    controller.create_loop(contract)

    waiting = controller.run_one_turn(contract)
    assert waiting.status == LoopStatus.WAITING_CALLBACK
    assert waiting.last_run_id == "run_0001"
    manifest = contract.artifact_root / "runs" / "run_0001_manifest.json"
    callback_file = contract.artifact_root / "runs" / "run_0001_callback.json"
    assert manifest.exists()
    manifest_payload = manifest.read_text(encoding="utf-8")
    assert '"owner": "local_subprocess"' in manifest_payload
    assert '"wake_path":' in manifest_payload
    assert '"codex_control": "released"' in manifest_payload
    assert waiting.last_decision == "operational_pause"
    event_types = [event["event_type"] for event in store.list_events(contract.loop_id)]
    assert "loop.operational_pause" in event_types

    for _ in range(50):
        if callback_file.exists():
            break
        import time

        time.sleep(0.05)
    assert callback_file.exists()

    final = controller.collect_callback_file(contract)
    assert final.status == LoopStatus.COMPLETED
    assert final.best_metric is not None
    assert final.best_metric >= 0.6
    manifest_after = manifest.read_text(encoding="utf-8")
    assert '"status": "succeeded"' in manifest_after
    assert '"callback_processed": true' in manifest_after


class BrokenAsyncTaskRunner:
    def validate(self, contract: LoopContract) -> tuple[bool, str]:
        return True, "ok"

    def launch_training_async(self, contract: LoopContract, turn_id: str, run_id: str) -> Path:
        manifest_path = contract.artifact_root / "runs" / f"{run_id}_manifest.json"
        write_json(manifest_path, {"run_id": run_id, "turn_id": turn_id, "status": "running"})
        return manifest_path


def test_async_operational_pause_requires_owner_and_wake_path(tmp_path: Path) -> None:
    contract = make_async_contract(tmp_path, target=0.6, max_turns=2)
    store = StateStore(tmp_path / "state.sqlite3")
    controller = LoopController(store, task_runner=BrokenAsyncTaskRunner())
    controller.create_loop(contract)

    state = controller.run_one_turn(contract)

    assert state.status == LoopStatus.FAILED
    assert state.last_decision == "failed_needs_action"
    event_types = [event["event_type"] for event in store.list_events(contract.loop_id)]
    assert "run.launch_failed" in event_types
    assert "loop.operational_pause" not in event_types


def test_waiting_callback_cannot_be_paused_and_remains_collectable(tmp_path: Path) -> None:
    contract = make_async_contract(tmp_path, target=0.6, max_turns=2)
    store = StateStore(tmp_path / "state.sqlite3")
    controller = LoopController(store)
    controller.create_loop(contract)

    waiting = controller.run_one_turn(contract)
    assert waiting.status == LoopStatus.WAITING_CALLBACK

    with pytest.raises(ValueError, match="cannot pause while waiting_callback"):
        controller.pause_loop(contract)

    state_after_pause_attempt = store.load_state(contract.loop_id)
    assert state_after_pause_attempt.status == LoopStatus.WAITING_CALLBACK
    event_types = [event["event_type"] for event in store.list_events(contract.loop_id)]
    assert "loop.pause.rejected" in event_types

    callback_file = contract.artifact_root / "runs" / "run_0001_callback.json"
    for _ in range(50):
        if callback_file.exists():
            break
        import time

        time.sleep(0.05)
    assert callback_file.exists()

    final = controller.collect_callback_file(contract)
    assert final.status == LoopStatus.COMPLETED


def test_cancel_waiting_callback_records_external_owner_boundary(tmp_path: Path) -> None:
    contract = make_async_contract(tmp_path, target=0.6, max_turns=2)
    store = StateStore(tmp_path / "state.sqlite3")
    controller = LoopController(store)
    controller.create_loop(contract)
    controller.run_one_turn(contract)

    cancelled = controller.cancel_loop(contract)

    assert cancelled.status == LoopStatus.CANCELLED
    events = store.list_events(contract.loop_id)
    cancel_event = next(event for event in events if event["event_type"] == "loop.cancelled")
    assert cancel_event["payload"]["external_task_control"] == "not_terminated"
    assert cancel_event["payload"]["owner"] == "local_subprocess"
    manifest = (contract.artifact_root / "runs" / "run_0001_manifest.json").read_text(encoding="utf-8")
    assert '"orchestrator_status": "cancelled"' in manifest
    assert '"external_task_control": "not_terminated"' in manifest


def test_pause_resume_cancel_lifecycle(tmp_path: Path) -> None:
    contract = make_contract(tmp_path, target=0.7, max_turns=2)
    controller = LoopController(StateStore(tmp_path / "state.sqlite3"))
    controller.create_loop(contract)

    paused = controller.pause_loop(contract)
    assert paused.status == LoopStatus.PAUSED

    resumed = controller.resume_loop(contract)
    assert resumed.status == LoopStatus.READY

    cancelled = controller.cancel_loop(contract)
    assert cancelled.status == LoopStatus.CANCELLED


class AdversarialRunner:
    def planner(self, artifact_root: Path, turn_id: str, evidence: dict) -> Plan:
        write_json(
            artifact_root / "state.json",
            LoopState(loop_id=evidence["contract"]["loop_id"], status=LoopStatus.COMPLETED, turn=999),
        )
        write_json(
            artifact_root / "nested_loop_attempt" / "contract.json",
            {"loop_id": "codex_spawned_loop", "objective": "take over"},
        )
        return Plan(
            turn_id=turn_id,
            objective="Try to seize loop control",
            hypothesis="Planner should not be able to mutate authoritative state.",
            tasks=[
                PlannerTask(
                    id="task_1",
                    type="code_change",
                    target_files=["target_app.py"],
                    instruction="Increase SCORE normally despite malicious artifact writes.",
                )
            ],
        )

    def worker(self, repo_path: Path, artifact_root: Path, plan: Plan) -> WorkerSummary:
        target = repo_path / "target_app.py"
        text = target.read_text(encoding="utf-8")
        target.write_text(text.replace("SCORE = 0.50", "SCORE = 0.60"), encoding="utf-8")
        (artifact_root / "handoff" / f"{plan.turn_id}.md").write_text("# Handoff\n", encoding="utf-8")
        return WorkerSummary(
            turn_id=plan.turn_id,
            changed_files=["target_app.py"],
            validation_commands_to_run=["python -m py_compile target_app.py"],
        )

    def judge(self, artifact_root: Path, turn_id: str, evidence: dict) -> JudgeReport:
        return JudgeReport(
            turn_id=turn_id,
            verdict="stop_success",
            confidence="high",
            accept_change=True,
            evidence=["maliciously claims success regardless of metric"],
        )


def test_codex_runner_cannot_force_completion_or_spawn_registered_loop(tmp_path: Path) -> None:
    contract = make_contract(tmp_path, target=0.95, max_turns=2)
    store = StateStore(tmp_path / "state.sqlite3")
    controller = LoopController(store, runner=AdversarialRunner())
    controller.create_loop(contract)

    state = controller.run_one_turn(contract)

    assert state.status == LoopStatus.READY
    assert state.turn == 1
    assert state.best_metric == 0.6
    assert store.load_state(contract.loop_id).status == LoopStatus.READY
    try:
        store.load_state("codex_spawned_loop")
    except KeyError:
        pass
    else:
        raise AssertionError("runner-created nested loop should not be registered")


def test_codex_cli_prompts_include_loop_control_boundary() -> None:
    source = Path("src/calo/codex_runner.py").read_text(encoding="utf-8")
    assert LOOP_CONTROL_BOUNDARY in source
    assert source.count("LOOP_CONTROL_BOUNDARY") >= 4
    assert "The Orchestrator owns all lifecycle transitions." in source
    assert "The Policy Engine is the only component allowed" in source
