# Vue Frontend Refactor PRD

Version: v0.1 draft
Date: 2026-06-30
Branch: `codex/vue-frontend-refactor`

## 1. Executive Summary

We are refactoring the CALO Web UI from the current static HTML/CSS/vanilla JavaScript bundle into a Vue 3 application for local loop operators and maintainers. The refactor should preserve the existing `/ui/` product behavior while making the frontend easier to test, evolve, and reason about as the dashboard grows. Delivery will be test-driven: every migration slice starts with characterization or failing tests, then ports behavior into Vue, then proves parity through unit/component tests, FastAPI static-route tests, and the existing real-browser Playwright acceptance flow.

As of 2026-06-30 UTC, the latest stable Vue package observed via `npm view vue version` is `3.5.39`. The implementation should use Vue `3.5.39` with Vite as the build tool, following Vue's official quick-start path for Vite-based projects.

## 2. Problem Statement

### Who Has This Problem?

- Local CALO operators who use `/ui/` to create, run, pause, wake, inspect, and recover orchestration loops.
- Maintainers who need to add dashboard capabilities without increasing regression risk.
- Test authors who need stable behavior coverage across backend API contracts and frontend interaction states.

### What Is The Problem?

The current frontend is a working static implementation, but it has outgrown the "small no-build dashboard" architecture:

- `src/calo/ui/app.js` is about 2,463 lines of mixed state, rendering, markdown parsing, i18n, API calls, browser event handling, command wizard logic, artifact filtering, and modal behavior.
- `src/calo/ui/styles.css` is about 2,051 lines and tightly coupled to generated string templates.
- `tests/test_api.py::test_web_ui_static_routes` asserts many static implementation details, including function names inside `app.js`, which makes refactors noisy.
- The real-browser test in `tests/test_web_browser.py` is valuable, but currently has to cover too much behavior at E2E level because lower-level frontend units are not isolated.
- The current architecture makes it easy for UI features to share hidden mutable state and harder to prove that one change did not break loop controls, artifact browsing, i18n, command generation, or markdown preview.

### Why Is It Painful?

- Feature work slows down because every UI change touches global functions and manual DOM updates.
- Regression risk is high in operator-critical flows such as "Run one turn", "Collect callback", "Configure and continue", and "Terminate local TaskRun".
- The frontend cannot easily reuse typed API models or isolate component behavior.
- Existing tests confirm end-to-end behavior, but they do not guide component-level implementation.

### Evidence From Current Repository

- Existing frontend assets: `src/calo/ui/index.html`, `src/calo/ui/app.js`, `src/calo/ui/styles.css`.
- Existing backend mount: `src/calo/api.py` mounts `StaticFiles(directory=ui_dir, html=True)` at `/ui`.
- Existing Web UI tests: `tests/test_api.py::test_web_ui_static_routes` and `tests/test_web_browser.py::test_web_buttons_and_action_messages_in_real_browser`.
- Prior architecture note `docs/web-ui-feasibility.md` recommended static HTML/CSS/JS when the dashboard was smaller; the dashboard now includes markdown preview, repo browsing, command wizard, tabs, timeline, artifacts, Codex session cards, modal focus views, and async TaskRun controls.

## 3. Target Users And Personas

### Primary Persona: Local Loop Operator

- Runs CALO on a local or remote machine.
- Needs to see loop status, current phase, next action, artifact evidence, callback readiness, and TaskRun ownership quickly.
- Cares that controls are explicit and that the UI does not imply Codex still owns a long-running task after operational pause.

### Secondary Persona: CALO Maintainer

- Adds lifecycle features and API fields.
- Needs a component structure where loop list, detail tabs, command wizard, artifact browser, timeline, and i18n can evolve independently.
- Needs tests that fail close to the broken behavior, not only through one long browser scenario.

### Jobs To Be Done

