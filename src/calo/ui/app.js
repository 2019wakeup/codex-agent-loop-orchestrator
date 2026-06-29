const state = {
  loops: [],
  selectedLoopId: null,
  defaultRepoPath: "",
  runner: "local",
  model: "",
  actionMessage: "",
  actionMessageKind: "",
  repoOptions: [],
  repoBrowserPath: "",
};

const paneResize = {
  min: 340,
  max: 720,
  rightMin: 480,
  splitter: 16,
  storageKey: "calo.leftPaneWidth",
};

const els = {
  layout: document.querySelector(".layout"),
  layoutSplitter: document.querySelector("#layout-splitter"),
  health: document.querySelector("#health"),
  refresh: document.querySelector("#refresh"),
  goalForm: document.querySelector("#goal-form"),
  goalMessage: document.querySelector("#goal-message"),
  goalSubmit: document.querySelector("#goal-submit"),
  goalRepo: document.querySelector("#goal-repo"),
  repoBrowseToggle: document.querySelector("#repo-browse-toggle"),
  repoBrowser: document.querySelector("#repo-browser"),
  repoBrowserPath: document.querySelector("#repo-browser-path"),
  repoBrowserList: document.querySelector("#repo-browser-list"),
  repoBrowserMessage: document.querySelector("#repo-browser-message"),
  repoParent: document.querySelector("#repo-parent"),
  repoRoot: document.querySelector("#repo-root"),
  repoUse: document.querySelector("#repo-use"),
  goalRunner: document.querySelector("#goal-runner"),
  goalTaskAdapter: document.querySelector("#goal-task-adapter"),
  adapterHelp: document.querySelector("#adapter-help"),
  adapterCommandFields: document.querySelector("#adapter-command-fields"),
  goalValidationCommand: document.querySelector("#goal-validation-command"),
  goalTaskCommand: document.querySelector("#goal-task-command"),
  goalModel: document.querySelector("#goal-model"),
  loops: document.querySelector("#loops"),
  loopCount: document.querySelector("#loop-count"),
  detailTitle: document.querySelector("#detail-title"),
  detailStatus: document.querySelector("#detail-status"),
  detail: document.querySelector("#detail"),
  rowTemplate: document.querySelector("#loop-row-template"),
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function paneBounds() {
  if (!els.layout) return { min: paneResize.min, max: paneResize.max };
  const style = window.getComputedStyle(els.layout);
  const contentWidth =
    els.layout.clientWidth - Number.parseFloat(style.paddingLeft || "0") - Number.parseFloat(style.paddingRight || "0");
  const safeMax = Math.min(paneResize.max, contentWidth - paneResize.splitter - paneResize.rightMin);
  return { min: paneResize.min, max: Math.max(paneResize.min, safeMax) };
}

function setLeftPaneWidth(width, persist = false) {
  if (!els.layout || !els.layoutSplitter) return;
  const { min, max } = paneBounds();
  const next = Math.round(clamp(width, min, max));
  els.layout.style.setProperty("--left-pane-width", `${next}px`);
  els.layoutSplitter.setAttribute("aria-valuemin", `${min}`);
  els.layoutSplitter.setAttribute("aria-valuemax", `${max}`);
  els.layoutSplitter.setAttribute("aria-valuenow", `${next}`);
  if (persist) window.localStorage.setItem(paneResize.storageKey, `${next}`);
}

function initLayoutResize() {
  if (!els.layout || !els.layoutSplitter) return;
  const saved = Number(window.localStorage.getItem(paneResize.storageKey));
  setLeftPaneWidth(Number.isFinite(saved) && saved > 0 ? saved : 520);

  let resizing = false;
  const resizeFromClientX = (clientX, persist = false) => {
    const rect = els.layout.getBoundingClientRect();
    const style = window.getComputedStyle(els.layout);
    const paddingLeft = Number.parseFloat(style.paddingLeft || "0");
    setLeftPaneWidth(clientX - rect.left - paddingLeft, persist);
  };
  const finishResize = (event) => {
    if (!resizing) return;
    resizing = false;
    els.layout.classList.remove("is-resizing");
    resizeFromClientX(event.clientX, true);
  };

  els.layoutSplitter.addEventListener("pointerdown", (event) => {
    resizing = true;
    els.layout.classList.add("is-resizing");
    els.layoutSplitter.setPointerCapture(event.pointerId);
    resizeFromClientX(event.clientX);
  });
  els.layoutSplitter.addEventListener("pointermove", (event) => {
    if (resizing) resizeFromClientX(event.clientX);
  });
  els.layoutSplitter.addEventListener("pointerup", finishResize);
  els.layoutSplitter.addEventListener("pointercancel", finishResize);
  els.layoutSplitter.addEventListener("keydown", (event) => {
    const current = Number(els.layoutSplitter.getAttribute("aria-valuenow") || "520");
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setLeftPaneWidth(current - 24, true);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setLeftPaneWidth(current + 24, true);
    } else if (event.key === "Home") {
      event.preventDefault();
      setLeftPaneWidth(paneBounds().min, true);
    } else if (event.key === "End") {
      event.preventDefault();
      setLeftPaneWidth(paneBounds().max, true);
    }
  });
  window.addEventListener("resize", () => {
    const current = Number(els.layoutSplitter.getAttribute("aria-valuenow") || "520");
    setLeftPaneWidth(current, true);
  });
}

function statusClass(status) {
  return `status ${status || "neutral"}`;
}

function escapeHtml(value) {
  return `${value ?? ""}`.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char];
  });
}

function formatValue(value, fallback = "n/a") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number") return Number.isInteger(value) ? `${value}` : value.toFixed(3);
  return `${value}`;
}

