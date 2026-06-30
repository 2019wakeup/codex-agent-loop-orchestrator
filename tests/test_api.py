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
        task_adapter_mode="demo",
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
    assert summary["created_at"]
    assert summary["elapsed_seconds"] >= 0
    assert summary["estimated_codex_tokens"] > 0
    assert summary["token_budget_hint"] == 6000
    assert summary["recent_events"]

    dashboard_response = client.get("/api/v1/dashboard")
    assert dashboard_response.status_code == 200
    assert dashboard_response.json()[0]["loop_id"] == "api_loop"


def test_api_filesystem_browses_machine_directories(tmp_path: Path) -> None:
    app = create_app(tmp_path / "api.sqlite3")
    client = TestClient(app)
    repo = tmp_path / "repo"
    repo.mkdir()
    not_directory = tmp_path / "target.py"
    not_directory.write_text("print('ok')\n", encoding="utf-8")

    response = client.get("/api/v1/filesystem", params={"path": str(tmp_path)})

    assert response.status_code == 200
    body = response.json()
    assert body["path"] == str(tmp_path.resolve())
    assert body["parent"] == str(tmp_path.parent.resolve())
    assert {"name": "repo", "path": str(repo.resolve())} in body["entries"]

    root_response = client.get("/api/v1/filesystem", params={"path": "/"})
    assert root_response.status_code == 200
    assert root_response.json()["path"] == "/"

    file_response = client.get("/api/v1/filesystem", params={"path": str(not_directory)})
    assert file_response.status_code == 400
    assert "not a directory" in file_response.text


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
        task_adapter_mode="demo",
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
        "task_adapter_mode": "demo",
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


def test_api_operator_guidance_updates_objective_and_next_evidence(tmp_path: Path) -> None:
    app = create_app(tmp_path / "api.sqlite3")
    client = TestClient(app)
    goal = {
        "loop_id": "guided_loop",
        "objective": "Improve the Web entrypoint",
        "repo_path": str(tmp_path / "guided_repo"),
        "target_value": 0.6,
        "max_turns": 2,
        "task_adapter_mode": "demo",
    }
    assert client.post("/api/v1/goals", json=goal).status_code == 200

    guidance = {
        "message": "Prioritize direct operator commands and clearer next-step copy.",
        "revised_objective": "Improve the Web entrypoint with operator guidance controls.",
        "applies_to": "next_turn",
    }
    response = client.post("/api/v1/loops/guided_loop/guidance", json=guidance)

    assert response.status_code == 200
    body = response.json()
    assert body["message"] == guidance["message"]
    assert body["revised_objective"] == guidance["revised_objective"]
    assert body["previous_objective"] == goal["objective"]

    summary = client.get("/api/v1/loops/guided_loop/summary").json()
    assert summary["objective"] == guidance["revised_objective"]
    assert summary["operator_guidance"][0]["message"] == guidance["message"]

    assert client.post("/api/v1/loops/guided_loop/step").status_code == 200
    evidence_path = tmp_path / "guided_repo" / ".codex" / "agent-loop" / "guided_loop" / "evidence" / "turn_0001.json"
    evidence = evidence_path.read_text(encoding="utf-8")
    assert guidance["message"] in evidence
    assert guidance["revised_objective"] in evidence

    artifacts = client.get("/api/v1/loops/guided_loop/artifacts").json()
    assert any(entry["path"].startswith("guidance/") for entry in artifacts)