- Create a loop from a goal brief without writing raw contract JSON.
- Inspect the selected loop's phase, task graph, TaskRuns, artifacts, Codex role sessions, timeline, and operator guidance.
- Trigger lifecycle actions through the same backend endpoints as the CLI.
- Configure external work safely, especially command adapters that require `{callback_file}`.
- Preserve trust signals around local demo runner vs real Codex runner and fake TaskRun vs command TaskRun.

## 4. Strategic Context

### Why Now?

The current static dashboard proved the product surface and acceptance tests. It is now large enough that continued feature work in vanilla JS will increase maintenance cost and regression risk. A Vue refactor creates a better boundary between backend orchestration logic and frontend interaction logic while preserving the local FastAPI service model.

### Business And Product Goals

- Keep CALO's local operator dashboard reliable as the orchestration model grows.
- Improve frontend delivery speed without weakening the hard backend policy boundary.
- Make UI behavior testable before the user sees a broken long-running task control.
- Keep installation and packaging practical for a Python-first project.

### Technology Decision

| Area | Decision | Rationale |
| --- | --- | --- |
| Framework | Vue `3.5.39` | Latest stable observed on 2026-06-30 via npm; component model fits incremental dashboard refactor. |
| Build tool | Vite `8.1.0` | Official Vue quick-start path; fast local dev and simple static build. |
| Vue plugin | `@vitejs/plugin-vue` `6.0.7` | Required for Vue single-file components. |
| Unit/component test runner | Vitest `4.1.9` + `@vue/test-utils` `2.4.11` | Native Vite integration and Vue component mounting. |
| DOM environment | jsdom `29.1.1` | Component tests for browser behavior without launching Playwright. |
| E2E | Keep Python pytest + Playwright | Already validates the FastAPI-served app and backend lifecycle end to end. |
| Language | TypeScript for new frontend source | Gives API DTOs, component props, and state transitions a typed boundary. |

Sources and checks:

- `npm view vue version` -> `3.5.39` on 2026-06-30 UTC.
- `npm view vite version` -> `8.1.0` on 2026-06-30 UTC.
- Vue official quick-start recommends Vite-based project scaffolding: https://vuejs.org/guide/quick-start.html
- Vue official release policy: https://vuejs.org/about/releases.html
- npm package page for Vue: https://www.npmjs.com/package/vue

## 5. Solution Overview

Build a Vue 3 single-page app that continues to be served at `/ui/` by the existing FastAPI app. Use a top-level `frontend/` source directory for Vue/Vite code, and emit static build artifacts into the Python package's UI directory for distribution.

Recommended target structure:

```text
frontend/
  package.json
  package-lock.json
  index.html
  vite.config.ts
  vitest.config.ts
  src/
    main.ts
    App.vue
    api/
      caloClient.ts
      types.ts
    components/
      layout/
      loops/
      detail/
      artifacts/
      commands/
      guidance/
      timeline/
    composables/
      useDashboard.ts
      useI18n.ts
      useRepoBrowser.ts
      useCommandWizard.ts
    lib/
      markdown.ts
      format.ts
      loopState.ts
    test/
      fixtures.ts
src/calo/ui/
  index.html
  assets/
    ...
```

The build should keep `/ui/` as the public base path. The backend should keep redirecting `/` to `/ui/`, and `GET /ui/` should serve the built Vue app. During migration, optionally serve a temporary `/ui-next/` route for parity testing before cutting over `/ui/`.

### Key Product Surfaces To Preserve

- Header, language toggle, health indicator, refresh button.
- Goal creation form with Markdown preview.
- Repo dropdown and filesystem browser.
- Runner and external work mode selectors.
- Advanced settings, validation command, long-work command wizard.
- Loop list with status, objective, metrics, progress, and cost estimate.
- Detail view with status notes, current phase, action controls, tabs, and selected loop state.
- Work tab: operator guidance, task graph, TaskRuns, command adapter setup.
- Evidence tab: artifact filters, search, preview, trace metadata.
- Overview tab: Codex sessions and expandable role cards.
- Timeline tab: human-readable event descriptions and payload details.
- Lifecycle actions: start, step, collect callback, pause, resume, cancel, terminate local TaskRun.

