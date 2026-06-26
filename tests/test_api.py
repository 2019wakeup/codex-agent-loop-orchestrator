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

    summary_response = client.get("/api/v1/loops/api_loop/summary")
    assert summary_response.status_code == 200
    summary = summary_response.json()
    assert summary["loop_id"] == "api_loop"
    assert summary["status"] == "completed"
    assert summary["turn"] >= 1
    assert summary["max_turns"] == 2
    assert summary["progress_percent"] >= 50
    assert summary["target_metric"] == "score"
    assert summary["metric_percent"] == 100
    assert summary["recent_events"]

    dashboard_response = client.get("/api/v1/dashboard")
    assert dashboard_response.status_code == 200
    assert dashboard_response.json()[0]["loop_id"] == "api_loop"


def test_dashboard_summary_exposes_async_owner_and_wake_path(tmp_path: Path) -> None:
    app = create_app(tmp_path / "api.sqlite3")
    client = TestClient(app)
    contract = LoopContract(
        loop_id="async_summary_loop",
        objective="Async handoff summary",
        repo_path=tmp_path / "repo",
        target_value=0.6,
        execution_mode="async",
        iteration_limits=IterationLimits(max_turns=2, patience=2),
        commands=Commands(train="python fake_train.py --callback-file {callback_file} --run-id {run_id} --turn-id {turn_id}"),
    )
    assert client.post("/api/v1/loops", json=contract.model_dump(mode="json")).status_code == 200

    step = client.post("/api/v1/loops/async_summary_loop/start")
    assert step.status_code == 200
    assert step.json()["status"] == "waiting_callback"
    assert step.json()["last_decision"] == "operational_pause"

    summary = client.get("/api/v1/loops/async_summary_loop/summary").json()
    assert summary["run_owner"] == "local_subprocess"
    assert summary["wake_path"].endswith("run_0001_callback.json")
    assert summary["codex_control"] == "released"
    assert summary["run_manifest_path"].endswith("run_0001_manifest.json")
    assert summary["run_stdout_path"].endswith("run_0001.log")
    assert summary["run_status"] == "running"
    assert summary["callback_ready"] in {False, True}

    events = [event["event_type"] for event in client.get("/api/v1/loops/async_summary_loop/events").json()]
    assert "loop.operational_pause" in events


def test_api_goal_brief_creates_runnable_loop_without_contract_json(tmp_path: Path) -> None:
    app = create_app(tmp_path / "api.sqlite3")
    client = TestClient(app)
    goal = {
        "loop_id": "goal_loop",
        "objective": "Raise fake score from a plain goal brief",
        "repo_path": str(tmp_path / "goal_repo"),
        "target_value": 0.6,
        "max_turns": 2,
    }

    create_response = client.post("/api/v1/goals", json=goal)
    assert create_response.status_code == 200
    assert create_response.json()["status"] == "ready"

    contract_path = tmp_path / "goal_repo" / ".codex" / "agent-loop" / "goal_loop" / "contract.json"
    assert contract_path.exists()

    start_response = client.post("/api/v1/loops/goal_loop/start")
    assert start_response.status_code == 200
    assert start_response.json()["status"] == "completed"

    events = [event["event_type"] for event in client.get("/api/v1/loops/goal_loop/events").json()]
    assert "loop.created" in events
    assert "run.completed" in events


def test_api_step_and_collect_callback_support_web_async_flow(tmp_path: Path) -> None:
    app = create_app(tmp_path / "api.sqlite3")
    client = TestClient(app)
    goal = {
        "loop_id": "web_async_loop",
        "objective": "Run async loop from Web controls",
        "repo_path": str(tmp_path / "web_async_repo"),
        "target_value": 0.6,
        "max_turns": 2,
        "execution_mode": "async",
    }
    assert client.post("/api/v1/goals", json=goal).status_code == 200

    stepped = client.post("/api/v1/loops/web_async_loop/step")
    assert stepped.status_code == 200
    assert stepped.json()["status"] == "waiting_callback"
    assert stepped.json()["last_decision"] == "operational_pause"

    pause_response = client.post("/api/v1/loops/web_async_loop/pause")
    assert pause_response.status_code == 409
    assert "cannot pause while waiting_callback" in pause_response.text
    assert client.get("/api/v1/loops/web_async_loop").json()["status"] == "waiting_callback"

    callback_file = tmp_path / "web_async_repo" / ".codex" / "agent-loop" / "web_async_loop" / "runs" / "run_0001_callback.json"
    for _ in range(50):
        if callback_file.exists():
            break
        time.sleep(0.05)
    assert callback_file.exists()

    collected = client.post("/api/v1/loops/web_async_loop/collect-callback")
    assert collected.status_code == 200
    assert collected.json()["status"] == "completed"

    summary = client.get("/api/v1/loops/web_async_loop/summary").json()
    assert summary["run_status"] == "succeeded"
    assert summary["callback_ready"] is False
    assert summary["callback_processed"] is True


