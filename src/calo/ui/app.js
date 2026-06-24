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
    els.detail.innerHTML = `<div class="detail-empty">Unable to load dashboard: ${error.message}</div>`;
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
    status.textContent = loop.status;
    status.className = statusClass(loop.status);
    row.querySelector(".objective").textContent = loop.objective;
    row.querySelector(".turns").textContent = `Turn ${loop.turn}/${loop.max_turns}`;
    row.querySelector(".metric").textContent = `${loop.target_metric} ${formatValue(loop.best_metric)} / ${formatValue(loop.target_value)}`;
    row.querySelector(".decision").textContent = loop.last_decision || "no decision";
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
  els.detailStatus.textContent = loop.status;
  els.detailStatus.className = statusClass(loop.status);
  const metricPercent = loop.metric_percent === null ? "n/a" : `${loop.metric_percent}%`;
  const events = loop.recent_events
    .map(
      (event) => `
        <div class="event">
          <div class="event-time">${formatDate(event.created_at)}</div>
          <div><strong>${event.event_type}</strong><br><span class="muted">${JSON.stringify(event.payload)}</span></div>
        </div>
      `,
    )
    .join("");
  els.detail.innerHTML = `
    <div class="detail-body">
      <div class="detail-grid">
        <div class="stat"><div class="stat-label">Turns</div><div class="stat-value">${loop.turn}/${loop.max_turns}</div></div>
        <div class="stat"><div class="stat-label">Turn Progress</div><div class="stat-value">${loop.progress_percent}%</div></div>
        <div class="stat"><div class="stat-label">${loop.target_metric}</div><div class="stat-value">${formatValue(loop.best_metric)} / ${formatValue(loop.target_value)}</div></div>
        <div class="stat"><div class="stat-label">Metric Progress</div><div class="stat-value">${metricPercent}</div></div>
      </div>
      <div class="section-title">Objective</div>
      <div>${loop.objective}</div>
      <div class="section-title">State</div>
      <div class="metrics-line">
        <span>Mode: ${loop.execution_mode}</span>
        <span>Last run: ${formatValue(loop.last_run_id)}</span>
        <span>Last decision: ${formatValue(loop.last_decision)}</span>
        <span>Updated: ${formatDate(loop.updated_at)}</span>
      </div>
      <div class="section-title">Actions</div>
      <div class="button-row">
        <button class="button" data-action="start">Start</button>
        <button class="button" data-action="pause">Pause</button>
        <button class="button" data-action="resume">Resume</button>
        <button class="button danger" data-action="cancel">Cancel</button>
      </div>
      <div class="section-title">Recent Events</div>
      <div class="event-list">${events || '<div class="event"><div class="event-time">n/a</div><div>No events yet</div></div>'}</div>
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
