# Codex Agent Loop Orchestrator

Local service for turning broad research or engineering goals into low-noise Codex-assisted orchestration loops.

The intended entrypoint is a goal brief, not a hand-written JSON file. For example:

```text
Find and reproduce three high-quality fraud-detection baselines published or updated after 2024.
Produce runnable reproduction notes, metrics, and a final comparison report.
```

The orchestrator owns the lifecycle. Codex-powered turns provide model intelligence in three short-lived roles:

- **Planner** turns the broad goal into a task graph and next task plan.
- **Worker** applies short-lived code, configuration, adaptation, or documentation changes.
- **Judge** evaluates evidence, task results, artifacts, and recommends the next decision.

Long-running work stays outside Codex. Searches, downloads, dataset preparation, baseline reproduction, training, benchmarks, and report generation are TaskRuns owned by tmux, subprocesses, schedulers, or external systems. Once a long TaskRun is safely owned outside Codex, the orchestrator records state and forces an operational pause so no Codex turn sits around monitoring logs.

Hard boundary: Codex roles cannot create or own loops, cannot instantiate real TaskRuns, and cannot recursively start new loops to keep control. Planner, Worker, and Judge may write their required artifacts, but task creation and lifecycle transitions are executed only by the Orchestrator and Policy Engine. SQLite state is authoritative.

Production Codex turns are intended to run through the Codex SDK. Skills, `codex exec`, hooks, and thread automations can inspire operational-pause behavior or serve as temporary wake/debug surfaces, but they are not the Orchestrator control plane.

## Positioning

**For** research engineers and automation platform builders who need to delegate cross-day coding, research, reproduction, and benchmark goals to Codex without keeping a model turn alive, **Codex Agent Loop Orchestrator** is a local orchestration service that turns broad goals into auditable task graphs, runs Codex only for planning/work/judgment, and hands long work to external owners with explicit wake paths.

**Unlike** ad hoc tmux scripts, notebook notes, or long-running `codex exec` sessions, CALO keeps lifecycle authority outside the model: Planner can suggest, Worker can change files, Judge can recommend, but Orchestrator and PolicyEngine decide what actually runs.

## What You Get

- Local FastAPI service with Web UI at `/ui/`
- CLI for creating, starting, stepping, pausing, resuming, cancelling, and inspecting loops
- Planner / Worker / Judge role separation
- Task graph and TaskRun orchestration model
- Sync and async execution modes
- SQLite state store
- Idempotent callback handling
- Optional HMAC-signed webhook callbacks
- Git commits for source changes
- Audit artifacts under `.codex/agent-loop/<loop_id>/`
- Offline deterministic runner for testing
- Codex SDK runner target for real Planner / Worker / Judge turns

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

## Intended Product Flow

The product flow should look like this:

1. User submits a goal brief, repo path, constraints, resource budget, and approval preferences.
2. Orchestrator compiles that into a goal contract.
3. Planner produces a task graph, such as literature search, repo discovery, dataset download, environment setup, baseline reproduction, benchmark, and final report.
4. Policy Engine validates the task graph against permissions, budget, and human gates.
5. Orchestrator creates TaskRuns for approved tasks.
6. Short work can run immediately through Worker or local commands.
7. Long work is handed to an external owner. After that handoff, Codex must stop monitoring and the loop enters operational pause.
8. Webhooks, status files, watchdogs, schedulers, or user actions wake the orchestrator later.
9. Judge reviews compact evidence and recommends continue, fix, stop, rollback, or ask for review.
10. Orchestrator decides and records the next state.

The JSON contract is the durable internal control plane for this flow. It is still exposed in the current MVP and for automation, but it should not remain the main human entrypoint.

## What This Replaces

CALO is intended to replace brittle research automation patterns:

- Leaving Codex blocked on a long Bash command.
- Manually watching tmux logs and pasting summaries back into a chat.
- Hand-maintaining scattered status notes in notebooks or Markdown.
- Letting a model decide to retry, clean data, or spawn follow-up loops without a hard external policy layer.
- Treating one training command as the whole product when the real job is a task chain: discover, select, download, adapt, run, evaluate, report.

## Current Gap

The current repository is a working local MVP, but not the final product experience:

- It proves loop state, policy decisions, callback idempotency, sync/async demos, Git audit commits, and a local Web UI.
- It still exposes `examples/loop_contract.json` as the main runnable entry.
- It has a deterministic local runner and a `codex-cli` compatibility bridge.
- It does not yet implement the default goal brief entrypoint, full TaskGraph/TaskRun models, or production Codex SDK adapter.

Use the current MVP to validate the orchestration spine. Use the PRD as the source of truth for the product direction.

## 5-Minute Local Demo

Run a complete local loop using the deterministic offline runner. This demo is intentionally narrow and metric-based; it proves the loop machinery, not the final broad-goal UX:

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