def test_api_rejects_double_step_while_waiting_callback(tmp_path: Path) -> None:
    app = create_app(tmp_path / "api.sqlite3")
    client = TestClient(app)
    goal = {
        "loop_id": "double_step_loop",
        "objective": "Reject double async step",
        "repo_path": str(tmp_path / "double_step_repo"),
        "target_value": 0.6,
        "execution_mode": "async",
    }
    assert client.post("/api/v1/goals", json=goal).status_code == 200
    first = client.post("/api/v1/loops/double_step_loop/step")
    assert first.status_code == 200
    assert first.json()["status"] == "waiting_callback"

    second = client.post("/api/v1/loops/double_step_loop/step")
    assert second.status_code == 409
    assert "cannot run a turn while loop status is" in second.text

    start = client.post("/api/v1/loops/double_step_loop/start")
    assert start.status_code == 409
    assert "cannot start while loop status is" in start.text

    run_dir = tmp_path / "double_step_repo" / ".codex" / "agent-loop" / "double_step_loop" / "runs"
    assert (run_dir / "run_0001_manifest.json").exists()
    assert not (run_dir / "run_0002_manifest.json").exists()


def test_api_collect_callback_reports_not_ready(tmp_path: Path) -> None:
    app = create_app(tmp_path / "api.sqlite3")
    client = TestClient(app)
    goal = {
        "loop_id": "missing_callback_loop",
        "objective": "Missing callback should be a safe API error",
        "repo_path": str(tmp_path / "missing_callback_repo"),
        "target_value": 0.6,
        "execution_mode": "async",
    }
    assert client.post("/api/v1/goals", json=goal).status_code == 200
    assert client.post("/api/v1/loops/missing_callback_loop/step").status_code == 200

    wrong_run = client.post("/api/v1/loops/missing_callback_loop/collect-callback", params={"run_id": "../outside"})
    assert wrong_run.status_code == 400
    assert "does not match active run" in wrong_run.text

    callback_file = tmp_path / "missing_callback_repo" / ".codex" / "agent-loop" / "missing_callback_loop" / "runs" / "run_0001_callback.json"
    if callback_file.exists():
        callback_file.unlink()

    response = client.post("/api/v1/loops/missing_callback_loop/collect-callback")

    assert response.status_code == 409
    assert "callback file is not ready" in response.text


def test_api_rejects_mismatched_callback_payload(tmp_path: Path) -> None:
    app = create_app(tmp_path / "api.sqlite3")
    client = TestClient(app)
    goal = {
        "loop_id": "victim_loop",
        "objective": "Reject mismatched callback payload",
        "repo_path": str(tmp_path / "victim_repo"),
        "target_value": 0.6,
        "execution_mode": "async",
    }
    assert client.post("/api/v1/goals", json=goal).status_code == 200
    assert client.post("/api/v1/loops/victim_loop/step").status_code == 200

    callback_file = tmp_path / "victim_repo" / ".codex" / "agent-loop" / "victim_loop" / "runs" / "run_0001_callback.json"
    for _ in range(50):
        if callback_file.exists():
            break
        time.sleep(0.05)
    assert callback_file.exists()
    bad_payload = CallbackPayload(
        loop_id="other_loop",
        run_id="other_run",
        turn_id="turn_0001",
        status=RunStatus.SUCCEEDED,
        metrics={"score": 0.99},
    )
    callback_file.write_text(bad_payload.model_dump_json(), encoding="utf-8")

    response = client.post("/api/v1/loops/victim_loop/collect-callback")
    assert response.status_code == 400
    assert "callback loop_id other_loop does not match victim_loop" in response.text

    summary = client.get("/api/v1/loops/victim_loop/summary").json()
    assert summary["status"] == "waiting_callback"
    assert summary["run_status"] == "running"
    assert summary["callback_processed"] is False


def test_api_lifecycle_rejects_invalid_web_runner(tmp_path: Path) -> None:
    app = create_app(tmp_path / "api.sqlite3")
    client = TestClient(app)
    goal = {
        "loop_id": "runner_loop",
        "objective": "Runner validation",
        "repo_path": str(tmp_path / "runner_repo"),
        "target_value": 0.6,
    }
    assert client.post("/api/v1/goals", json=goal).status_code == 200

    response = client.post("/api/v1/loops/runner_loop/start?runner=bogus")

    assert response.status_code == 400
    assert "runner must be one of" in response.text

    pause_response = client.post("/api/v1/loops/runner_loop/pause?runner=bogus")
    assert pause_response.status_code == 400
    assert "runner must be one of" in pause_response.text