### API Boundary

The Vue app should consume the existing API surface:

- `GET /api/v1/context`
- `GET /api/v1/filesystem`
- `GET /api/v1/dashboard`
- `POST /api/v1/goals`
- `POST /api/v1/loops/{loop_id}/start`
- `POST /api/v1/loops/{loop_id}/step`
- `POST /api/v1/loops/{loop_id}/collect-callback`
- `POST /api/v1/loops/{loop_id}/pause`
- `POST /api/v1/loops/{loop_id}/resume`
- `POST /api/v1/loops/{loop_id}/cancel`
- `POST /api/v1/loops/{loop_id}/guidance`
- `POST /api/v1/loops/{loop_id}/task-adapter`
- `POST /api/v1/loops/{loop_id}/runs/{run_id}/terminate`

Backend API behavior is not part of this refactor except where static asset serving and package data must be updated.

## 6. Success Metrics

### Primary Metric

Frontend regression confidence: all current Web UI acceptance behaviors pass after Vue cutover, with additional unit/component tests covering at least the high-risk interaction logic.

Target:

- Existing Python test suite passes.
- Existing browser acceptance test passes against `/ui/`.
- New Vitest suite covers markdown rendering, i18n, action enablement, command wizard validation, artifact filtering, and selected-loop detail rendering.

### Secondary Metrics

- Reduce frontend global rendering file size by replacing `app.js` monolith with cohesive Vue components and composables.
- Keep FastAPI local startup path unchanged: `calo serve --workspace ...` then open `/ui/`.
- Keep generated static assets packageable in the Python wheel/editable install.
- Keep E2E runtime reasonable by moving low-level assertions out of the browser test.

### Guardrail Metrics

- No backend lifecycle contract changes unless explicitly required.
- No loss of bilingual behavior.
- No weakening of command adapter validation around `{callback_file}`.
- No regression in operational-pause semantics: `waiting_callback` loops are not pausable; cancel does not terminate external TaskRuns.
- No dependency on a Node dev server at runtime.

## 7. Requirements And TDD Plan

### Epic Hypothesis

We believe that moving the Web UI to Vue 3 will make CALO safer and faster to evolve because component boundaries and lower-level tests will catch dashboard regressions before they reach the full Playwright acceptance path. We will measure success by passing current browser parity tests, adding focused Vue tests around high-risk UI logic, and keeping `/ui/` behavior stable for local operators.

### TDD Operating Rules

1. Every implementation slice starts by adding or adapting a test that fails for the missing Vue behavior.
2. Prefer unit tests for pure functions, component tests for local interaction, FastAPI tests for static serving, and Playwright only for full workflow confidence.
3. Keep the old static UI available until Vue parity passes, either through a temporary `/ui-next/` route or through branch-local build comparison.
4. Do not delete old behavior until the equivalent Vue tests and browser parity checks are green.
5. Treat generated Vite build artifacts as build output; source of truth is `frontend/src`.

### Phase 0: Baseline And Characterization

Goal: lock the current behavior before migration.

Tests first:

- Run `pytest tests/test_api.py::test_web_ui_static_routes`.
- Run `pytest tests/test_web_browser.py::test_web_buttons_and_action_messages_in_real_browser`.
- Add smaller characterization tests where current E2E assertions are too broad, especially:
  - action enablement for `ready`, `needs_setup`, `waiting_callback`, `paused`, `review_required`, `completed`.
  - command adapter validation requiring `{callback_file}`.
  - markdown preview rendering for headings, lists, tables, inline code, and links.
  - artifact filter behavior.

Acceptance criteria:

- Current tests pass before the first Vue cutover.
- Any intentionally changed assertions are documented in this PRD or follow-up implementation notes.