The Web UI shows loop-level status, current phase, next action, turn progress, metric progress, last run, last decision, and a human-readable timeline.

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
- `task_graph/turn_<n>.json`
- `state.json`
- `plan/turn_<n>.json`
- `handoff/turn_<n>.md`
- `judge/turn_<n>.json`
- `evidence/turn_<n>.json`
- `runs/run_<n>.json`
- `reports/final_report.md`

### Control Boundary

Codex roles write task graph suggestions, plans, code changes, handoffs, and judge reports. They do not control the loop.

The loop is controlled by:

```text
LoopController -> PolicyEngine -> StateStore
```

This prevents a Codex turn from recursively creating new loops, instantiating TaskRuns on its own, force-completing a loop, or bypassing lifecycle policy.

## Current MVP Entry: Contract JSON

The current MVP still starts from `examples/loop_contract.json`. Treat this as an advanced/API entrypoint and test fixture, not the final product UX.

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

Planned default human entrypoints:

- `calo goal` interactive CLI: asks for a broad objective, repo, constraints, budget, and approval gates, then generates the contract.
- Web UI create flow: goal brief first, advanced contract JSON hidden behind an inspection panel.
- API `POST /api/v1/goals`: accepts a goal brief and creates a loop through the Planner.

## Product Roadmap

Now:

- Keep the existing contract JSON entry stable for tests and automation.
- Tighten the dashboard around phase, next action, owner, wake path, and readable event summaries.
- Preserve deterministic local runner for acceptance tests.

Next:

- Add `calo goal` and `POST /api/v1/goals` to compile goal briefs into contracts.
- Add TaskGraph and TaskRun persistence models.
- Replace training-specific naming in callbacks and events with generic TaskRun language while preserving backward compatibility.
- Implement Codex SDK Runner as the production model-backed path.
- Add policy tests that reject recursive loop creation, unapproved TaskRun creation, over-budget tasks, and long polling.

Later:

- Add Web UI goal wizard and task graph view.
- Add artifact browser and final report viewer.
- Add scheduler integrations for tmux/systemd/Slurm/Ray/Kubernetes.
- Add multi-loop queueing, PR integration, and team audit controls.

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
- Current phase and next expected action
- Current turn and max turns
- Turn progress
- Best metric and target value
- Metric progress
- Last run ID
- Last decision
- Human-readable loop timeline with expandable details

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

## Remote GPU / AutoDL Access

Some hosted GPU machines do not expose public HTTP/HTTPS ports. In that case, bind the service to localhost on the remote machine and access it through an SSH tunnel from your laptop.

On the remote machine, start CALO on port `6006`:

```bash
calo serve --workspace /tmp/calo-example-loop --host 127.0.0.1 --port 6006
```

On your local machine, open PowerShell on Windows or Terminal on macOS/Linux, then create the tunnel:

```bash
ssh -CNg -L <local_port>:127.0.0.1:<remote_service_port> <user>@<ssh_host> -p <ssh_port>
```

For the `6006` service example, keep both forwarded ports as `6006` unless your local machine already uses that port:

```bash
ssh -CNg -L 6006:127.0.0.1:6006 <user>@<ssh_host> -p <ssh_port>
```

If SSH asks `yes/no`, answer `yes`. Enter the machine password or key passphrase when prompted. The terminal usually shows no output after a successful connection.

Then open this URL locally:

```text
http://127.0.0.1:6006/ui/
```

Notes:

- Do not commit machine passwords or temporary access credentials.
- If the local port is already in use, change both local sides consistently, for example `-L 16006:127.0.0.1:6006`, then open `http://127.0.0.1:16006/ui/`.
- If you see `Permission denied`, re-enter the password manually; some terminals handle pasted passwords poorly.

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

### Codex SDK Runner Target

The PRD target is a real Codex SDK runner. The runner must let Orchestrator create, run, resume, sandbox, and audit Planner / Worker / Judge turns programmatically. The SDK runner, not a skill, is the production path for model-backed decisions.

The current MVP still exposes a `codex-cli` runner as a compatibility bridge:

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

Do not treat `codex-cli` as the final architecture. It is useful for smoke tests while the SDK adapter is being wired, but production orchestration should use Codex SDK calls and persist SDK thread metadata.

## HTTP API

Goal-first API target:

```http
POST /api/v1/goals
```

Current MVP advanced/API entry:

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

TaskRun callback:

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

- A loop can launch a background TaskRun and enter `waiting_callback`.
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

Check whether the background TaskRun wrote the callback file:

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

- It can run complete sync demo loops.
- It can run async callback demo loops.
- It has a local Web UI.
- It has signed, idempotent callbacks.
- It has tests and acceptance scripts.
- It keeps lifecycle authority in the Orchestrator and PolicyEngine.
- It still needs the goal brief entrypoint, generic TaskGraph/TaskRun model, and production Codex SDK Runner to match the full PRD.

See also:

- [Architecture](docs/ARCHITECTURE.md)
- [Web UI Feasibility Study](docs/web-ui-feasibility.md)
- [Product Requirements](docs/PRD.md)