def test_web_ui_static_routes(tmp_path: Path) -> None:
    app = create_app(tmp_path / "api.sqlite3")
    client = TestClient(app)

    root = client.get("/", follow_redirects=False)
    assert root.status_code in {307, 308}
    assert root.headers["location"] == "/ui/"

    html = client.get("/ui/")
    assert html.status_code == 200
    assert "Codex Agent Loop Orchestrator" in html.text
    assert "Watch Codex improvement loops" in html.text
    assert 'id="goal-form"' in html.text
    assert "Goal brief" in html.text
    assert "Create loop" in html.text
    assert "Advanced settings" in html.text
    assert "Validation command" in html.text
    assert "TaskRun command" in html.text
    assert "Diff review" in html.text
    assert "Auto commit" in html.text

    app_js = client.get("/ui/app.js").text
    assert "/api/v1/dashboard" in app_js
    assert "/api/v1/goals" in app_js
    assert "/api/v1/context" in app_js
    assert "collect-callback" in app_js
    assert "Collect callback" in app_js
    assert "runnerQuery" in app_js
    assert 'status !== "waiting_callback"' in app_js
    assert "external TaskRun was not terminated" in app_js
    assert "Action failed" not in app_js
    assert "failed:" in app_js
    assert "succeeded:" in app_js
    assert "state.actionMessage" in app_js
    assert "describeEvent" in app_js
    assert "Loop timeline" in app_js
    assert "JSON.stringify(loop" not in app_js
    assert "JSON.stringify(event" not in app_js

    css = client.get("/ui/styles.css")
    assert css.status_code == 200
    assert ".loop-row" in css.text
    assert ".phase-panel" in css.text
    assert ".goal-form" in css.text


def test_web_ui_context_defaults_to_served_workspace(tmp_path: Path) -> None:
    db_path = tmp_path / ".calo" / "state.sqlite3"
    app = create_app(db_path)
    client = TestClient(app)

    response = client.get("/api/v1/context")

    assert response.status_code == 200
    assert response.json()["default_repo_path"] == str(tmp_path)
    assert response.json()["runner"] == "local"
    assert "codex-cli" in response.json()["runner_options"]


def test_api_callback_signature_validation(tmp_path: Path) -> None:
    app = create_app(tmp_path / "api.sqlite3")
    client = TestClient(app)
    contract = LoopContract(
        loop_id="signed_loop",
        objective="Raise fake score",
        repo_path=tmp_path / "repo",
        target_value=0.9,
        execution_mode="async",
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

    step = client.post("/api/v1/loops/signed_loop/step")
    assert step.status_code == 200
    assert step.json()["status"] == "waiting_callback"

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


def test_webhook_callback_requires_active_matching_turn(tmp_path: Path) -> None:
    app = create_app(tmp_path / "api.sqlite3")
    client = TestClient(app)
    contract = LoopContract(
        loop_id="webhook_guard_loop",
        objective="Guard forged webhook callback",
        repo_path=tmp_path / "repo",
        target_value=0.9,
        iteration_limits=IterationLimits(max_turns=2, patience=2),
        webhook=WebhookSecurity(secret="top-secret"),
        commands=Commands(train="python fake_train.py --callback-file {callback_file} --run-id {run_id} --turn-id {turn_id}"),
    )
    assert client.post("/api/v1/loops", json=contract.model_dump(mode="json")).status_code == 200
    payload = CallbackPayload(
        loop_id="webhook_guard_loop",
        run_id="run_0001",
        turn_id="../../outside",
        status=RunStatus.SUCCEEDED,
        metrics={"score": 0.99},
    )
    body = payload.model_dump_json().encode("utf-8")
    timestamp = str(int(time.time()))
    signature = sign_payload("top-secret", timestamp, body)

    response = client.post(
        "/api/v1/loops/webhook_guard_loop/runs/run_0001/callback",
        content=body,
        headers={
            "X-Agent-Loop-Timestamp": timestamp,
            "X-Agent-Loop-Signature": signature,
            "Content-Type": "application/json",
        },
    )

    assert response.status_code == 409
    assert "no active run is waiting" in response.text
    state = client.get("/api/v1/loops/webhook_guard_loop").json()
    assert state["best_metric"] is None
    assert not (tmp_path / "repo" / ".codex" / "agent-loop" / "webhook_guard_loop" / "outside.json").exists()


def test_api_lifecycle_controls(tmp_path: Path) -> None:
    app = create_app(tmp_path / "api.sqlite3")
    client = TestClient(app)
    contract = LoopContract(
        loop_id="life_loop",
        objective="Lifecycle control",
        repo_path=tmp_path / "repo",
        target_value=0.7,
    )
    assert client.post("/api/v1/loops", json=contract.model_dump(mode="json")).status_code == 200

    paused = client.post("/api/v1/loops/life_loop/pause")
    assert paused.status_code == 200
    assert paused.json()["status"] == "paused"

    resumed = client.post("/api/v1/loops/life_loop/resume")
    assert resumed.status_code == 200
    assert resumed.json()["status"] == "ready"

    cancelled = client.post("/api/v1/loops/life_loop/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