def test_goal_persists_runner_backend_and_summary_trust_signals(tmp_path: Path) -> None:
    app = create_app(tmp_path / "api.sqlite3")
    client = TestClient(app)
    goal = {
        "loop_id": "real_backend_loop",
        "objective": "Use a real backend instead of silently simulating",
        "repo_path": str(tmp_path / "real_backend_repo"),
        "target_value": 0.6,
        "runner_kind": "codex-cli",
        "runner_model": "test-model",
    }

    create_response = client.post("/api/v1/goals", json=goal)

    assert create_response.status_code == 200
    contract = client.get("/api/v1/loops/real_backend_loop/summary").json()
    assert contract["runner_kind"] == "codex-cli"
    assert contract["runner_model"] == "test-model"
    assert contract["runner_is_simulated"] is False
    assert contract["runner_label"] == "Codex CLI"
    assert contract["task_adapter_mode"] == "none"
    assert contract["artifact_root"].endswith(".codex/agent-loop/real_backend_loop")
    assert contract["artifact_root_exists"] is True


def test_real_goal_without_task_adapter_stops_before_fake_training(tmp_path: Path) -> None:
    app = create_app(tmp_path / "api.sqlite3")
    client = TestClient(app)
    repo = tmp_path / "real_goal_repo"
    goal = {
        "loop_id": "needs_adapter_loop",
        "objective": "Use real Codex turns without pretending a training job exists",
        "repo_path": str(repo),
        "target_value": 0.6,
        "runner_kind": "codex-cli",
        "task_adapter_mode": "none",
    }
    assert client.post("/api/v1/goals", json=goal).status_code == 200
    assert not (repo / "fake_train.py").exists()
    assert not (repo / "target_app.py").exists()

    response = client.post("/api/v1/loops/needs_adapter_loop/step", params={"runner": "local"})

    assert response.status_code == 200
    assert response.json()["status"] == "needs_setup"
    assert response.json()["last_decision"] == "blocked_needs_user"
    assert not (repo / "fake_train.py").exists()
    events = client.get("/api/v1/loops/needs_adapter_loop/events").json()
    event_types = [event["event_type"] for event in events]
    assert "task.adapter.required" in event_types
    assert "git.commit.created" not in event_types
    summary = client.get("/api/v1/loops/needs_adapter_loop/summary").json()
    assert summary["task_adapter_mode"] == "none"
    assert summary["status"] == "needs_setup"