### Phase 1: Vue/Vite Scaffold Without Product Cutover

Goal: add a Vue app skeleton and test harness without replacing `/ui/`.

Tests first:

- Add `npm test` / `npm run test:unit` running Vitest.
- Add a smoke component test proving `App.vue` mounts.
- Add a build test command `npm run build` that emits static assets.

Implementation:

- Add `frontend/package.json`, lockfile, Vite config, Vitest config, and Vue entrypoint.
- Configure Vite `base` for `/ui/`.
- Decide whether build output goes directly to `src/calo/ui` or to an intermediate directory copied by a script.

Acceptance criteria:

- `cd frontend && npm test` passes.
- `cd frontend && npm run build` passes.
- Existing Python tests still pass or are unchanged while `/ui/` remains on the old UI.

### Phase 2: Shared Pure Logic Port

Goal: move behavior with no backend dependency into tested TypeScript modules.

Tests first:

- `markdown.ts`: tables, fenced code, inline code, escaped HTML, links, lists, blockquotes.
- `format.ts`: date, duration, token estimate, metric text, label formatting.
- `loopState.ts`: status class, next action text, action config, runner text, task adapter text.
- `i18n`: language persistence key `calo.language`, Chinese/English fallback behavior.

Implementation:

- Port pure functions from `app.js` into `frontend/src/lib` and composables.
- Prefer DOMPurify or a conservative renderer if markdown grows beyond current supported subset; for parity, keep the supported subset explicit and tested.

Acceptance criteria:

- Unit tests cover current edge cases.
- No product cutover yet.

### Phase 3: API Client And Dashboard State

Goal: isolate API calls and dashboard polling.

Tests first:

- API client builds correct URLs and query strings for runner/model.
- API client handles non-2xx responses with readable error messages.
- Dashboard state selects the first loop when no selection exists.
- Refresh keeps the selected loop if it still exists.

Implementation:

- Add typed DTOs matching `LoopSummary`, events, artifacts, guidance, context, and filesystem responses.
- Implement `useDashboard`, `useRepoBrowser`, and action submission composables.

Acceptance criteria:

- Component-independent tests pass without FastAPI.
- API endpoint strings remain aligned with existing backend routes.

### Phase 4: Goal Form, Repo Browser, And Command Wizard

Goal: port the left panel and creation workflow.

Tests first:

- Goal form requires objective and repo path.
- Markdown preview updates while typing.
- Runner default changes external work mode as current UI does.
- Repo browser loads directories, handles parent/root/use folder, and shows errors.
- Command wizard generates Python/shell/custom commands and validates `{callback_file}`.

Implementation:

- Components: `GoalForm.vue`, `RepoPicker.vue`, `CommandWizard.vue`, `AdvancedSettings.vue`.
- Keep existing form labels and role-friendly controls so Playwright selectors remain stable.

Acceptance criteria:

- Component tests pass.
- Browser test can still create `browser_loop` after cutover.

### Phase 5: Loop List And Detail Shell

Goal: port selected loop browsing and main detail layout.

Tests first:

- Loop rows render status, objective, turn/metric/cost summary, and progress.
- Clicking a row selects it.
- Detail shell renders empty state when no loop is selected.
- Detail tabs preserve selected tab state.
- Resizable pane behavior persists `calo.leftPaneWidth`.

Implementation:

- Components: `LoopList.vue`, `LoopRow.vue`, `DetailShell.vue`, `DetailTabs.vue`, `ResizableLayout.vue`.

Acceptance criteria:

- Component tests pass.
- Layout remains dense and operator-focused.

### Phase 6: Detail Panels And Lifecycle Actions

Goal: port high-risk operator controls and evidence views.

Tests first:

