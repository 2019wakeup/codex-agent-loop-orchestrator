#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="${1:-/tmp/calo-web-acceptance-demo}"
PORT="${2:-8766}"
BASE="http://127.0.0.1:${PORT}"

rm -rf "$WORKSPACE"
calo serve --workspace "$WORKSPACE" --host 127.0.0.1 --port "$PORT" >/tmp/calo-web-acceptance.log 2>&1 &
SERVER_PID="$!"
trap 'kill "$SERVER_PID" >/dev/null 2>&1 || true' EXIT

for _ in $(seq 1 50); do
  if curl -fsS "$BASE/api/v1/context" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

curl -fsS "$BASE/ui/" | rg 'goal-form|Advanced settings|Create loop' >/dev/null
curl -fsS "$BASE/ui/app.js" | rg 'collect-callback|runnerQuery|succeeded:' >/dev/null

BASE="$BASE" WORKSPACE="$WORKSPACE" python - <<'PY'
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

base = os.environ["BASE"]
workspace = Path(os.environ["WORKSPACE"])


def post(path: str, payload: dict | None = None) -> dict:
    data = None if payload is None else json.dumps(payload).encode()
    headers = {"Content-Type": "application/json"} if data else {}
    request = urllib.request.Request(base + path, data=data, method="POST", headers=headers)
    with urllib.request.urlopen(request) as response:
        return json.loads(response.read())


def get(path: str) -> dict:
    with urllib.request.urlopen(base + path) as response:
        return json.loads(response.read())


context = get("/api/v1/context")
assert context["default_repo_path"] == str(workspace)
assert "codex-cli" in context["runner_options"]

goal = {
    "loop_id": "web_acceptance_loop",
    "objective": "Run async loop from Web acceptance controls",
    "repo_path": str(workspace / "repo"),
    "target_metric": "score",
    "target_value": 0.6,
    "max_turns": 2,
    "patience": 2,
    "min_delta": 0.001,
    "validation_command": "python -m py_compile target_app.py",
    "task_command": "python fake_train.py --callback-file {callback_file} --run-id {run_id} --turn-id {turn_id}",
    "execution_mode": "async",
    "require_diff_review": False,
    "auto_commit": True,
}
assert post("/api/v1/goals", goal)["status"] == "ready"

try:
    post("/api/v1/loops/web_acceptance_loop/step?runner=invalid")
except urllib.error.HTTPError as error:
    assert error.code == 400
else:
    raise AssertionError("invalid runner should be rejected")

stepped = post("/api/v1/loops/web_acceptance_loop/step?runner=local")
assert stepped["status"] == "waiting_callback"
assert stepped["last_decision"] == "operational_pause"

try:
    post("/api/v1/loops/web_acceptance_loop/pause?runner=local")
except urllib.error.HTTPError as error:
    assert error.code == 409
else:
    raise AssertionError("waiting_callback should already be operationally paused")

callback = workspace / "repo" / ".codex" / "agent-loop" / "web_acceptance_loop" / "runs" / "run_0001_callback.json"
for _ in range(50):
    if callback.exists():
        break
    time.sleep(0.05)
assert callback.exists()

summary = get("/api/v1/loops/web_acceptance_loop/summary")
assert summary["run_owner"] == "local_subprocess"
assert summary["callback_ready"] is True
assert summary["run_stdout_path"].endswith("run_0001.log")

collected = post("/api/v1/loops/web_acceptance_loop/collect-callback?runner=local")
assert collected["status"] == "completed"
assert collected["best_metric"] == 0.6

summary = get("/api/v1/loops/web_acceptance_loop/summary")
assert summary["run_status"] == "succeeded"
assert summary["callback_ready"] is False
assert summary["callback_processed"] is True
assert summary["task_graph"]["turn_id"] == "turn_0001"
assert summary["task_runs"][0]["status"] == "succeeded"

tasks = get("/api/v1/loops/web_acceptance_loop/tasks")
assert tasks["task_graphs"][0]["nodes"][0]["status"] == "approved"
assert tasks["task_runs"][0]["callback_processed"] is True

artifacts = get("/api/v1/loops/web_acceptance_loop/artifacts")
assert any(entry["path"] == "task_graph/turn_0001.json" for entry in artifacts)
PY

echo "web acceptance demo passed: $WORKSPACE"
