from __future__ import annotations

from pathlib import Path

from calo.controller import LoopController
from calo.models import Commands, IterationLimits, LoopContract, LoopStatus
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
