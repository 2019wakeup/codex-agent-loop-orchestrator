from __future__ import annotations

from pathlib import Path

from calo.controller import LoopController
from calo.codex_runner import CodexCliRunner, LocalDeterministicCodexRunner
from calo.models import CallbackPayload, Commands, IterationLimits, LoopContract, LoopStatus, RunStatus
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
