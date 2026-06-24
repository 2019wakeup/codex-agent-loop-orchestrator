# Web UI Feasibility Study

Date: 2026-06-24

## Goal

Add a local Web UI to the existing service so a user can watch loop-level state at a glance:

- Current status
- Turn count and max turns
- Best metric and target metric
- Last decision and last run
- Event timeline
- Progress toward loop completion
- Basic lifecycle actions

This is a local operator dashboard, not a public SaaS product and not a marketing page.

## Taste Skill Research

The requested "taste skill" appears to be the public `taste-skill` project:

- GitHub: `Leonxlnx/taste-skill`
- Site: `tasteskill.dev`
- Main frontend skill: `design-taste-frontend`

It is not installed in this Codex session, so implementation follows the current frontend instructions plus the useful design direction from that skill family:

- Avoid generic template polish.
- Build the actual working surface first.
- Use dense, scannable operational UI.
- Prefer clear hierarchy, good spacing, and concrete state over decorative composition.
- Avoid marketing hero patterns for a local tool.

## Current System Fit

The backend already has:

- FastAPI app factory in `src/calo/api.py`
- SQLite state store in `src/calo/store.py`
- Loop state, contract, events, callback idempotency
- CLI `serve`
- Lifecycle actions: start, pause, resume, cancel

Missing for a useful UI:

- A summary endpoint that joins state, contract, derived progress, and recent events.
- Static UI assets served by FastAPI.
- A local dashboard route.
- UI tests that verify the dashboard page and summary API.

## Architecture Options

### Option A: Static HTML/CSS/JS served by FastAPI

Pros:

- No Node build chain.
- Easy local installation.
- Good fit for an operational dashboard.
- Works inside current Python package.
- Low maintenance.

Cons:

- Less component structure than React/Vue.
- More manual DOM updates.

### Option B: React/Vite SPA

Pros:

- Scales better if the UI becomes rich.
- Easier component state management.

Cons:

- Adds Node toolchain and build artifacts.
- More moving parts for a local research utility.
- Slower to keep hermetic in tests.

### Option C: Server-rendered templates

Pros:

- Simple.
- Good for static snapshots.

Cons:

- Less ergonomic for polling live state.
- More backend rendering code.

## Recommendation

Use Option A for this milestone:

- `GET /` redirects to `/ui/`.
- `GET /ui/` serves packaged static assets.
- `GET /api/v1/dashboard` returns all loop summaries.
- `GET /api/v1/loops/{loop_id}/summary` returns one loop summary.
- The UI polls the dashboard endpoint every few seconds.

This keeps the feature local, lightweight, and directly useful.

## Loop Summary Shape

```json
{
  "loop_id": "example_loop",
  "objective": "Raise fake score to 0.70",
  "status": "completed",
  "turn": 2,
  "max_turns": 3,
  "progress_percent": 67,
  "target_metric": "score",
  "target_value": 0.7,
  "best_metric": 0.7,
  "metric_percent": 100,
  "last_decision": "completed_verify",
  "last_run_id": "run_0002",
  "updated_at": "2026-06-24T08:48:23Z",
  "repo_path": "/tmp/calo-example-loop",
  "recent_events": [
    {
      "event_type": "run.completed",
      "created_at": "...",
      "payload": {}
    }
  ]
}
```

## MVP UI Layout

Top band:

- Product name
- Last refresh time
- Refresh button
- API health indicator

Main grid:

- Loop rows/cards with status, objective, turn progress, metric progress, last run, last decision.
- Compact event timeline for selected loop.

Actions:

- Start
- Pause
- Resume
- Cancel

Design constraints:

- No hero section.
- No decorative blobs or gradients.
- No nested cards.
- Dense but readable rows.
- Use restrained colors tied to status.
- Do not hide operational data behind hover-only UI.

## Risks

- Polling may become noisy with many loops. Mitigation: keep summary payload small and add limit parameters later.
- Lifecycle buttons can mutate long-running work. Mitigation: actions require explicit button clicks and backend policy remains authoritative.
- Static JS can drift from API schema. Mitigation: tests verify summary endpoint and static UI availability.

## Acceptance Criteria

- `calo serve` exposes `/ui/`.
- Dashboard can list existing loops.
- Dashboard shows status, turn/max turns, metric target progress, last decision, and recent events.
- Lifecycle buttons call the existing API endpoints.
- Tests cover summary API and UI static route.
- Existing CLI, sync acceptance, and async acceptance continue to pass.
