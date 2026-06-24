from __future__ import annotations

import time
from pathlib import Path

from fastapi.testclient import TestClient

from calo.api import create_app
from calo.models import CallbackPayload, Commands, IterationLimits, LoopContract, RunStatus, WebhookSecurity
from calo.security import sign_payload


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

    list_response = client.get("/api/v1/loops")
    assert list_response.status_code == 200
    assert list_response.json()[0]["loop_id"] == "api_loop"


def test_api_callback_signature_validation(tmp_path: Path) -> None:
    app = create_app(tmp_path / "api.sqlite3")
    client = TestClient(app)
    contract = LoopContract(
        loop_id="signed_loop",
        objective="Raise fake score",
        repo_path=tmp_path / "repo",
        target_value=0.9,
        iteration_limits=IterationLimits(max_turns=2, patience=2),
        webhook=WebhookSecurity(secret="top-secret"),
        commands=Commands(train="python fake_train.py --callback-file {callback_file} --run-id {run_id} --turn-id {turn_id}"),
    )
    assert client.post("/api/v1/loops", json=contract.model_dump(mode="json")).status_code == 200
    payload = CallbackPayload(
        loop_id="signed_loop",
        run_id="run_0001",
        turn_id="turn_0001",
        status=RunStatus.SUCCEEDED,
        metrics={"score": 0.6},
    )
    body = payload.model_dump_json().encode("utf-8")

    bad = client.post("/api/v1/loops/signed_loop/runs/run_0001/callback", content=body)
    assert bad.status_code == 401

    timestamp = str(int(time.time()))
    signature = sign_payload("top-secret", timestamp, body)
    good = client.post(
        "/api/v1/loops/signed_loop/runs/run_0001/callback",
        content=body,
        headers={
            "X-Agent-Loop-Timestamp": timestamp,
            "X-Agent-Loop-Signature": signature,
            "Content-Type": "application/json",
        },
    )
    assert good.status_code == 200
    assert good.json()["best_metric"] == 0.6
