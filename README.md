# Codex Agent Loop Orchestrator

Local MVP for a Codex-driven long-task loop.

The orchestrator owns the loop lifecycle. Codex-powered turns provide model intelligence in three short-lived roles:

- Planner: proposes the next task plan.
- Worker: applies the plan.
- Judge: evaluates evidence and recommends the next decision.

The long-running task is external. The orchestrator launches it, records state, and consumes a callback payload without keeping a Codex turn alive.

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

Runner backends:

- `--runner local`: deterministic offline runner used by tests and demos.
- `--runner codex-cli`: invokes `codex exec` for Planner, Worker, and Judge turns.

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

## Development Status

This repo is intentionally MVP-sized: a synchronous local controller, SQLite state store, CLI, FastAPI app factory, fake training command, and tests that prove the planner/worker/judge/policy loop works end to end.
