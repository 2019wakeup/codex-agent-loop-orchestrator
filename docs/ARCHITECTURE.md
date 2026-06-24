# Architecture

The orchestrator owns lifecycle state, task creation, and policy. Codex turns are short-lived SDK role calls that provide model intelligence but never own the loop.

```text
Goal brief
  -> LoopController
  -> Codex SDK Planner turn
  -> task graph artifact
  -> PolicyEngine
  -> TaskOrchestrator
  -> TaskRunner / external owner
  -> operational_pause
  -> callback / watchdog / user wake
  -> evidence packet
  -> Codex SDK Judge turn
  -> PolicyEngine
  -> next Planner turn or completed_verify
```

The MVP ships with `LocalDeterministicCodexRunner`, a deterministic implementation of the Codex role interface. This keeps tests hermetic while preserving the production path for a real Codex SDK adapter.

## Core Runtime Components

- `LoopController`: owns loop state transitions and decides when to call Planner, Worker, Judge, TaskOrchestrator, and PolicyEngine.
- `CodexRunner`: production target is Codex SDK. It creates, runs, resumes, sandboxes, and audits Planner / Worker / Judge turns.
- `PolicyEngine`: maps model recommendations into allowed decisions and blocks violations of budget, permissions, human gates, or stop conditions.
- `TaskOrchestrator`: turns approved task graph nodes into TaskRuns and tracks dependencies, owner, retries, timeout, wake path, and artifacts.
- `TaskRunner`: launches concrete work such as search, download, environment setup, baseline reproduction, training, benchmark, validation, or reporting.
- `StateStore`: SQLite source of truth for loop, turn, task, run, event, decision, and callback idempotency.
- `ArtifactStore`: filesystem audit trail under `.codex/agent-loop/<loop_id>/`.

## Goal To Task Flow

1. User submits a broad goal brief plus repo, constraints, budget, and approval preferences.
2. Orchestrator compiles an initial goal contract.
3. Planner uses Codex SDK to write `task_graph/turn_<n>.json` and `plan/turn_<n>.json`.
4. PolicyEngine validates the task graph before any real TaskRun exists.
5. TaskOrchestrator creates approved TaskRuns and records owner manifests.
6. Short work can be handled immediately by Worker or local commands.
7. Long work is handed to an external owner such as tmux, subprocess, Slurm, Ray, Kubernetes, or a domain-specific downloader.
8. Once owner and wake path exist, Orchestrator records `operational_pause` and Codex turn control ends.
9. Callback, watchdog, status file, scheduler, or user action wakes the loop.
10. Judge receives compact evidence and recommends continue, fix, stop, rollback, or review.

## Local Web UI

The local dashboard is served by the same FastAPI app:

- `/` redirects to `/ui/`.
- `/ui/` serves static packaged HTML/CSS/JS.
- `/api/v1/dashboard` returns loop summaries for the dashboard.
- `/api/v1/loops/{loop_id}/summary` returns one loop summary.

The UI does not own lifecycle state. It calls existing Orchestrator endpoints for start, pause, resume, and cancel. SQLite remains the authoritative state store.

The dashboard should make these product questions answerable at a glance:

- What broad goal is this loop pursuing?
- Which phase is active now?
- Which TaskRun owns long work?
- What will wake the loop?
- What did Judge/Policy decide last?
- Is user review required?

## Role Boundaries

- Planner writes `task_graph/turn_<n>.json`, `plan/turn_<n>.json`, and `plan/turn_<n>.md`.
- Worker changes repo files and writes `handoff/turn_<n>.md`.
- Judge writes `judge/turn_<n>.json` and `judge/turn_<n>.md`.
- PolicyEngine alone maps model suggestions into lifecycle transitions.
- TaskOrchestrator alone creates real TaskRuns after PolicyEngine approval.
- Codex roles must not create, start, pause, resume, cancel, instantiate TaskRuns, or recursively orchestrate loops.
- `self-agent-loop`, hooks, automations, and `codex exec` are not production control planes. They may inform operational pause behavior or serve as temporary wake/debug surfaces.
- SQLite state is authoritative. Files under `.codex/agent-loop/<loop_id>/` are audit artifacts, not lifecycle authority.

## Persistence

- SQLite stores loop state and event history.
- `.codex/agent-loop/<loop_id>/` stores contracts, task graphs, plans, handoffs, judge reports, evidence packets, run manifests, and final reports.
- Git stores source changes and provides auditability.

## Operational Pause Boundary

Operational pause is a hard runtime boundary:

- Required when a long TaskRun has a durable external owner and a wake path.
- Forbidden when no owner, state path, or wake path exists.
- Healthy wait checks update local state and suppress noisy reports.
- Codex SDK turns resume only when Orchestrator has compact evidence requiring planning, code work, judgment, failure diagnosis, or user-facing summary.