- Action buttons enable/disable correctly by status.
- Action success and failure messages match current behavior.
- Status disclosures render runner, adapter, and missing artifact warnings.
- Artifact filters combine kind/source/turn/search and clear stale selection.
- Codex session cards open and close focus modal, including Escape handling.
- Guidance form sends revised objective and message.
- Task adapter setup validates command mode and submits configure-and-continue.

Implementation:

- Components: `ActionControls.vue`, `StatusDisclosures.vue`, `OverviewPanel.vue`, `WorkPanel.vue`, `EvidencePanel.vue`, `TimelinePanel.vue`, `ArtifactBrowser.vue`, `CodexSessions.vue`, `GuidanceForm.vue`, `TaskAdapterSetup.vue`.

Acceptance criteria:

- Component tests cover each critical interaction.
- The existing browser test passes through start, operational pause, callback collection, and adapter recovery.

### Phase 7: FastAPI Static Serving Cutover

Goal: serve built Vue artifacts at `/ui/`.

Tests first:

- Update `test_web_ui_static_routes` to assert runtime behavior and built asset serving rather than old function names.
- Add assertions for:
  - `/` redirects to `/ui/`.
  - `/ui/` includes Vue app root and built asset references.
  - `/ui/assets/...` files are served.
  - API routes still respond as before.

Implementation:

- Update package data patterns to include built assets under `src/calo/ui/assets`.
- Replace old static files with Vite output only after parity tests pass.
- Keep source maps out of package unless debugging policy says otherwise.

Acceptance criteria:

- `pytest tests/test_api.py::test_web_ui_static_routes` passes against Vue output.
- `calo serve` works without a Node runtime.

### Phase 8: Playwright Parity And Cleanup

Goal: prove the final user workflow and remove obsolete static UI code.

Tests first:

- Run the existing full browser test.
- If the current test is too monolithic, split it into focused scenarios after parity:
  - language and layout.
  - loop creation and async run.
  - artifacts and timeline.
  - adapter recovery.

Implementation:

- Delete or archive old `app.js` source once Vue source is the source of truth.
- Update README Web UI section if commands or packaging changed.
- Add developer docs for frontend commands.

Acceptance criteria:

- `pytest -q` passes.
- `cd frontend && npm test` passes.
- `cd frontend && npm run build` passes.
- Manual smoke: `calo serve --workspace /tmp/calo-vue-smoke --host 127.0.0.1 --port 8000`, open `/ui/`, create and run a demo loop.

## 8. User Stories And Acceptance Criteria

### Story 1: Preserve Goal Creation

As a local operator, I want to create a loop from a goal brief in the Vue UI, so I can start orchestration without writing contract JSON.

Acceptance criteria:

- Objective Markdown preview renders while typing.
- Repo selection supports dropdown and filesystem browsing.
- Runner, model, target score, max turns, async mode, diff review, and auto commit are submitted correctly.
- Successful create message includes loop ID, runner, and external work mode.

### Story 2: Preserve Loop Operation Controls

As a local operator, I want lifecycle buttons to match the real loop state, so I do not accidentally mutate long-running work.

Acceptance criteria:

- `ready` loops can start/step.
- `waiting_callback` loops show collect callback when ready and do not allow pause.
- `needs_setup` loops disable run controls and show adapter setup.
- Cancel messaging preserves external TaskRun ownership semantics.

### Story 3: Preserve Evidence Inspection

As a local operator, I want to filter and preview artifacts, so I can inspect why the orchestrator made a decision.

Acceptance criteria:

- Artifact list filters by kind, source, turn, and text search.
- Preview panel resets when filters hide the selected artifact.
- Trace metadata remains visible.

### Story 4: Preserve Adapter Recovery

As a local operator, I want to configure a command adapter after a loop stops at setup, so I can continue the accepted turn safely.

Acceptance criteria:

- Command mode rejects commands without `{callback_file}`.
- Wizard can generate Python command with callback/run/turn/loop placeholders.
- Configure-and-continue launches the adapter path and updates loop state.

