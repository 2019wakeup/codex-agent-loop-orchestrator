const state = {
  loops: [],
  selectedLoopId: null,
};

const els = {
  health: document.querySelector("#health"),
  refresh: document.querySelector("#refresh"),
  loops: document.querySelector("#loops"),
  loopCount: document.querySelector("#loop-count"),
  detailTitle: document.querySelector("#detail-title"),
  detailStatus: document.querySelector("#detail-status"),
  detail: document.querySelector("#detail"),
  rowTemplate: document.querySelector("#loop-row-template"),
};

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

function labelize(value) {
  return `${value || "unknown"}`.replaceAll("_", " ");
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

function statusInsight(loop) {
  const target = `${loop.target_metric} ${formatValue(loop.target_value)}`;
  const messages = {
    ready: ["Ready to start", "The orchestrator can run the next Codex turn when you start it."],
    planning: ["Planning next change", "Codex is producing a scoped plan; lifecycle control remains with the orchestrator."],
    codex_running: ["Applying code changes", "The Worker role is executing the approved plan."],
    validation_running: ["Running validation", "Fast checks are running before expensive work is launched."],
    judging: ["Evaluating evidence", "The Judge role is scoring results and recommending a policy decision."],
    policy_checking: ["Checking policy", "The Policy Engine is deciding whether to continue, pause, or complete."],
    training_running: ["Training is running", "Codex is idle while the external command does the long work."],
    waiting_callback: ["Waiting for callback", "Collect the callback when training writes its result file or webhook payload."],
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
    ready: "Start the next turn.",
    training_running: "Wait for training to finish.",
    waiting_callback: "Collect or post the training callback.",
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
      body: "Codex produced the next scoped plan for the Worker role.",
      chips: [
        { label: "turn", value: payload.turn_id },
        { label: "plan", value: payload.plan_path },
      ],
    },
    "codex.worker.completed": {
      title: "Worker finished",
      body: "Codex applied the proposed code or artifact changes for this turn.",
      chips: [
        { label: "turn", value: payload.turn_id },
        { label: "summary", value: payload.summary_path },
      ],
    },
    "codex.judge.completed": {
      title: "Judge finished",
      body: "Codex evaluated evidence and wrote an advisory decision.",
      chips: [
        { label: "turn", value: payload.turn_id },
        { label: "report", value: payload.judge_path },
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
      title: "Training run started",
      body: "Long-running work was launched outside the Codex turn.",
      chips: [
        { label: "run", value: payload.run_id },
        { label: "turn", value: payload.turn_id },
        { label: "pid", value: payload.pid },
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
    "loop.paused": {
      title: "Loop paused",
      body: "Lifecycle execution is stopped until a resume command is received.",
      chips: [],
    },
    "loop.resumed": {
      title: "Loop resumed",
      body: "The orchestrator can continue from its stored state.",
      chips: [],
    },
    "loop.cancelled": {
      title: "Loop cancelled",
      body: "The orchestrator will not schedule more turns for this loop.",
      chips: [],
    },
  };
  return { ...fallback, ...(descriptions[type] || {}) };
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

function actionConfig(status) {
  const activeStates = new Set([
    "planning",
    "codex_running",
    "validation_running",
    "judging",
    "policy_checking",
    "training_running",
    "waiting_callback",
    "review_required",
  ]);
  const terminalStates = new Set(["completed", "cancelled"]);
  return {
    start: !terminalStates.has(status) && !activeStates.has(status) && status !== "paused",
    pause: !terminalStates.has(status) && status !== "paused",
    resume: status === "paused" || status === "review_required",
    cancel: !terminalStates.has(status),
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

async function postAction(loopId, action) {
  const response = await fetch(`/api/v1/loops/${encodeURIComponent(loopId)}/${action}`, { method: "POST" });
  if (!response.ok) throw new Error(`${action} failed with HTTP ${response.status}`);
  await loadDashboard();
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
    row.querySelector(".bar span").style.width = `${loop.progress_percent}%`;
    row.addEventListener("click", () => {
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
  const actions = actionConfig(loop.status);
  els.detail.innerHTML = `
    <div class="detail-body">
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
      </div>
      <div class="section-title">Objective</div>
      <p class="objective-full">${escapeHtml(loop.objective)}</p>
      <div class="section-title">State</div>
      <div class="key-grid">
        <div><span>Mode</span><strong>${escapeHtml(loop.execution_mode)}</strong></div>
        <div><span>Last run</span><strong>${escapeHtml(formatValue(loop.last_run_id))}</strong></div>
        <div><span>Last decision</span><strong>${escapeHtml(loop.last_decision ? labelize(loop.last_decision) : "n/a")}</strong></div>
        <div><span>Updated</span><strong>${escapeHtml(formatDate(loop.updated_at))}</strong></div>
        <div><span>Repo path</span><strong>${escapeHtml(formatValue(loop.repo_path))}</strong></div>
      </div>
      <div class="section-title">Actions</div>
      <div class="button-row">
        <button class="button primary" data-action="start" ${actions.start ? "" : "disabled"}>Start</button>
        <button class="button" data-action="pause" ${actions.pause ? "" : "disabled"}>Pause</button>
        <button class="button" data-action="resume" ${actions.resume ? "" : "disabled"}>Resume</button>
        <button class="button danger" data-action="cancel" ${actions.cancel ? "" : "disabled"}>Cancel</button>
      </div>
      <div class="section-title">Loop timeline</div>
      <div class="event-list">${renderEvents(loop.recent_events || [])}</div>
    </div>
  `;
  els.detail.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await postAction(loop.loop_id, button.dataset.action);
      } finally {
        button.disabled = false;
      }
    });
  });
}

els.refresh.addEventListener("click", loadDashboard);
loadDashboard();
setInterval(loadDashboard, 5000);
