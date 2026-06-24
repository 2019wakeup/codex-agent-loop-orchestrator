# Codex Agent Loop Orchestrator

Local service for running low-noise Codex improvement loops around long-running work such as training, benchmarks, and regression searches.

The orchestrator owns the lifecycle. Codex-powered turns provide model intelligence in three short-lived roles:

- **Planner** proposes the next task plan.
- **Worker** applies the plan.
- **Judge** evaluates evidence and recommends the next decision.

Long-running work stays outside Codex. The orchestrator launches it, records state, consumes callback results, and decides whether to continue, pause, stop, or ask for review.

Hard boundary: Codex roles cannot create or own loops. Planner, Worker, and Judge may write their required artifacts, but lifecycle transitions are executed only by the Orchestrator and Policy Engine. SQLite state is authoritative.

## What You Get

- Local FastAPI service with Web UI at `/ui/`
- CLI for creating, starting, stepping, pausing, resuming, cancelling, and inspecting loops
- Planner / Worker / Judge role separation
- Sync and async execution modes
- SQLite state store
- Idempotent callback handling
- Optional HMAC-signed webhook callbacks
- Git commits for source changes
- Audit artifacts under `.codex/agent-loop/<loop_id>/`
- Offline deterministic runner for testing
- Optional `codex exec` runner for real Codex turns

## Install

Clone and install in editable mode:

```bash
git clone https://github.com/2019wakeup/codex-agent-loop-orchestrator.git
cd codex-agent-loop-orchestrator
python -m venv .venv
. .venv/bin/activate
pip install -e '.[dev]'
```

Verify the install:

```bash
calo --help
pytest -q
```

Expected test result:

```text
14 passed
```

## 5-Minute Local Demo

Run a complete local loop using the deterministic offline runner:

```bash
calo demo --workspace /tmp/calo-demo-workspace --target 0.70 --max-turns 3
```

Expected shape:

```text
status=LoopStatus.COMPLETED
turns=2
best_score=0.7
artifacts=/tmp/calo-demo-workspace/.codex/agent-loop/demo_loop
```

Start the local service for that workspace:

```bash
calo serve --workspace /tmp/calo-demo-workspace --host 127.0.0.1 --port 8000
```

Open:

```text
http://127.0.0.1:8000/ui/
```

The Web UI shows loop-level status, turn progress, metric progress, last run, last decision, and recent events.

## Core Concepts

### Workspace vs Repo Path

`--workspace` is where the orchestrator stores its SQLite database:

```text
<workspace>/.calo/state.sqlite3
```

`repo_path` is defined inside the loop contract and points to the repository being changed by the loop. For simple local use, the workspace and repo path can be the same directory.

### Loop Artifacts

Each loop writes audit files under:

```text
<repo_path>/.codex/agent-loop/<loop_id>/
```

Important files:

- `contract.json`
- `state.json`
- `plan/turn_<n>.json`
- `handoff/turn_<n>.md`
- `judge/turn_<n>.json`
- `evidence/turn_<n>.json`
- `runs/run_<n>.json`
- `reports/final_report.md`

### Control Boundary

Codex roles write plans, code changes, handoffs, and judge reports. They do not control the loop.

The loop is controlled by:

```text
LoopController -> PolicyEngine -> StateStore
```

This prevents a Codex turn from recursively creating new loops, force-completing a loop, or bypassing lifecycle policy.

## Configure a Loop

Start from `examples/loop_contract.json`:

```json
{
  "loop_id": "example_loop",
  "objective": "Raise fake score to 0.70",
  "repo_path": "/tmp/calo-example-loop",
  "target_metric": "score",
  "target_value": 0.7,
  "execution_mode": "sync",
  "iteration_limits": {
    "max_turns": 3,
    "patience": 3,
    "min_delta": 0.001
  },
  "commands": {
    "validation": "python -m py_compile target_app.py",
    "train": "python fake_train.py --callback-file {callback_file} --run-id {run_id} --turn-id {turn_id}"
  }
}
```

Important fields:

- `loop_id`: stable identifier used by CLI, API, UI, and artifacts.
- `objective`: what Planner and Worker should optimize.
- `repo_path`: repository to modify and audit.
- `target_metric` / `target_value`: metric used by Judge and PolicyEngine.
- `execution_mode`: `sync` or `async`.
- `iteration_limits.max_turns`: hard stop.
- `iteration_limits.patience`: stop after repeated low-improvement turns.
- `commands.validation`: quick command before training.
- `commands.train`: long-running command. It receives `{callback_file}`, `{run_id}`, and `{turn_id}` placeholders.

## Sync Workflow

Sync mode runs a turn and immediately runs the training command in the same CLI process. This is best for smoke tests and short jobs.

Create the loop:

```bash
calo create --config examples/loop_contract.json --workspace /tmp/calo-example-loop
```

Run until complete:

```bash
calo start example_loop --workspace /tmp/calo-example-loop
```

Inspect state:

```bash
calo status example_loop --workspace /tmp/calo-example-loop
calo events example_loop --workspace /tmp/calo-example-loop
```

Open the Web UI:

```bash
calo serve --workspace /tmp/calo-example-loop --host 127.0.0.1 --port 8000
```

Then visit:

```text
http://127.0.0.1:8000/ui/
```

## Async Workflow

Async mode launches training as a background process and returns with the loop in `waiting_callback`.

Create the loop:

```bash
calo create --config examples/async_loop_contract.json --workspace /tmp/calo-async-example-loop
```