function formatDate(value) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatDuration(seconds) {
  const total = Number(seconds || 0);
  if (!Number.isFinite(total) || total <= 0) return "0s";
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = Math.floor(total % 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatTokens(value) {
  const count = Number(value || 0);
  if (!Number.isFinite(count) || count <= 0) return "0";
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return `${Math.round(count)}`;
}

function formatTokenEstimate(loop) {
  const used = formatTokens(loop.estimated_codex_tokens);
  const budget = loop.token_budget_hint ? formatTokens(loop.token_budget_hint) : null;
  return budget ? `${used} / ${budget}` : used;
}

function labelize(value) {
  return `${value || "unknown"}`.replaceAll("_", " ");
}

function runnerText(loopOrKind, fallbackModel = "") {
  const kind = typeof loopOrKind === "string" ? loopOrKind : loopOrKind?.runner_kind;
  const model = typeof loopOrKind === "string" ? fallbackModel : loopOrKind?.runner_model;
  const label = kind === "codex-cli" ? "Real Codex CLI" : "Demo simulation";
  return model ? `${label} · ${model}` : label;
}

function taskAdapterText(mode) {
  const labels = {
    none: "No long-work adapter",
    command: "Command adapter",
    demo: "Demo score adapter",
  };
  return labels[mode] || labelize(mode);
}

function syncTaskAdapterFields() {
  if (!els.goalTaskAdapter || !els.adapterCommandFields || !els.adapterHelp) return;
  const mode = els.goalTaskAdapter.value || "none";
  const runner = els.goalRunner?.value || state.runner || "codex-cli";
  const showCommands = mode === "command" || mode === "demo";
  els.adapterCommandFields.hidden = !showCommands;
  if (mode === "none") {
    els.adapterHelp.textContent =
      "No long-work adapter is configured. CALO can run a short Codex turn, then stops before launching external work.";
    if (els.goalValidationCommand) els.goalValidationCommand.value = "";
    if (els.goalTaskCommand) els.goalTaskCommand.value = "";
  } else if (mode === "demo") {
    els.adapterHelp.textContent =
      "Demo mode writes a tiny score fixture and fake training script. Use it only to learn the lifecycle, not for real tasks.";
    if (els.goalValidationCommand && !els.goalValidationCommand.value.trim()) {
      els.goalValidationCommand.value = "python -m py_compile target_app.py";
    }
    if (els.goalTaskCommand && !els.goalTaskCommand.value.trim()) {
      els.goalTaskCommand.value =
        "python fake_train.py --callback-file {callback_file} --run-id {run_id} --turn-id {turn_id}";
    }
  } else {
    els.adapterHelp.textContent =
      "Command mode launches your real external work after a Codex turn. The command must write the callback file.";
    if (runner === "local") {
      els.adapterHelp.textContent += " Local backend still uses the deterministic demo Codex runner for Planner, Worker, and Judge.";
    }
    if (els.goalTaskCommand && els.goalTaskCommand.value.includes("fake_train.py")) {
      els.goalTaskCommand.value = "";
    }
  }
}

function syncRunnerDefaults() {
  if (!els.goalRunner || !els.goalTaskAdapter) return;
  const runner = els.goalRunner.value;
  if (runner === "local") {
    els.goalTaskAdapter.value = "demo";
  } else if (els.goalTaskAdapter.value === "demo") {
    els.goalTaskAdapter.value = "none";
  }
  syncTaskAdapterFields();
}

function runnerEvidence(payload) {
  return renderChips([
    { label: "backend", value: payload.runner_label || runnerText(payload.runner_kind) },
    { label: "mode", value: payload.runner_is_simulated ? "simulation" : "real Codex" },
    { label: "model", value: payload.runner_model },
    { label: "last message", value: payload.last_message_path },
  ]);
}

function shortSha(value) {
  if (!value) return null;
  return `${value}`.slice(0, 7);
}

function metricText(metrics) {
  if (!metrics || typeof metrics !== "object") return null;
  return Object.entries(metrics)
    .map(([key, value]) => `${key} ${formatValue(value)}`)
    .join(", ");
}

function renderTaskGraph(graph) {
  if (!graph || !graph.nodes || !graph.nodes.length) {
    return '<div class="empty-timeline">No task graph has been recorded yet.</div>';
  }
  return `
    <div class="task-graph">
      <div class="task-graph-head">
        <strong>${escapeHtml(graph.turn_id)}</strong>
        <span>${escapeHtml(graph.nodes.length)} tasks</span>
      </div>
      ${graph.nodes
        .map(
          (node) => `
            <article class="task-node">
              <div>
                <strong>${escapeHtml(node.id)}</strong>
                <span>${escapeHtml(labelize(node.type))}</span>
              </div>
              <p>${escapeHtml(node.instruction)}</p>
              <div class="chip-row">
                ${renderChips([
                  { label: "status", value: labelize(node.status) },
                  { label: "files", value: (node.target_files || []).join(", ") },
                ])}
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderTaskRuns(taskRuns) {
  if (!taskRuns || !taskRuns.length) {
    return '<div class="empty-timeline">No TaskRuns have been recorded yet.</div>';
  }
  return `
    <div class="task-runs">
      ${taskRuns
        .map(
          (run) => `
            <article class="task-run">
              <div class="task-run-main">
                <strong>${escapeHtml(run.run_id)}</strong>
                <span class="${statusClass(run.status)}">${escapeHtml(labelize(run.status))}</span>
              </div>
              <div class="chip-row">
                ${renderChips([
                  { label: "turn", value: run.turn_id },
                  { label: "owner", value: run.owner },
                  { label: "pid", value: run.pid },
                  { label: "control", value: labelize(run.external_task_control) },
                  { label: "wake", value: run.wake_path },
                ])}
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderCodexSessions(events) {
  const byType = new Map((events || []).map((event) => [event.event_type, event]));
  const sessions = [
    {
      role: "Planner",
      started: byType.get("codex.planner.started"),
      completed: byType.get("codex.planner.completed"),
      artifactKey: "plan_path",
      body: "Scopes the next turn and writes the task graph.",
    },
    {
      role: "Worker",
      started: byType.get("codex.worker.started"),
      completed: byType.get("codex.worker.completed"),
      artifactKey: null,
      body: "Applies the approved source changes for this turn.",
    },
    {
      role: "Judge",
      started: null,
      completed: byType.get("codex.judge.completed"),
      artifactKey: null,
      body: "Reviews evidence and produces an advisory verdict.",
    },
  ];
  if (!events || !events.length) {
    return '<div class="empty-timeline">No Codex role session has been recorded yet.</div>';
  }
  return `
    <div class="codex-sessions">
      ${sessions
        .map((session) => {
          const completed = session.completed?.payload || null;
          const started = session.started?.payload || null;
          const payload = completed || started || {};
          const status = completed ? "completed" : started ? "running" : "not started";
          const artifact = session.artifactKey ? payload[session.artifactKey] : payload.last_message_path;
          return `
            <article class="codex-session">
              <div class="codex-session-head">
                <strong>${escapeHtml(session.role)}</strong>
                <span class="${statusClass(status === "completed" ? "ready" : status === "running" ? "codex_running" : "neutral")}">${escapeHtml(status)}</span>
              </div>
              <p>${escapeHtml(session.body)}</p>
              <div class="chip-row">
                ${renderChips([
                  { label: "backend", value: payload.runner_label || (payload.runner_kind ? runnerText(payload.runner_kind) : null) },
                  { label: "turn", value: payload.turn_id },
                  { label: "artifact", value: artifact },
                  { label: "last message", value: payload.last_message_path },
                ])}
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderArtifacts(artifacts) {
  if (!artifacts || !artifacts.length) {
    return '<div class="empty-timeline">No artifacts are available yet.</div>';
  }
  return `
    <div class="artifact-list">
      ${artifacts
        .map(
          (artifact) => `
            <details class="artifact-entry">
              <summary>
                <span>${escapeHtml(artifact.path)}</span>
                <small>${escapeHtml(labelize(artifact.kind))} · ${escapeHtml(formatValue(artifact.size_bytes))} bytes</small>
              </summary>
              <pre>${escapeHtml(artifact.preview || "Preview not available for this file type.")}</pre>
            </details>
          `
        )
        .join("")}
    </div>
  `;
}

function renderOperatorGuidance(guidanceItems) {
  if (!guidanceItems || !guidanceItems.length) {
    return '<div class="empty-timeline">No operator guidance has been submitted yet.</div>';
  }
  return `
    <div class="guidance-list">
      ${guidanceItems
        .map(
          (item) => `
            <article class="guidance-entry">
              <div class="guidance-entry-head">
                <strong>${escapeHtml(labelize(item.applies_to))}</strong>
                <time>${escapeHtml(formatDate(item.created_at))}</time>
              </div>
              <p>${escapeHtml(item.message)}</p>
              ${
                item.revised_objective
                  ? `<div class="guidance-revision"><span>Revised objective</span><strong>${escapeHtml(item.revised_objective)}</strong></div>`
                  : ""
              }
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function statusInsight(loop) {
  const target = `${loop.target_metric} ${formatValue(loop.target_value)}`;
  const messages = {
    ready: ["Ready to start", "The orchestrator can run the next Codex turn when you start it."],
    needs_setup: [
      "TaskRun adapter required",
      "A Codex turn has produced evidence, but CALO stopped before committing or launching long work because no adapter is configured.",
    ],
    planning: ["Planning next change", "Codex is producing a scoped plan; lifecycle control remains with the orchestrator."],
    codex_running: ["Applying code changes", "The Worker role is executing the approved plan."],
    validation_running: ["Running validation", "Fast checks are running before expensive work is launched."],
    judging: ["Evaluating evidence", "The Judge role is scoring results and recommending a policy decision."],
    policy_checking: ["Checking policy", "The Policy Engine is deciding whether to continue, pause, or complete."],
    training_running: ["Training is running", "Codex is idle while the external command does the long work."],
    waiting_callback: ["Operational pause", "Codex is not monitoring. The external owner must write or post the wake result."],
    review_required: ["Human review required", "A gate or risk condition needs review before the loop continues."],
    paused: ["Paused", "Resume when you are ready for the orchestrator to continue."],
    completed: ["Target reached", `The loop met its objective for ${target}.`],
    failed: ["Failed", "Inspect the latest event details and artifacts before retrying."],
    cancelled: ["Cancelled", "This loop was stopped by a user action."],
  };
  return messages[loop.status] || ["Status update", "The orchestrator is tracking this loop."];
}

function nextActionText(loop) {
  const actions = {
    ready: "Start the run or step one turn.",
    needs_setup: "Choose a command adapter or cancel this loop; no external task is running.",
    training_running: "Wait for training to finish.",
    waiting_callback: loop.callback_ready ? "Collect the callback from the wake path." : "Wait until the wake path exists.",
    paused: "Resume the loop when ready.",
    review_required: "Review artifacts, then resume if acceptable.",
    completed: "Read the final report or create a new loop.",
    failed: "Inspect artifacts, fix the cause, then start again.",
    cancelled: "No further action is scheduled.",
  };
  return actions[loop.status] || "Monitor the current orchestrator phase.";
}

function renderChips(chips) {
  return chips
    .filter((chip) => chip.value !== null && chip.value !== undefined && chip.value !== "")
    .map((chip) => `<span class="chip"><span>${escapeHtml(chip.label)}</span>${escapeHtml(chip.value)}</span>`)
    .join("");
}

function flattenPayload(value, prefix = "") {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    if (!value.length) return [[prefix, "none"]];
    return value.flatMap((item, index) => flattenPayload(item, `${prefix} ${index + 1}`.trim()));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) return [[prefix, "none"]];
    return entries.flatMap(([key, nested]) => flattenPayload(nested, `${prefix} ${labelize(key)}`.trim()));
  }
  return [[prefix, formatValue(value, "")]];
}

function renderPayloadDetails(payload) {
  const entries = flattenPayload(payload);
  if (!entries.length) return "";
  const rows = entries
    .map(([key, value]) => `<div class="detail-row"><span>${escapeHtml(labelize(key))}</span><code>${escapeHtml(value)}</code></div>`)
    .join("");
  return `<details class="event-details"><summary>Details</summary>${rows}</details>`;
}

function describeEvent(event) {
  const payload = event.payload || {};
  const type = event.event_type;
  const fallback = {
    title: labelize(type),
    body: "The orchestrator recorded a lifecycle event.",
    chips: [{ label: "type", value: type }],
  };
  const descriptions = {
    "loop.created": {
      title: "Loop contract created",
      body: "The orchestrator registered this loop and saved its contract.",
      chips: [{ label: "contract", value: payload.contract_path }],
    },
    "codex.planner.completed": {
      title: "Planner finished",
      body: payload.runner_is_simulated
        ? "The local demo runner generated a deterministic plan. No real Codex session was used."
        : "Codex CLI produced the next scoped plan for the Worker role.",
      chips: [
        { label: "turn", value: payload.turn_id },
        { label: "plan", value: payload.plan_path },
        { label: "task graph", value: payload.task_graph_path },
      ],
    },
    "codex.worker.completed": {
      title: "Worker finished",
      body: payload.runner_is_simulated
        ? "The local demo runner applied deterministic fixture changes."
        : "Codex CLI applied the proposed code or artifact changes for this turn.",
      chips: [
        { label: "turn", value: payload.turn_id },
        { label: "changed", value: (payload.changed_files || []).join(", ") },
      ],
    },
    "codex.judge.completed": {
      title: "Judge finished",
      body: payload.runner_is_simulated
        ? "The local demo runner produced a deterministic judge verdict."
        : "Codex CLI evaluated evidence and wrote an advisory decision.",
      chips: [
        { label: "turn", value: payload.turn_id },
        { label: "verdict", value: labelize(payload.verdict) },
      ],
    },
    "validation.completed": {
      title: payload.passed ? "Validation passed" : "Validation failed",
      body: payload.passed ? "Fast checks passed before training launch." : "Fast checks failed; training should not launch.",
      chips: [{ label: "turn", value: payload.turn_id }],
    },
    "policy.checked": {
      title: "Policy checked",
      body: payload.reason || "The Policy Engine evaluated the latest evidence.",
      chips: [
        { label: "decision", value: labelize(payload.decision) },
        { label: "next", value: labelize(payload.next_status) },
        { label: "continue", value: payload.should_continue === undefined ? null : payload.should_continue ? "yes" : "no" },
        { label: "commit", value: payload.should_commit === undefined ? null : payload.should_commit ? "yes" : "no" },
        {
          label: "training",
          value: payload.should_launch_training === undefined ? null : payload.should_launch_training ? "launch" : "skip",
        },
      ],
    },
    "git.commit.created": {
      title: "Change committed",
      body: "The orchestrator committed accepted source changes for auditability.",
      chips: [
        { label: "turn", value: payload.turn_id },
        { label: "sha", value: shortSha(payload.sha) },
      ],
    },
    "run.started": {
      title: "TaskRun started",
      body: "Long-running work was launched outside the Codex turn.",
      chips: [
        { label: "run", value: payload.run_id },
        { label: "turn", value: payload.turn_id },
        { label: "pid", value: payload.pid },
      ],
    },
    "run.launched_async": {
      title: "TaskRun handed to external owner",
      body: "The async task has an owner and wake path, so the orchestrator can pause Codex work.",
      chips: [
        { label: "run", value: payload.run_id },
        { label: "owner", value: payload.owner },
        { label: "wake", value: payload.wake_path },
        { label: "control", value: labelize(payload.codex_control) },
      ],
    },
    "loop.operational_pause": {
      title: "Operational pause entered",
      body: payload.reason || "Codex control has been released until a wake event arrives.",
      chips: [
        { label: "run", value: payload.run_id },
        { label: "owner", value: payload.owner },
        { label: "wake", value: payload.wake_path },
        { label: "control", value: labelize(payload.codex_control) },
      ],
    },
    "run.launch_failed": {
      title: "TaskRun launch blocked",
      body: payload.reason || "The orchestrator refused to enter operational pause without a durable owner and wake path.",
      chips: [
        { label: "run", value: payload.run_id },
        { label: "manifest", value: payload.manifest_path },
      ],
    },
    "task.adapter.required": {
      title: "TaskRun adapter required",
      body:
        payload.reason ||
        "The orchestrator refused to launch long-running work because this loop has no TaskRun adapter.",
      chips: [
        { label: "turn", value: payload.turn_id },
        { label: "adapter", value: taskAdapterText(payload.task_adapter_mode) },
        { label: "next", value: payload.next_step },
      ],
    },
    "run.completed": {
      title: `Training run ${labelize(payload.status || "completed")}`,
      body: payload.summary || "The training callback was recorded.",
      chips: [
        { label: "run", value: payload.run_id },
        { label: "turn", value: payload.turn_id },
        { label: "metrics", value: metricText(payload.metrics) },
        { label: "error", value: payload.error },
      ],
    },
    "run.callback.duplicate": {
      title: "Duplicate callback ignored",
      body: "This run result had already been processed, so the orchestrator kept state unchanged.",
      chips: [{ label: "run", value: payload.run_id }],
    },
    "loop.callback.handled": {
      title: "Callback processed",
      body: "The orchestrator updated loop state from the training result.",
      chips: [
        { label: "turn", value: payload.turn_id },
        { label: "decision", value: labelize(payload.decision) },
      ],
    },
    "operator.guidance.submitted": {
      title: payload.revised_objective ? "Goal guidance submitted" : "Operator guidance submitted",
      body: payload.revised_objective
        ? "The loop objective was revised and the next Codex turn will receive this guidance."
        : "The next Codex turn will receive this operator instruction in its evidence packet.",
      chips: [
        { label: "applies", value: labelize(payload.applies_to) },
        { label: "artifact", value: payload.artifact_path },
      ],
    },
    "loop.paused": {
      title: "Loop paused",
      body: "Orchestrator execution is stopped until a resume command is received.",
      chips: [],
    },
    "loop.resumed": {
      title: "Loop resumed",
      body: "The orchestrator can continue from its stored state.",
      chips: [],
    },
    "loop.cancelled": {
      title: "Loop cancelled",
      body:
        payload.external_task_control === "not_terminated"
          ? "Orchestration was cancelled. The external TaskRun was not terminated and remains with its owner."
          : "The orchestrator will not schedule more turns for this loop.",
      chips: [
        { label: "run", value: payload.run_id },
        { label: "owner", value: payload.owner },
        { label: "external control", value: labelize(payload.external_task_control) },
      ],
    },
  };
  const description = { ...fallback, ...(descriptions[type] || {}) };
  if (payload.runner_kind) {
    description.chips = [...(description.chips || []), { label: "backend", value: payload.runner_label || runnerText(payload.runner_kind) }];
  }
  return description;
}

function renderEvents(events) {
  if (!events.length) {
    return '<div class="empty-timeline">No lifecycle events have been recorded yet.</div>';
  }
  return events
    .map((event) => {
      const description = describeEvent(event);
      return `
        <article class="event">
          <time class="event-time">${escapeHtml(formatDate(event.created_at))}</time>
          <div class="event-copy">
            <div class="event-title">${escapeHtml(description.title)}</div>
            <div class="event-body">${escapeHtml(description.body)}</div>
            <div class="chip-row">${renderChips(description.chips || [])}</div>
            ${renderPayloadDetails(event.payload)}
          </div>
        </article>
      `;
    })
    .join("");
}

function actionConfig(loop) {
  const status = loop.status;
  const activeStates = new Set([
    "planning",
    "codex_running",
    "validation_running",
    "judging",
    "policy_checking",
    "training_running",
    "waiting_callback",
    "review_required",
    "needs_setup",
  ]);
  const terminalStates = new Set(["completed", "cancelled"]);
  return {
    start: !terminalStates.has(status) && !activeStates.has(status) && status !== "paused",
    step: status === "ready",
    collect: status === "waiting_callback" && loop.callback_ready === true,
    pause: !terminalStates.has(status) && status !== "paused" && status !== "waiting_callback" && status !== "needs_setup",
    resume: status === "paused" || status === "review_required",
    cancel: !terminalStates.has(status),
    terminate: ["training_running", "waiting_callback"].includes(status) && Boolean(loop.last_run_id),
  };
}

async function loadDashboard() {
  try {
    els.health.textContent = "Connected";
    els.health.className = "health ok";
    const response = await fetch("/api/v1/dashboard", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.loops = await response.json();
    if (!state.selectedLoopId && state.loops.length) {
      state.selectedLoopId = state.loops[0].loop_id;
    }
    if (state.selectedLoopId && !state.loops.some((loop) => loop.loop_id === state.selectedLoopId)) {
      state.selectedLoopId = state.loops[0]?.loop_id || null;
    }
    render();
  } catch (error) {
    els.health.textContent = "Disconnected";
    els.health.className = "health error";
    els.detail.innerHTML = `<div class="detail-empty">Unable to load dashboard: ${escapeHtml(error.message)}</div>`;
  }
}

function runnerQuery(loop = null) {
  const params = new URLSearchParams();
  const runner = loop?.runner_kind || state.runner || els.goalRunner?.value || "";
  const model = loop?.runner_model || state.model || "";
  if (runner) params.set("runner", runner);
  if (model) params.set("model", model);
  const query = params.toString();
  return query ? `?${query}` : "";
}

async function postAction(loop, action) {
  const loopId = encodeURIComponent(loop.loop_id);
  const path =
    action === "terminate-run"
      ? `/api/v1/loops/${loopId}/runs/${encodeURIComponent(loop.last_run_id)}/terminate${runnerQuery(loop)}`
      : `/api/v1/loops/${loopId}/${action}${runnerQuery(loop)}`;
  const response = await fetch(path, { method: "POST" });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `${action} failed with HTTP ${response.status}`);
  }
  return response.json();
}

function setGoalMessage(message, kind = "") {
  els.goalMessage.textContent = message;
  els.goalMessage.className = `form-message ${kind}`.trim();
}

async function loadContext() {
  try {
    const response = await fetch("/api/v1/context", { cache: "no-store" });
    if (!response.ok) return;
    const context = await response.json();
    state.defaultRepoPath = context.default_repo_path || "";
    state.repoOptions = context.repo_options || [];
    state.runner = context.runner || "local";
    renderRepoOptions();
    if (state.defaultRepoPath && els.goalRepo) {
      els.goalRepo.value = state.defaultRepoPath;
    }
    if (els.goalRunner) els.goalRunner.value = state.runner;
    syncRunnerDefaults();
  } catch (_error) {
    // The dashboard can still operate without context defaults.
  }
}

function renderRepoOptions() {
  if (!els.goalRepo) return;
  const options = state.repoOptions.length
    ? state.repoOptions
    : [{ label: "Workspace", path: state.defaultRepoPath || "" }];
  els.goalRepo.innerHTML = options
    .filter((option) => option.path)
    .map((option) => `<option value="${escapeHtml(option.path)}">${escapeHtml(option.label)} - ${escapeHtml(option.path)}</option>`)
    .join("");
}

function selectRepoPath(path, label = "Selected folder") {
  if (!els.goalRepo || !path) return;
  const exists = Array.from(els.goalRepo.options).some((option) => option.value === path);
  if (!exists) {
    const option = document.createElement("option");
    option.value = path;
    option.textContent = `${label} - ${path}`;
    els.goalRepo.appendChild(option);
  }
  els.goalRepo.value = path;
}

function setRepoBrowserMessage(message, kind = "") {
  if (!els.repoBrowserMessage) return;
  els.repoBrowserMessage.textContent = message;
  els.repoBrowserMessage.className = `form-message ${kind}`.trim();
}

async function loadRepoDirectory(path) {
  if (!els.repoBrowser || !els.repoBrowserList || !els.repoBrowserPath) return;
  const params = new URLSearchParams();
  if (path) params.set("path", path);
  els.repoBrowserList.innerHTML = '<div class="empty-timeline">Loading directories...</div>';
  setRepoBrowserMessage("");
  try {
    const response = await fetch(`/api/v1/filesystem?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }
    const directory = await response.json();
    state.repoBrowserPath = directory.path;
    els.repoBrowserPath.textContent = directory.path;
    els.repoParent.disabled = !directory.parent;
    els.repoParent.dataset.path = directory.parent || "";
    els.repoBrowserList.innerHTML = directory.entries.length
      ? directory.entries
          .map(
            (entry) => `
              <button class="repo-dir" type="button" data-path="${escapeHtml(entry.path)}" role="listitem">
                <span aria-hidden="true">/</span>
                <span>${escapeHtml(entry.name)}</span>
              </button>
            `
          )
          .join("")
      : '<div class="empty-timeline">No readable child directories.</div>';
    els.repoBrowserList.querySelectorAll(".repo-dir").forEach((button) => {
      button.addEventListener("click", () => loadRepoDirectory(button.dataset.path));
    });
  } catch (error) {
    els.repoBrowserList.innerHTML = '<div class="empty-timeline">Directory could not be opened.</div>';
    setRepoBrowserMessage(error.message, "error");
  }
}

function initRepoBrowser() {
  if (
    !els.repoBrowseToggle ||
    !els.repoBrowser ||
    !els.repoParent ||
    !els.repoRoot ||
    !els.repoUse ||
    !els.goalRepo
  ) {
    return;
  }
  els.repoBrowseToggle.addEventListener("click", () => {
    const opening = els.repoBrowser.hidden;
    els.repoBrowser.hidden = !opening;
    els.repoBrowseToggle.textContent = opening ? "Hide" : "Browse";
    if (opening) loadRepoDirectory(els.goalRepo.value || state.defaultRepoPath);
  });
  els.repoParent.addEventListener("click", () => {
    if (els.repoParent.dataset.path) loadRepoDirectory(els.repoParent.dataset.path);
  });
  els.repoRoot.addEventListener("click", () => loadRepoDirectory("/"));
  els.repoUse.addEventListener("click", () => {
    selectRepoPath(state.repoBrowserPath, "Browsed folder");
    setRepoBrowserMessage("Repository folder selected.", "success");
  });
  els.goalRepo.addEventListener("change", () => {
    if (!els.repoBrowser.hidden) loadRepoDirectory(els.goalRepo.value);
  });
}

async function submitGoal(event) {
  event.preventDefault();
  const formData = new FormData(els.goalForm);
  const objective = `${formData.get("objective") || ""}`.trim();
  const repoPath = `${formData.get("repo_path") || ""}`.trim();
  const loopId = `${formData.get("loop_id") || ""}`.trim();
  const targetMetric = `${formData.get("target_metric") || "score"}`.trim() || "score";
  const targetValue = Number(formData.get("target_value"));
  const maxTurns = Number.parseInt(`${formData.get("max_turns") || "3"}`, 10);
  const patienceRaw = `${formData.get("patience") || ""}`.trim();
  const patience = patienceRaw ? Number.parseInt(patienceRaw, 10) : null;
  const minDelta = Number(formData.get("min_delta"));
  const validationCommand = `${formData.get("validation_command") || ""}`.trim();
  const taskCommand = `${formData.get("task_command") || ""}`.trim();
  const taskAdapterMode = `${formData.get("task_adapter_mode") || "none"}`;
  state.runner = `${formData.get("runner") || "local"}`;
  state.model = `${formData.get("model") || ""}`.trim();

  if (!objective || !repoPath) {
    setGoalMessage("Goal brief and repository selection are required.", "error");
    return;
  }
  if (taskAdapterMode === "command" && !taskCommand) {
    setGoalMessage("Command adapter needs a long-work adapter command.", "error");
    return;
  }

  const payload = {
    objective,
    repo_path: repoPath,
    loop_id: loopId || null,
    target_metric: targetMetric,
    target_value: Number.isFinite(targetValue) ? targetValue : 0.7,
    max_turns: Number.isFinite(maxTurns) ? maxTurns : 3,
    patience: Number.isFinite(patience) ? patience : null,
    min_delta: Number.isFinite(minDelta) ? minDelta : 0.001,
    validation_command: validationCommand || null,
    task_adapter_mode: taskAdapterMode,
    task_command: taskCommand || null,
    execution_mode: formData.get("async") ? "async" : "sync",
    require_diff_review: Boolean(formData.get("require_diff_review")),
    auto_commit: Boolean(formData.get("auto_commit")),
    runner_kind: state.runner,
    runner_model: state.model || null,
  };

  els.goalSubmit.disabled = true;
  setGoalMessage("Creating loop...");
  try {
    const response = await fetch("/api/v1/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }
    const created = await response.json();
    state.selectedLoopId = created.loop_id;
    els.goalForm.reset();
    renderRepoOptions();
    if (state.defaultRepoPath) els.goalRepo.value = state.defaultRepoPath;
    if (els.goalRunner) els.goalRunner.value = state.runner;
    if (els.goalTaskAdapter) els.goalTaskAdapter.value = taskAdapterMode;
    if (els.goalModel) els.goalModel.value = state.model;
    syncTaskAdapterFields();
    state.actionMessage = `Created with ${runnerText(state.runner, state.model)} and ${taskAdapterText(taskAdapterMode)}. Select Start or Step to run the first turn.`;
    state.actionMessageKind = "success";
    setGoalMessage(`Created ${created.loop_id} with ${runnerText(state.runner, state.model)} and ${taskAdapterText(taskAdapterMode)}.`, "success");
    await loadDashboard();
  } catch (error) {
    setGoalMessage(`Create failed: ${error.message}`, "error");
  } finally {
    els.goalSubmit.disabled = false;
  }
}

async function submitGuidance(loop) {
  const messageInput = els.detail.querySelector("#guidance-message");
  const objectiveInput = els.detail.querySelector("#guidance-objective");
  const appliesInput = els.detail.querySelector("#guidance-applies");
  const message = messageInput.value.trim();
  const revisedObjective = objectiveInput.value.trim();
  if (!message) {
    state.actionMessage = "Guidance failed: write an instruction for the next Codex turn.";
    state.actionMessageKind = "error";
    renderDetail(loop);
    return;
  }
  const payload = {
    message,
    applies_to: appliesInput.value || "next_turn",
    revised_objective: revisedObjective || null,
  };
  const response = await fetch(`/api/v1/loops/${encodeURIComponent(loop.loop_id)}/guidance${runnerQuery(loop)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `guidance failed with HTTP ${response.status}`);
  }
  return response.json();
}

function render() {
  els.loopCount.textContent = `${state.loops.length}`;
  els.loops.innerHTML = "";
  for (const loop of state.loops) {
    const row = els.rowTemplate.content.firstElementChild.cloneNode(true);
    row.classList.toggle("active", loop.loop_id === state.selectedLoopId);
    row.querySelector(".loop-id").textContent = loop.loop_id;
    const status = row.querySelector(".status");
    status.textContent = labelize(loop.status);
    status.className = statusClass(loop.status);
    row.querySelector(".objective").textContent = loop.objective;
    row.querySelector(".turns").textContent = `Turn ${loop.turn}/${loop.max_turns}`;
    row.querySelector(".metric").textContent = `${loop.target_metric}: ${formatValue(loop.best_metric)} / ${formatValue(loop.target_value)}`;
    row.querySelector(".decision").textContent = loop.last_decision ? labelize(loop.last_decision) : "no decision yet";
    row.querySelector(".cost").textContent = `${runnerText(loop)} · ${formatDuration(loop.elapsed_seconds)} · ${formatTokenEstimate(loop)} tokens est.`;
    row.querySelector(".bar span").style.width = `${loop.progress_percent}%`;
    row.addEventListener("click", () => {
      if (state.selectedLoopId !== loop.loop_id) {
        state.actionMessage = "";
        state.actionMessageKind = "";
      }
      state.selectedLoopId = loop.loop_id;
      render();
    });
    els.loops.appendChild(row);
  }
  renderDetail(state.loops.find((loop) => loop.loop_id === state.selectedLoopId));
}

function renderDetail(loop) {
  if (!loop) {
    els.detailTitle.textContent = "Select a loop";
    els.detailStatus.textContent = "No loop";
    els.detailStatus.className = "status neutral";
    els.detail.innerHTML = '<div class="detail-empty">No loop selected.</div>';
    return;
  }
  els.detailTitle.textContent = loop.loop_id;
  els.detailStatus.textContent = labelize(loop.status);
  els.detailStatus.className = statusClass(loop.status);
  const metricPercent = loop.metric_percent === null ? "n/a" : `${loop.metric_percent}%`;
  const [phaseTitle, phaseBody] = statusInsight(loop);
  const actions = actionConfig(loop);
  const callbackState =
    loop.status === "waiting_callback"
      ? loop.callback_ready
        ? "Callback ready"
        : "Callback not ready"
        : loop.callback_processed
          ? "Callback processed"
          : formatValue(loop.callback_ready);
  const runnerBanner = loop.runner_is_simulated
    ? `
      <section class="runner-banner warning" aria-label="Execution backend">
        <strong>Demo simulation backend</strong>
        <span>This loop uses the deterministic local runner. It does not open real Codex Planner, Worker, or Judge sessions.</span>
      </section>
    `
    : `
      <section class="runner-banner ok" aria-label="Execution backend">
        <strong>${escapeHtml(runnerText(loop))}</strong>
        <span>Start, Step, and callback judging use the runner stored on this loop.</span>
      </section>
    `;
  const adapterBanner =
    loop.task_adapter_mode === "none"
      ? `
      <section class="runner-banner warning" aria-label="TaskRun adapter">
        <strong>No long-work adapter configured</strong>
        <span>CALO can run short Codex turns, but it will stop before auto-commit or external TaskRun launch. No hidden fake training is running.</span>
      </section>
    `
      : loop.task_adapter_mode === "demo"
        ? `
      <section class="runner-banner warning" aria-label="TaskRun adapter">
        <strong>Demo TaskRun adapter</strong>
        <span>This loop uses the fake score fixture for lifecycle testing. It is not executing your real workload.</span>
      </section>
    `
        : `
      <section class="runner-banner ok" aria-label="TaskRun adapter">
        <strong>Command TaskRun adapter</strong>
        <span>Accepted changes can launch the configured external command with a callback file and run manifest.</span>
      </section>
    `;
  const artifactWarning = loop.artifact_root_exists === false
    ? `
      <section class="runner-banner warning" aria-label="Artifact warning">
        <strong>Artifact directory missing</strong>
        <span>The database still has loop state, but the evidence directory is not present: ${escapeHtml(loop.artifact_root)}</span>
      </section>
    `
    : "";
  els.detail.innerHTML = `
    <div class="detail-body">
      ${runnerBanner}
      ${adapterBanner}
      ${artifactWarning}
      <section class="phase-panel" aria-label="Current phase">
        <div>
          <div class="phase-kicker">Current phase</div>
          <div class="phase-title">${escapeHtml(phaseTitle)}</div>
          <div class="phase-body">${escapeHtml(phaseBody)}</div>
        </div>
        <div class="next-action">
          <span>Next action</span>
          <strong>${escapeHtml(nextActionText(loop))}</strong>
        </div>
      </section>
      <div class="detail-grid">
        <div class="stat"><div class="stat-label">Turns used</div><div class="stat-value">${escapeHtml(`${loop.turn}/${loop.max_turns}`)}</div></div>
        <div class="stat"><div class="stat-label">Turn budget</div><div class="stat-value">${escapeHtml(`${loop.progress_percent}%`)}</div></div>
        <div class="stat"><div class="stat-label">${escapeHtml(loop.target_metric)}</div><div class="stat-value">${escapeHtml(`${formatValue(loop.best_metric)} / ${formatValue(loop.target_value)}`)}</div></div>
        <div class="stat"><div class="stat-label">Metric target</div><div class="stat-value">${escapeHtml(metricPercent)}</div></div>
        <div class="stat"><div class="stat-label">Elapsed</div><div class="stat-value">${escapeHtml(formatDuration(loop.elapsed_seconds))}</div></div>
        <div class="stat"><div class="stat-label">Token estimate</div><div class="stat-value">${escapeHtml(formatTokenEstimate(loop))}</div></div>
      </div>
      <div class="section-title">Objective</div>
      <p class="objective-full">${escapeHtml(loop.objective)}</p>
      <div class="section-title">State</div>
      <div class="key-grid">
        <div><span>Mode</span><strong>${escapeHtml(loop.execution_mode)}</strong></div>
        <div><span>Execution backend</span><strong>${escapeHtml(runnerText(loop))}</strong></div>
        <div><span>TaskRun adapter</span><strong>${escapeHtml(taskAdapterText(loop.task_adapter_mode))}</strong></div>
        <div><span>Last run</span><strong>${escapeHtml(formatValue(loop.last_run_id))}</strong></div>
        <div><span>Last decision</span><strong>${escapeHtml(loop.last_decision ? labelize(loop.last_decision) : "n/a")}</strong></div>
        <div><span>Updated</span><strong>${escapeHtml(formatDate(loop.updated_at))}</strong></div>
        <div><span>Repository</span><strong>${escapeHtml(formatValue(loop.repo_path))}</strong></div>
        <div><span>Artifact root</span><strong>${escapeHtml(formatValue(loop.artifact_root))}</strong></div>
        <div><span>Run owner</span><strong>${escapeHtml(formatValue(loop.run_owner))}</strong></div>
        <div><span>Run status</span><strong>${escapeHtml(formatValue(loop.run_status))}</strong></div>
        <div><span>Callback</span><strong>${escapeHtml(callbackState)}</strong></div>
        <div><span>Wake path</span><strong>${escapeHtml(formatValue(loop.wake_path))}</strong></div>
        <div><span>Run log</span><strong>${escapeHtml(formatValue(loop.run_stdout_path))}</strong></div>
        <div><span>Codex control</span><strong>${escapeHtml(loop.codex_control ? labelize(loop.codex_control) : "n/a")}</strong></div>
        <div><span>Run manifest</span><strong>${escapeHtml(formatValue(loop.run_manifest_path))}</strong></div>
      </div>
      <div class="section-title">Actions</div>
      <div class="button-row">
        <button class="button primary" data-action="start" ${actions.start ? "" : "disabled"}>Start</button>
        <button class="button" data-action="step" ${actions.step ? "" : "disabled"}>Step</button>
        <button class="button" data-action="collect-callback" ${actions.collect ? "" : "disabled"}>${loop.callback_ready ? "Collect callback" : "Await callback"}</button>
        <button class="button" data-action="pause" ${actions.pause ? "" : "disabled"}>Pause</button>
        <button class="button" data-action="resume" ${actions.resume ? "" : "disabled"}>Resume</button>
        <button class="button danger" data-action="cancel" ${actions.cancel ? "" : "disabled"}>Cancel</button>
        <button class="button danger" data-action="terminate-run" ${actions.terminate ? "" : "disabled"}>Terminate TaskRun</button>
      </div>
      <div id="action-message" class="action-message ${escapeHtml(state.actionMessageKind)}" role="status" aria-live="polite">${escapeHtml(state.actionMessage)}</div>
      <div class="section-title">Codex sessions</div>
      ${renderCodexSessions(loop.recent_events || [])}
      <div class="section-title">Guide next Codex turn</div>
      <form id="guidance-form" class="guidance-form">
        <div class="field-block">
          <label for="guidance-message">Instruction</label>
          <textarea id="guidance-message" rows="3" placeholder="Tell Planner, Worker, or Judge what to consider next."></textarea>
        </div>
        <div class="field-block">
          <label for="guidance-objective">Revise goal brief</label>
          <textarea id="guidance-objective" rows="2" placeholder="Optional. Leave blank to keep the current objective."></textarea>
          <small class="field-help">Current: ${escapeHtml(loop.objective)}</small>
        </div>
        <div class="guidance-controls">
          <div class="field-block">
            <label for="guidance-applies">Scope</label>
            <select id="guidance-applies">
              <option value="next_turn">Next Codex turn</option>
              <option value="current_loop">Current loop</option>
            </select>
          </div>
          <button class="button primary" type="submit">Submit guidance</button>
        </div>
      </form>
      <div class="section-title">Operator guidance</div>
      ${renderOperatorGuidance(loop.operator_guidance)}
      <div class="section-title">Task graph</div>
      ${renderTaskGraph(loop.task_graph)}
      <div class="section-title">TaskRuns</div>
      ${renderTaskRuns(loop.task_runs)}
      <div class="section-title">Artifacts</div>
      ${renderArtifacts(loop.artifacts)}
      <div class="section-title">Loop timeline</div>
      <div class="event-list">${renderEvents(loop.recent_events || [])}</div>
    </div>
  `;
  els.detail.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      const actionMessage = els.detail.querySelector("#action-message");
      actionMessage.textContent = `${button.textContent} with ${runnerText(loop)}...`;
      actionMessage.className = "action-message";
      try {
        const result = await postAction(loop, button.dataset.action);
        state.actionMessage = `${button.textContent} succeeded: ${labelize(result.status || result.external_task_control)}.`;
        state.actionMessageKind = "success";
        await loadDashboard();
      } catch (error) {
        state.actionMessage = `${button.textContent} failed: ${error.message}`;
        state.actionMessageKind = "error";
        actionMessage.textContent = state.actionMessage;
        actionMessage.className = "action-message error";
      } finally {
        button.disabled = false;
      }
    });
  });
  const guidanceForm = els.detail.querySelector("#guidance-form");
  guidanceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = guidanceForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    const actionMessage = els.detail.querySelector("#action-message");
    actionMessage.textContent = "Submitting guidance...";
    actionMessage.className = "action-message";
    try {
      const result = await submitGuidance(loop);
      state.actionMessage = result.revised_objective
        ? "Guidance saved and goal brief revised."
        : "Guidance saved for the next Codex turn.";
      state.actionMessageKind = "success";
      await loadDashboard();
    } catch (error) {
      state.actionMessage = `Guidance failed: ${error.message}`;
      state.actionMessageKind = "error";
      actionMessage.textContent = state.actionMessage;
      actionMessage.className = "action-message error";
    } finally {
      submit.disabled = false;
    }
  });
}

els.refresh.addEventListener("click", loadDashboard);
els.goalForm.addEventListener("submit", submitGoal);
if (els.goalRunner) els.goalRunner.addEventListener("change", syncRunnerDefaults);
if (els.goalTaskAdapter) els.goalTaskAdapter.addEventListener("change", syncTaskAdapterFields);
initRepoBrowser();
initLayoutResize();
syncTaskAdapterFields();
loadContext().then(loadDashboard);
setInterval(loadDashboard, 5000);
