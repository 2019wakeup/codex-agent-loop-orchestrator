from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from calo.api import create_app
from calo.models import Commands, IterationLimits, LoopContract


def test_api_create_start_and_get_events(tmp_path: Path) -> None:
    app = create_app(tmp_path / "api.sqlite3")
    client = TestClient(app)
    contract = LoopContract(
        loop_id="api_loop",
        objective="Raise fake score",
        repo_path=tmp_path / "repo",
        target_value=0.6,
        iteration_limits=IterationLimits(max_turns=2, patience=2),
        commands=Commands(train="python fake_train.py --callback-file {callback_file} --run-id {run_id} --turn-id {turn_id}"),
    )

    create_response = client.post("/api/v1/loops", json=contract.model_dump(mode="json"))
    assert create_response.status_code == 200
    assert create_response.json()["status"] == "ready"

    start_response = client.post("/api/v1/loops/api_loop/start")
    assert start_response.status_code == 200
    assert start_response.json()["status"] == "completed"

    events_response = client.get("/api/v1/loops/api_loop/events")
    assert events_response.status_code == 200
    events = [event["event_type"] for event in events_response.json()]
    assert "loop.created" in events
    assert "run.completed" in events
