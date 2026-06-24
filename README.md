# Codex Agent Loop Orchestrator

Local MVP for a Codex-driven long-task loop.

The orchestrator owns the loop lifecycle. Codex-powered turns provide model intelligence in three short-lived roles:

- Planner: proposes the next task plan.
- Worker: applies the plan.
- Judge: evaluates evidence and recommends the next decision.

The long-running task is external. The orchestrator launches it, records state, and consumes a callback payload without keeping a Codex turn alive.

Hard boundary: Codex roles cannot create or own loops. Planner, Worker, and Judge may write their required artifacts, but lifecycle transitions are executed only by the Orchestrator and Policy Engine, with SQLite state as the authority.

## Quick Start

```bash
python -m venv .venv
. .venv/bin/activate
pip install -e '.[dev]'
pytest -q
calo demo --workspace /tmp/calo-demo-workspace --target 0.70 --max-turns 3
```

The default MVP uses a deterministic local Codex runner stub so the full loop can be tested without API credentials. A real Codex SDK adapter can be wired behind the same `CodexRunner` interface.

## CLI Workflow

```bash
calo create --config examples/loop_contract.json --workspace /tmp/calo-example-loop
calo start example_loop --workspace /tmp/calo-example-loop
calo status example_loop --workspace /tmp/calo-example-loop
calo events example_loop --workspace /tmp/calo-example-loop
```

`workspace` stores the orchestrator SQLite DB at `.calo/state.sqlite3`. The target repo path is read from the loop contract and may be the same directory.

Lifecycle controls:

```bash
calo pause example_loop --workspace /tmp/calo-example-loop
calo resume example_loop --workspace /tmp/calo-example-loop
calo cancel example_loop --workspace /tmp/calo-example-loop
```

Run the HTTP API:

```bash
calo serve --workspace /tmp/calo-example-loop --host 127.0.0.1 --port 8000
```

Runner backends:

- `--runner local`: deterministic offline runner used by tests and demos.
- `--runner codex-cli`: invokes `codex exec` for Planner, Worker, and Judge turns.

## Async Callback Workflow

Use `execution_mode: "async"` in the contract to launch training as a background process and stop the orchestrator at `waiting_callback`.

```bash
calo create --config examples/async_loop_contract.json --workspace /tmp/calo-async-example-loop
calo step async_example_loop --workspace /tmp/calo-async-example-loop
calo collect-callback async_example_loop --workspace /tmp/calo-async-example-loop
```

The callback path is idempotent by `(loop_id, run_id)`. API callbacks can be protected with `webhook.secret`, which requires `X-Agent-Loop-Timestamp` and `X-Agent-Loop-Signature` headers.

Signature format:

```text
X-Agent-Loop-Signature = sha256=<hmac_sha256(secret, timestamp + "." + raw_body)>
```

The timestamp is Unix seconds and is checked against `webhook.timestamp_tolerance_seconds`.

## Core Artifacts

Each loop writes artifacts under:

```text
<repo>/.codex/agent-loop/<loop_id>/
```

Important files:

- `contract.json`
- `state.json`
- `plan/turn_<n>.json`
- `handoff/turn_<n>.md`
- `judge/turn_<n>.json`
- `evidence/turn_<n>.json`
- `reports/final_report.md`

## Acceptance

```bash
pytest -q
bash scripts/acceptance_demo.sh /tmp/calo-sync-acceptance
bash scripts/async_acceptance_demo.sh /tmp/calo-async-acceptance
```

## Development Status

This repo is intentionally MVP-sized but runnable: it includes sync and async execution modes, SQLite state, idempotent signed callbacks, CLI workflows, a FastAPI app factory, fake training commands, and tests that prove the planner/worker/judge/policy loop works end to end.