Run one orchestrator turn and launch training:

```bash
calo step async_example_loop --workspace /tmp/calo-async-example-loop
```

The loop should now be waiting:

```text
"status": "waiting_callback"
```

Collect the callback file after training writes it:

```bash
calo collect-callback async_example_loop --workspace /tmp/calo-async-example-loop
```

Repeat `step` and `collect-callback` until the loop reaches `completed`, or use the Web UI to watch progress.

## Web UI

Start the service:

```bash
calo serve --workspace /tmp/calo-example-loop --host 127.0.0.1 --port 8000
```

Open:

```text
http://127.0.0.1:8000/ui/
```

The dashboard tracks:

- Loop status
- Current turn and max turns
- Turn progress
- Best metric and target value
- Metric progress
- Last run ID
- Last decision
- Recent event timeline

Buttons call the same backend lifecycle endpoints as the CLI:

- Start
- Pause
- Resume
- Cancel

The UI does not own lifecycle state. It reads summaries from:

```text
GET /api/v1/dashboard
GET /api/v1/loops/{loop_id}/summary
```

## CLI Reference

```bash
calo create --config <contract.json> --workspace <workspace>
calo start <loop_id> --workspace <workspace>
calo step <loop_id> --workspace <workspace>
calo collect-callback <loop_id> --workspace <workspace>
calo pause <loop_id> --workspace <workspace>
calo resume <loop_id> --workspace <workspace>
calo cancel <loop_id> --workspace <workspace>
calo status <loop_id> --workspace <workspace>
calo events <loop_id> --workspace <workspace>
calo list --workspace <workspace>
calo serve --workspace <workspace> --host 127.0.0.1 --port 8000
```

## Runner Backends

### Local Runner

Default:

```bash
calo start example_loop --workspace /tmp/calo-example-loop --runner local
```

The local runner is deterministic and offline. It is intended for tests, demos, and end-to-end validation without API credentials.

### Codex CLI Runner

Use real Codex turns through `codex exec`:

```bash
calo start example_loop \
  --workspace /tmp/calo-example-loop \
  --runner codex-cli
```

Optionally select a model:

```bash
calo start example_loop \
  --workspace /tmp/calo-example-loop \
  --runner codex-cli \
  --model gpt-5.1-codex
```

The Codex CLI runner still obeys the same boundary:

- Planner writes plan artifacts.
- Worker changes repo files and writes handoff artifacts.
- Judge writes advisory reports.
- Orchestrator and PolicyEngine own lifecycle transitions.

## HTTP API

Create a loop:

```http
POST /api/v1/loops
```

Lifecycle:

```http
POST /api/v1/loops/{loop_id}/start
POST /api/v1/loops/{loop_id}/pause
POST /api/v1/loops/{loop_id}/resume
POST /api/v1/loops/{loop_id}/cancel
```

Read state:

```http
GET /api/v1/loops
GET /api/v1/loops/{loop_id}
GET /api/v1/loops/{loop_id}/events
GET /api/v1/dashboard
GET /api/v1/loops/{loop_id}/summary
```

Training callback:

```http
POST /api/v1/loops/{loop_id}/runs/{run_id}/callback
```

## Webhook Signing

Callbacks are idempotent by `(loop_id, run_id)`.

To require HMAC verification, set `webhook.secret` in the contract. Then send:

```text
X-Agent-Loop-Timestamp: <unix_seconds>
X-Agent-Loop-Signature: sha256=<hmac_sha256(secret, timestamp + "." + raw_body)>
```

The timestamp is checked against `webhook.timestamp_tolerance_seconds`.

## Validation and Acceptance

Run all tests:

```bash
pytest -q
```

Run sync acceptance:

```bash
bash scripts/acceptance_demo.sh /tmp/calo-sync-acceptance
```

Run async acceptance:

```bash
bash scripts/async_acceptance_demo.sh /tmp/calo-async-acceptance
```

The async script proves:

- A loop can launch training and enter `waiting_callback`.
- A callback can be collected later.
- The loop can continue across turns.
- The final state reaches `completed`.
- A final report is written.

## Troubleshooting

### `calo` command not found

Install the package in the active environment:

```bash
pip install -e '.[dev]'
```

Or run through Python:

```bash
python -m calo.cli --help
```

### Web UI is empty

Confirm the workspace points to the same `.calo/state.sqlite3` used when the loop was created:

```bash
calo list --workspace /tmp/calo-example-loop
```

Then restart:

```bash
calo serve --workspace /tmp/calo-example-loop
```

### Async loop stays in `waiting_callback`

Check whether the training command wrote the callback file:

```bash
ls <repo_path>/.codex/agent-loop/<loop_id>/runs/
```

Then collect it:

```bash
calo collect-callback <loop_id> --workspace <workspace>
```

### Codex CLI runner fails

Verify Codex CLI authentication and availability:

```bash
codex --help
codex exec --help
```

Use the local runner for smoke tests:

```bash
calo start <loop_id> --workspace <workspace> --runner local
```

## Project Status

This repository is usable as a local MVP:

- It can run complete sync loops.
- It can run async callback loops.
- It has a local Web UI.
- It has signed, idempotent callbacks.
- It has tests and acceptance scripts.
- It keeps lifecycle authority in the Orchestrator and PolicyEngine.

See also:

- [Architecture](docs/ARCHITECTURE.md)
- [Web UI Feasibility Study](docs/web-ui-feasibility.md)
- [Product Requirements](docs/PRD.md)
