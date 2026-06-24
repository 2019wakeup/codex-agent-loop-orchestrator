# Architecture

The orchestrator owns lifecycle state and policy. Codex turns are short-lived role calls.

```text
LoopController
  -> Planner turn
  -> Worker turn
  -> validation
  -> Judge turn
  -> PolicyEngine
  -> git commit
  -> TaskRunner
  -> callback
  -> Judge turn
  -> PolicyEngine
```

The MVP ships with `LocalDeterministicCodexRunner`, a deterministic implementation of the Codex role interface. This keeps tests hermetic while preserving the production seam for a real Codex SDK adapter.

## Role Boundaries

- Planner writes `plan/turn_<n>.json` and `plan/turn_<n>.md`.
- Worker changes repo files and writes `handoff/turn_<n>.md`.
- Judge writes `judge/turn_<n>.json` and `judge/turn_<n>.md`.
- PolicyEngine alone maps model suggestions into lifecycle transitions.
- Codex roles must not create, start, pause, resume, cancel, or recursively orchestrate loops.
- SQLite state is authoritative. Files under `.codex/agent-loop/<loop_id>/` are audit artifacts, not lifecycle authority.

## Persistence

- SQLite stores loop state and event history.
- `.codex/agent-loop/<loop_id>/` stores contracts and artifacts.
- Git stores source changes and provides auditability.