### Story 5: Maintain Developer Velocity

As a maintainer, I want focused frontend tests, so I can add UI capabilities without relying only on the long browser scenario.

Acceptance criteria:

- Unit/component tests cover pure rendering logic and high-risk interactions.
- E2E remains the final workflow check, not the only safety net.

## 9. Out Of Scope

- Rewriting backend orchestration, policy, store, or TaskRun semantics.
- Replacing FastAPI static serving with a Node runtime in production.
- Full visual redesign beyond necessary componentization and parity polish.
- Multi-page router or auth model.
- Replacing Python pytest/Playwright acceptance coverage with JavaScript-only E2E.
- Migrating the entire Python API schema generation stack unless a later task chooses OpenAPI-based DTO generation.

## 10. Dependencies

- Node and npm available locally. Current observed versions: Node `v22.22.2`, npm `10.9.7`.
- npm registry access to install Vue/Vite/Vitest dependencies.
- Existing Python dev dependencies remain available: pytest, FastAPI TestClient, Playwright.
- Vite build output must be included by Python package data.

## 11. Risks And Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Built assets are not included in the Python package | `/ui/` works locally but fails from installed package | Add package-data tests and inspect wheel/editable install behavior. |
| E2E selectors break during componentization | Browser parity test becomes noisy | Preserve accessible labels and role-based selectors where possible. |
| Vue build adds runtime installation burden | Users expect Python-first local service | Node is build-time only; checked-in or packaged static output serves at runtime. |
| Static route test overfits built filenames | Hashes change every build | Assert asset presence/patterns and HTTP 200, not exact hash names. |
| Markdown behavior changes | Goal brief and artifact previews regress | Port behavior with unit tests before replacing rendering. |
| Command wizard validation regresses | Unsafe TaskRun commands could be accepted | Component tests must cover missing `{callback_file}` and generated commands. |
| i18n parity drifts | Existing Chinese/English UX degrades | Keep translation keys tested and preserve `calo.language`. |

## 12. Open Questions

- Should Vue source live in top-level `frontend/` or inside `src/calo/ui-src/`? Recommendation: top-level `frontend/` to keep Node tooling separate from Python package data.
- Should Vite build output be committed? Recommendation: yes for this Python package unless CI/release automation is added immediately; runtime should not need Node.
- Should `/ui-next/` be used during migration? Recommendation: yes if implementation happens over multiple commits; no if parity cutover can be completed in one controlled PR.
- Should DTOs be handwritten or generated from OpenAPI? Recommendation: handwritten for this refactor, then revisit generation after schema churn stabilizes.
- Should Markdown rendering stay custom or use a library? Recommendation: keep current subset first for parity; evaluate a library only after tests lock behavior.

## 13. Definition Of Done

- Branch `codex/vue-frontend-refactor` contains the Vue refactor work.
- Vue `3.5.39` app builds with Vite and is served at `/ui/`.
- `pytest -q` passes.
- `cd frontend && npm test` passes.
- `cd frontend && npm run build` passes.
- Existing browser workflow passes against the Vue UI.
- README or developer docs document frontend commands.
- Old vanilla JS source is no longer the behavioral source of truth.
- No backend lifecycle semantics regress.

## 14. Proposed Task Backlog

1. Baseline tests: run current Web UI tests and add characterization coverage for pure/high-risk logic.
2. Scaffold Vue/Vite/Vitest with TypeScript.
3. Port markdown, formatters, i18n, and loop-state logic with unit tests.
4. Build typed API client and dashboard composables with mocked fetch tests.
5. Port goal form, repo picker, and command wizard with component tests.
6. Port loop list, resizable layout, and detail shell.
7. Port overview/work/evidence/timeline panels and lifecycle controls.
8. Cut over FastAPI static serving to Vite build output.
9. Run browser parity, split monolithic E2E if helpful, and clean obsolete static implementation.
10. Update README and package-data docs.