def test_api_configures_adapter_and_continues_needs_setup_turn(tmp_path: Path) -> None:
    app = create_app(tmp_path / "api.sqlite3")
    client = TestClient(app)
    repo = tmp_path / "recover_repo"
    repo.mkdir()
    callback_script = repo / "write_callback.py"
    callback_script.write_text(
        """
from __future__ import annotations

import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--callback-file", required=True)
parser.add_argument("--run-id", required=True)
parser.add_argument("--turn-id", required=True)
parser.add_argument("--loop-id", required=True)
args = parser.parse_args()

payload = {
    "loop_id": args.loop_id,
    "run_id": args.run_id,
    "turn_id": args.turn_id,
    "status": "succeeded",
    "metrics": {"score": 0.72},
    "summary": "real command adapter callback"
}
Path(args.callback_file).write_text(json.dumps(payload), encoding="utf-8")
""".lstrip(),
        encoding="utf-8",
    )
    goal = {
        "loop_id": "recover_adapter_loop",
        "objective": "Recover from missing adapter without rerunning the Codex turn",
        "repo_path": str(repo),
        "target_value": 0.7,
        "runner_kind": "codex-cli",
        "task_adapter_mode": "none",
    }
    assert client.post("/api/v1/goals", json=goal).status_code == 200
    needs_setup = client.post("/api/v1/loops/recover_adapter_loop/step", params={"runner": "local"})
    assert needs_setup.status_code == 200
    assert needs_setup.json()["status"] == "needs_setup"
    assert needs_setup.json()["turn"] == 1

    response = client.post(
        "/api/v1/loops/recover_adapter_loop/task-adapter",
        json={
            "task_adapter_mode": "command",
            "validation_command": "",
            "task_command": "python write_callback.py --callback-file {callback_file} --run-id {run_id} --turn-id {turn_id} --loop-id {loop_id}",
            "continue_current_turn": True,
        },
        params={"runner": "local"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "completed"
    assert response.json()["turn"] == 1
    assert response.json()["best_metric"] == 0.72
    summary = client.get("/api/v1/loops/recover_adapter_loop/summary").json()
    assert summary["task_adapter_mode"] == "command"
    assert summary["task_runs"][0]["run_id"] == "run_0001"
    assert summary["task_runs"][0]["status"] == "succeeded"
    events = [event["event_type"] for event in client.get("/api/v1/loops/recover_adapter_loop/events").json()]
    assert events.count("codex.planner.completed") == 1
    assert "task.adapter.configured" in events
    assert "task.adapter.validation.completed" in events
    assert "task.adapter.continuing_current_turn" in events
    assert "git.commit.created" in events
    assert "run.completed" in events


def test_api_adapter_recovery_rechecks_validation_before_commit(tmp_path: Path) -> None:
    app = create_app(tmp_path / "api.sqlite3")
    client = TestClient(app)
    repo = tmp_path / "validation_recover_repo"
    goal = {
        "loop_id": "adapter_validation_loop",
        "objective": "Stop recovery when adapter quick check fails",
        "repo_path": str(repo),
        "target_value": 0.7,
        "runner_kind": "codex-cli",
        "task_adapter_mode": "none",
    }
    assert client.post("/api/v1/goals", json=goal).status_code == 200
    assert client.post("/api/v1/loops/adapter_validation_loop/step", params={"runner": "local"}).json()["status"] == "needs_setup"

    response = client.post(
        "/api/v1/loops/adapter_validation_loop/task-adapter",
        json={
            "task_adapter_mode": "command",
            "validation_command": "python -c \"import sys; sys.exit(3)\"",
            "task_command": "python train.py --callback-file {callback_file} --run-id {run_id} --turn-id {turn_id} --loop-id {loop_id}",
            "continue_current_turn": True,
        },
        params={"runner": "local"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "failed"
    assert response.json()["last_decision"] == "failed_needs_action"
    events = [event["event_type"] for event in client.get("/api/v1/loops/adapter_validation_loop/events").json()]
    assert "task.adapter.validation.completed" in events
    assert "task.adapter.validation_failed" in events
    assert "git.commit.created" not in events
    assert "run.started" not in events
    assert client.get("/api/v1/loops/adapter_validation_loop/tasks").json()["task_runs"] == []


def test_api_rejects_adapter_configuration_while_running(tmp_path: Path) -> None:
    app = create_app(tmp_path / "api.sqlite3")
    client = TestClient(app)
    goal = {
        "loop_id": "adapter_running_loop",
        "objective": "Do not change adapter while external work is running",
        "repo_path": str(tmp_path / "adapter_running_repo"),
        "target_value": 0.6,
        "execution_mode": "async",
        "task_adapter_mode": "demo",
    }
    assert client.post("/api/v1/goals", json=goal).status_code == 200
    assert client.post("/api/v1/loops/adapter_running_loop/step").json()["status"] == "waiting_callback"

    response = client.post(
        "/api/v1/loops/adapter_running_loop/task-adapter",
        json={"task_adapter_mode": "command", "task_command": "python train.py"},
    )

    assert response.status_code == 409
    assert "cannot configure external work mode while loop status is" in response.text


def test_goal_command_adapter_requires_task_command(tmp_path: Path) -> None:
    app = create_app(tmp_path / "api.sqlite3")
    client = TestClient(app)
    response = client.post(
        "/api/v1/goals",
        json={
            "loop_id": "missing_command_loop",
            "objective": "Connect a real external task",
            "repo_path": str(tmp_path / "repo"),
            "runner_kind": "codex-cli",
            "task_adapter_mode": "command",
        },
    )

    assert response.status_code == 400
    assert "task_command is required" in response.text


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
        "task_adapter_mode": "demo",
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
    assert summary["task_graph"]["turn_id"] == "turn_0001"
    assert summary["task_runs"][0]["status"] == "succeeded"
    assert any(artifact["path"].startswith("task_graph/") for artifact in summary["artifacts"])

    tasks = client.get("/api/v1/loops/web_async_loop/tasks")
    assert tasks.status_code == 200
    assert tasks.json()["task_graphs"][0]["nodes"][0]["status"] == "approved"
    assert tasks.json()["task_runs"][0]["callback_processed"] is True

    artifacts = client.get("/api/v1/loops/web_async_loop/artifacts")
    assert artifacts.status_code == 200
    assert any(entry["path"] == "task_graph/turn_0001.json" for entry in artifacts.json())


def test_api_rejects_double_step_while_waiting_callback(tmp_path: Path) -> None:
    app = create_app(tmp_path / "api.sqlite3")
    client = TestClient(app)
    goal = {
        "loop_id": "double_step_loop",
        "objective": "Reject double async step",
        "repo_path": str(tmp_path / "double_step_repo"),
        "target_value": 0.6,
        "execution_mode": "async",
        "task_adapter_mode": "demo",
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


def test_api_can_terminate_owned_local_task_run(tmp_path: Path) -> None:
    app = create_app(tmp_path / "api.sqlite3")
    client = TestClient(app)
    goal = {
        "loop_id": "terminate_loop",
        "objective": "Terminate an owned local TaskRun",
        "repo_path": str(tmp_path / "terminate_repo"),
        "target_value": 0.6,
        "execution_mode": "async",
        "task_adapter_mode": "demo",
        "task_command": "python -c \"import time; time.sleep(30)\" --callback-file {callback_file} --run-id {run_id} --turn-id {turn_id}",
    }
    assert client.post("/api/v1/goals", json=goal).status_code == 200
    assert client.post("/api/v1/loops/terminate_loop/step").json()["status"] == "waiting_callback"

    response = client.post("/api/v1/loops/terminate_loop/runs/run_0001/terminate")

    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"
    assert response.json()["external_task_control"] in {"terminated", "already_exited"}
    assert client.get("/api/v1/loops/terminate_loop").json()["status"] == "cancelled"


def test_api_collect_callback_reports_not_ready(tmp_path: Path) -> None:
    app = create_app(tmp_path / "api.sqlite3")
    client = TestClient(app)
    goal = {
        "loop_id": "missing_callback_loop",
        "objective": "Missing callback should be a safe API error",
        "repo_path": str(tmp_path / "missing_callback_repo"),
        "target_value": 0.6,
        "execution_mode": "async",
        "task_adapter_mode": "demo",
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
        "task_adapter_mode": "demo",
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
    assert '<html lang="zh-CN">' in html.text
    assert "短 Codex turn 与外部长任务的本地控制台。" in html.text
    assert 'id="language-toggle"' in html.text
    assert ">English</button>" in html.text
    assert 'data-i18n="Local control plane for short Codex turns and externally owned long work."' in html.text
    assert 'id="goal-form"' in html.text
    assert 'id="goal-objective-preview"' in html.text
    assert "Markdown preview" in html.text
    assert "Markdown supported" in html.text
    assert "tables" in html.text
    assert 'id="layout-splitter"' in html.text
    assert 'role="separator"' in html.text
    assert "Goal brief" in html.text
    assert "Loop 队列" in html.text
    assert "<select id=\"goal-repo\"" in html.text
    assert "Browse" in html.text
    assert "使用此文件夹" in html.text
    assert 'data-i18n="Use folder"' in html.text
    assert "创建 Loop" in html.text
    assert 'data-i18n="Create loop"' in html.text
    assert "Execution backend" in html.text
    assert "Real Codex CLI" in html.text
    assert "Demo simulation" in html.text
    assert "External work mode" in html.text
    assert "Stop before TaskRun" in html.text
    assert "Run my command" in html.text
    assert "Demo fake TaskRun" in html.text
    assert "高级设置" in html.text
    assert 'data-i18n="Advanced settings"' in html.text
    assert "Adapter commands" in html.text
    assert "Quick check command" in html.text
    assert "Long-work adapter command" in html.text
    assert "Diff review" in html.text
    assert "Auto commit" in html.text

    app_js = client.get("/ui/app.js").text
    assert "/api/v1/dashboard" in app_js
    assert "/api/v1/goals" in app_js
    assert "/api/v1/context" in app_js
    assert "/api/v1/filesystem" in app_js
    assert "collect-callback" in app_js
    assert "Collect callback" in app_js
    assert "runnerQuery" in app_js
    assert "calo.language" in app_js
    assert "function applyI18n" in app_js
    assert "function renderMarkdown" in app_js
    assert "function renderMarkdownTable" in app_js
    assert "markdown-table-scroll" in app_js
    assert "syncGoalMarkdownPreview" in app_js
    assert "zh-CN" in app_js
    assert 'status !== "waiting_callback"' in app_js
    assert "external TaskRun was not terminated" in app_js
    assert "renderTaskGraph" in app_js
    assert "renderTaskRuns" in app_js
    assert "renderArtifacts" in app_js
    assert "Terminate local TaskRun" in app_js
    assert "command-groups" in app_js
    assert "/terminate" in app_js
    assert "Action failed" not in app_js
    assert "failed:" in app_js
    assert "succeeded:" in app_js
    assert "state.actionMessage" in app_js
    assert "describeEvent" in app_js
    assert "Loop timeline" in app_js
    assert "renderRepoOptions" in app_js
    assert "runnerText" in app_js
    assert 'start: status === "ready"' in app_js
    assert "Demo simulation backend" in app_js
    assert "No external work configured" in app_js
    assert "Codex sessions" in app_js
    assert "detailTab" in app_js
    assert "data-detail-tab" in app_js
    assert "detail-tab-panel" in app_js
    assert "task.adapter.required" in app_js
    assert "task-adapter-form" in app_js
    assert "/task-adapter" in app_js
    assert "Configure and continue" in app_js
    assert "Adapter configured; current turn continued" in app_js
    assert "task.adapter.configured" in app_js
    assert "task.adapter.validation.completed" in app_js
    assert "{loop_id}" in app_js
    assert "needs_setup" in app_js
    assert "Artifact directory missing" in app_js
    assert "initLayoutResize" in app_js
    assert "calo.leftPaneWidth" in app_js
    assert "estimated_codex_tokens" in app_js
    assert "formatDuration" in app_js
    assert "JSON.stringify(loop" not in app_js
    assert "JSON.stringify(event" not in app_js

    css = client.get("/ui/styles.css")
    assert css.status_code == 200
    assert ".loop-row" in css.text
    assert ".phase-panel" in css.text
    assert ".goal-form" in css.text
    assert ".markdown-body" in css.text
    assert ".markdown-preview-shell" in css.text
    assert ".layout-splitter" in css.text
    assert ".runner-banner" in css.text
    assert ".repo-browser" in css.text
    assert ".artifact-list" in css.text
    assert ".task-graph" in css.text
    assert ".detail-command-center" in css.text
    assert ".detail-tab-list" in css.text
    assert ".detail-scroll" in css.text


def test_web_ui_context_defaults_to_served_workspace(tmp_path: Path) -> None:
    db_path = tmp_path / ".calo" / "state.sqlite3"
    app = create_app(db_path)
    client = TestClient(app)

    response = client.get("/api/v1/context")

    assert response.status_code == 200
    assert response.json()["default_repo_path"] == str(tmp_path)
    assert response.json()["runner"] in {"local", "codex-cli"}
    assert isinstance(response.json()["codex_cli_available"], bool)
    if response.json()["codex_cli_available"]:
        assert response.json()["runner"] == "codex-cli"
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
        task_adapter_mode="demo",
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
        task_adapter_mode="demo",
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
        task_adapter_mode="demo",
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
