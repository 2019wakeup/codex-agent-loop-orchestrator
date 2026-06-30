const state = {
  loops: [],
  selectedLoopId: null,
  defaultRepoPath: "",
  runner: "local",
  model: "",
  language: window.localStorage.getItem("calo.language") || "zh",
  actionMessage: "",
  actionMessageKind: "",
  detailTab: "overview",
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
  languageToggle: document.querySelector("#language-toggle"),
  health: document.querySelector("#health"),
  refresh: document.querySelector("#refresh"),
  goalForm: document.querySelector("#goal-form"),
  goalMessage: document.querySelector("#goal-message"),
  goalSubmit: document.querySelector("#goal-submit"),
  goalObjective: document.querySelector("#goal-objective"),
  goalObjectivePreview: document.querySelector("#goal-objective-preview"),
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

const zh = {
  "Local control plane for short Codex turns and externally owned long work.": "短 Codex turn 与外部长任务的本地控制台。",
  Connecting: "连接中",
  Connected: "已连接",
  Disconnected: "已断开",
  Refresh: "刷新",
  "Loop Queue": "Loop 队列",
  "Create a goal, then hand off long work without keeping Codex awake.": "创建 goal，然后把长任务交给外部执行，Codex 不需要一直醒着。",
  "Goal brief": "Goal brief",
  "Describe the goal, constraints, and acceptance criteria in Markdown.": "用 Markdown 描述 goal、约束和验收标准。",
  "Markdown supported: headings, tables, lists, links, inline code, and fenced code blocks.": "支持 Markdown：标题、表格、列表、链接、inline code 和 fenced code block。",
  "Markdown preview": "Markdown preview",
  "Markdown preview appears here.": "Markdown preview 会显示在这里。",
  Repository: "Repository",
  Browse: "Browse",
  Hide: "收起",
  "Choose a recent repository or browse the machine filesystem.": "选择最近的 repository，或 Browse 整台机器的文件系统。",
  Up: "上一级",
  Root: "Root",
  "Use folder": "使用此文件夹",
  "Execution backend": "Execution backend",
  "Real Codex CLI": "Real Codex CLI",
  "Demo simulation": "Demo simulation",
  "Stored on the loop and used by Run controls and callback judging.": "存到 Loop 上，供 Run controls 和 callback judging 使用。",
  "External work mode": "External work mode",
  "Stop before TaskRun": "TaskRun 前停止",
  "Run my command": "Run my command",
  "Demo fake TaskRun": "Demo fake TaskRun",
  "Choose what CALO does after an accepted Codex turn.": "选择 Codex turn 被接受后 CALO 要做什么。",
  "Controls whether accepted changes can launch external work after a Codex turn.": "控制 Codex turn 被接受后是否能启动外部任务。",
  Model: "Model",
  "backend default": "backend default",
  "Loop ID": "Loop ID",
  optional: "可选",
  "Target score": "目标 score",
  "Max turns": "Max turns",
  "Advanced settings": "高级设置",
  "Target metric": "Target metric",
  Patience: "Patience",
  "max turns": "max turns",
  "Min delta": "Min delta",
  "Adapter commands": "Adapter commands",
  "Stop boundary: CALO can run the Codex turn, then stops before commit or TaskRun launch.": "停止边界：CALO 可以运行 Codex turn，然后在 commit 或 TaskRun launch 前停止。",
  "Quick check command": "Quick check command",
  "optional, for example: pytest -q": "可选，例如：pytest -q",
  "Fast command CALO runs before launching long work.": "启动长任务前由 CALO 执行的快速检查命令。",
  "Long-work adapter command": "Long-work adapter command",
  "Required for command mode. CALO fills callback, run, turn, and loop placeholders.": "Command mode 必填。CALO 会填充 callback、run、turn 和 loop 占位符。",
  "Async mode": "Async mode",
  "Diff review": "Diff review",
  "Auto commit": "Auto commit",
  "Create loop": "创建 Loop",
  "Loop Detail": "Loop 详情",
  "Current phase, next action, evidence, and operator guidance.": "当前阶段、下一步、evidence 和 operator guidance。",
  "No loop": "未选择 Loop",
  "No loop selected.": "尚未选择 Loop。",
  Workspace: "Workspace",
  "Selected folder": "已选文件夹",
  "Browsed folder": "Browse 选择的文件夹",
  "Repository folder selected.": "Repository 文件夹已选择。",
  "Loading directories...": "正在加载目录...",
  "No readable child directories.": "没有可读取的子目录。",
  "Directory could not be opened.": "无法打开目录。",
  "No external work": "No external work",
  "Demo mode writes a tiny score fixture and fake TaskRun script. Use it only to learn the lifecycle, not for real tasks.": "Demo mode 会写入一个小型 score fixture 和 fake TaskRun script。只用于理解生命周期，不用于真实任务。",
  "Command mode launches your real external work after a Codex turn. The command must write the callback file.": "Command mode 会在 Codex turn 后启动你的真实外部任务。该命令必须写入 callback file。",
  " Local backend still uses the deterministic demo Codex runner for Planner, Worker, and Judge.": " Local backend 仍使用确定性的 demo Codex runner 来模拟 Planner、Worker 和 Judge。",
  "No task graph has been recorded yet.": "还没有记录 task graph。",
  "No TaskRuns have been recorded yet.": "还没有记录 TaskRun。",
  "No Codex role session has been recorded yet.": "还没有记录 Codex role session。",
  "No artifacts are available yet.": "还没有 artifact。",
  "Preview not available for this file type.": "此文件类型没有 preview。",
  "No operator guidance has been submitted yet.": "还没有提交 operator guidance。",
  "Revised objective": "已修订 objective",
  "Scopes the next turn and writes the task graph.": "定义下一个 turn 的范围并写入 task graph。",
  "Applies the approved source changes for this turn.": "应用此 turn 已批准的源码改动。",
  "Reviews evidence and produces an advisory verdict.": "Review evidence 并生成 advisory verdict。",
  Instruction: "Instruction",
  "Tell Planner, Worker, or Judge what to consider next.": "告诉 Planner、Worker 或 Judge 下一步要关注什么。",
  "Revise goal brief": "修改 goal brief",
  "Optional. Leave blank to keep the current objective.": "可选。留空则保持当前 objective。",
  Current: "当前",
  Scope: "Scope",
  "Next Codex turn": "下一个 Codex turn",
  "Current loop": "当前 Loop",
  "Submit guidance": "提交 guidance",
  Details: "详情",
  "The orchestrator recorded a lifecycle event.": "Orchestrator 记录了一个生命周期事件。",
  "Loop contract created": "Loop contract 已创建",
  "The orchestrator registered this loop and saved its contract.": "Orchestrator 已注册此 Loop 并保存 contract。",
  "Planner finished": "Planner finished",
  "The local demo runner generated a deterministic plan. No real Codex session was used.": "本地 demo runner 生成了确定性 plan。没有使用真实 Codex session。",
  "Codex CLI produced the next scoped plan for the Worker role.": "Codex CLI 为 Worker role 生成了下一步 scoped plan。",
  "Worker finished": "Worker finished",
  "The local demo runner applied deterministic fixture changes.": "本地 demo runner 应用了确定性 fixture change。",
  "Codex CLI applied the proposed code or artifact changes for this turn.": "Codex CLI 已应用此 turn 的代码或 artifact change。",
  "Judge finished": "Judge finished",
  "The local demo runner produced a deterministic judge verdict.": "本地 demo runner 生成了确定性 judge verdict。",
  "Codex CLI evaluated evidence and wrote an advisory decision.": "Codex CLI 已评估 evidence 并写入 advisory decision。",
  "Validation passed": "Validation passed",
  "Validation failed": "Validation failed",
  "Fast checks passed before training launch.": "training 启动前的 fast checks 已通过。",
  "Fast checks failed; training should not launch.": "fast checks 失败，不应启动 training。",
  "Policy checked": "Policy checked",
  "The Policy Engine evaluated the latest evidence.": "Policy Engine 已评估最新 evidence。",
  "Change committed": "Change committed",
  "The orchestrator committed accepted source changes for auditability.": "Orchestrator 已提交被接受的源码改动，便于审计。",
  "TaskRun started": "TaskRun started",
  "Long-running work was launched outside the Codex turn.": "长任务已在 Codex turn 外启动。",
  "TaskRun handed to external owner": "TaskRun 已交给外部 owner",
  "The async task has an owner and wake path, so the orchestrator can pause Codex work.": "异步任务已有 owner 和 wake path，orchestrator 可以暂停 Codex 工作。",
  "Operational pause entered": "已进入 operational_pause",
  "Codex control has been released until a wake event arrives.": "Codex control 已释放，直到 wake event 到达。",
  "TaskRun launch blocked": "TaskRun launch 被阻止",
  "The orchestrator refused to enter operational pause without a durable owner and wake path.": "缺少持久 owner 和 wake path，orchestrator 拒绝进入 operational_pause。",
  "The orchestrator refused to launch long-running work because this loop has no external work mode.": "此 Loop 没有 External work mode，orchestrator 拒绝启动长任务。",
  "External work mode required": "需要 External work mode",
  "External work mode configured": "External work mode 已配置",
  "The loop contract now has an explicit adapter choice for external work.": "Loop contract 现在有明确的外部任务 adapter 选择。",
  "Continuing accepted turn": "继续已接受的 turn",
  "The orchestrator is continuing the already-reviewed turn after adapter setup.": "adapter setup 后，orchestrator 正在继续已 review 的 turn。",
  "Adapter quick check passed": "Adapter quick check passed",
  "Adapter quick check failed": "Adapter quick check failed",
  "The recovery quick check passed before commit and TaskRun launch.": "commit 和 TaskRun launch 前，recovery quick check 已通过。",
  "The recovery quick check failed before commit and TaskRun launch.": "commit 和 TaskRun launch 前，recovery quick check 失败。",
  "Adapter recovery stopped": "Adapter recovery 已停止",
  "The adapter quick check failed, so no commit or TaskRun was launched.": "adapter quick check 失败，因此没有 commit 或启动 TaskRun。",
  "Adapter update saved": "Adapter update 已保存",
  "The loop contract was updated without launching a TaskRun.": "Loop contract 已更新，没有启动 TaskRun。",
  "The external work callback was recorded.": "External work callback 已记录。",
  "Duplicate callback ignored": "重复 callback 已忽略",
  "This run result had already been processed, so the orchestrator kept state unchanged.": "此 run result 已处理过，orchestrator 保持 state 不变。",
  "Callback processed": "Callback processed",
  "The orchestrator updated loop state from the TaskRun result.": "Orchestrator 已根据 TaskRun result 更新 Loop state。",
  "Goal guidance submitted": "Goal guidance 已提交",
  "Operator guidance submitted": "Operator guidance 已提交",
  "The loop objective was revised and the next Codex turn will receive this guidance.": "Loop objective 已修订，下一个 Codex turn 会收到这条 guidance。",
  "The next Codex turn will receive this operator instruction in its evidence packet.": "下一个 Codex turn 会在 evidence packet 里收到这条 operator instruction。",
  "Loop paused": "Loop 已暂停",
  "Orchestrator execution is stopped until a resume command is received.": "Orchestrator 已停止执行，直到收到 resume command。",
  "Loop resumed": "Loop 已恢复",
  "The orchestrator can continue from its stored state.": "Orchestrator 可从已保存 state 继续。",
  "Loop cancelled": "Loop 已取消",
  "Orchestration was cancelled. The external TaskRun was not terminated and remains with its owner.": "Orchestration 已取消。外部 TaskRun 未被终止，仍由 owner 管理。",
  "The orchestrator will not schedule more turns for this loop.": "Orchestrator 不会再为此 Loop 调度新的 turn。",
  "No lifecycle events have been recorded yet.": "还没有生命周期事件。",
  "Ready to start": "Ready to start",
  "The orchestrator can run the next Codex turn when you choose a Run control.": "选择 Run control 后，orchestrator 可以运行下一个 Codex turn。",
  "A Codex turn has produced evidence, but CALO stopped before committing or launching long work because no adapter is configured.": "Codex turn 已产生 evidence，但因为没有配置 adapter，CALO 在 commit 或启动长任务前停止。",
  "Planning next change": "Planning next change",
  "Codex is producing a scoped plan; lifecycle control remains with the orchestrator.": "Codex 正在生成 scoped plan，生命周期控制仍由 orchestrator 持有。",
  "Applying code changes": "Applying code changes",
  "The Worker role is executing the approved plan.": "Worker role 正在执行已批准 plan。",
  "Running validation": "Running validation",
  "Fast checks are running before expensive work is launched.": "启动昂贵任务前正在运行 fast checks。",
  "Evaluating evidence": "Evaluating evidence",
  "The Judge role is scoring results and recommending a policy decision.": "Judge role 正在给结果评分并建议 policy decision。",
  "Checking policy": "Checking policy",
  "The Policy Engine is deciding whether to continue, pause, or complete.": "Policy Engine 正在决定继续、暂停还是完成。",
  "TaskRun is running": "TaskRun 正在运行",
  "Codex is idle while the external TaskRun does the long work.": "外部 TaskRun 执行长任务时，Codex 保持 idle。",
  "Operational pause": "Operational pause",
  "Codex is not monitoring. The external owner must write or post the wake result.": "Codex 不在监控。外部 owner 必须写入或提交 wake result。",
  "Human review required": "需要人工 review",
  "A gate or risk condition needs review before the loop continues.": "Loop 继续前，需要 review 某个 gate 或 risk condition。",
  Paused: "已暂停",
  "Resume when you are ready for the orchestrator to continue.": "准备好后点击 Resume，让 orchestrator 继续。",
  "Target reached": "Target reached",
  Failed: "失败",
  "Inspect the latest event details and artifacts before retrying.": "重试前请检查最新 event details 和 artifacts。",
  Cancelled: "已取消",
  "This loop was stopped by a user action.": "此 Loop 已被用户操作停止。",
  "Run until the next pause, or run exactly one turn.": "运行到下一个 pause，或只运行一个 turn。",
  "Choose a command adapter or cancel this loop; no external task is running.": "选择 command adapter 或取消此 Loop；当前没有外部任务在运行。",
  "Wait for external work to finish.": "等待外部任务完成。",
  "Collect the callback from the wake path.": "从 wake path 收集 callback。",
  "Wait until the wake path exists.": "等待 wake path 出现。",
  "Resume the loop when ready.": "准备好后 Resume Loop。",
  "Review artifacts, then resume if acceptable.": "Review artifacts，确认可接受后 Resume。",
  "Read the final report or create a new loop.": "阅读 final report，或创建新的 Loop。",
  "Inspect artifacts, fix the cause, then run again.": "检查 artifacts，修复原因，然后重新 Run。",
  "No further action is scheduled.": "没有计划中的后续动作。",
  "Monitor the current orchestrator phase.": "观察当前 orchestrator phase。",
  "Unable to load dashboard:": "无法加载 dashboard：",
  "Goal brief and repository selection are required.": "必须填写 Goal brief 并选择 repository。",
  "Command adapter needs a long-work adapter command.": "Command adapter 需要填写 long-work adapter command。",
  "Creating loop...": "正在创建 Loop...",
  "Created with": "已创建，使用",
  "Select Run until pause or Run one turn to begin.": "选择 Run until pause 或 Run one turn 开始。",
  Created: "已创建",
  with: "使用",
  "Create failed:": "创建失败：",
  "Guidance failed: write an instruction for the next Codex turn.": "Guidance 失败：请为下一个 Codex turn 填写 instruction。",
  "Demo simulation backend": "Demo simulation backend",
  "This loop uses the deterministic local runner. It does not open real Codex Planner, Worker, or Judge sessions.": "此 Loop 使用确定性的本地 runner，不会打开真实的 Codex Planner、Worker 或 Judge session。",
  "Run controls and callback judging use the runner stored on this loop.": "Run controls 和 callback judging 会使用存储在此 Loop 上的 runner。",
  "No external work configured": "尚未配置外部任务",
  "No TaskRun is running. CALO will stop before commit and external work until you choose Command or Demo.": "没有 TaskRun 在运行。选择 Command 或 Demo 前，CALO 会在 commit 和外部任务前停止。",
  "Demo fake TaskRun mode": "Demo fake TaskRun mode",
  "This loop uses the fake score fixture for lifecycle testing. It is not executing your real workload.": "此 Loop 使用 fake score fixture 测试生命周期，不会执行你的真实 workload。",
  "Command TaskRun mode": "Command TaskRun mode",
  "Accepted changes can launch the configured external command with a callback file and run manifest.": "被接受的改动可以启动已配置的外部命令，并带上 callback file 和 run manifest。",
  "Artifact directory missing": "Artifact 目录缺失",
  "The database still has loop state, but the evidence directory is not present:": "数据库里仍有 Loop state，但 evidence 目录不存在：",
  "External work setup": "External work setup",
  "Choose what happens to this accepted change": "选择这个已接受 change 接下来做什么",
  "Choose external work behavior before starting": "开始前选择外部任务行为",
  "Command runs your workload. Demo records fake lifecycle evidence. None leaves the loop stopped without commit or TaskRun launch.": "Command 运行你的 workload。Demo 记录 fake 生命周期 evidence。None 会让 Loop 停在 commit 和 TaskRun launch 之前。",
  "External work type": "External work type",
  "Run a real command after a Codex turn is accepted.": "Codex turn 被接受后运行真实命令。",
  "Continue current accepted turn": "继续当前已接受 turn",
  "Quick check": "Quick check",
  "Fast check CALO runs before launching external work. Leave blank to skip.": "启动外部任务前由 CALO 执行的 fast check。留空则跳过。",
  "External work command": "External work command",
  "{callback_file}, {run_id}, {turn_id}, and {loop_id} are filled by CALO so the run can wake the loop with evidence.": "{callback_file}、{run_id}、{turn_id} 和 {loop_id} 由 CALO 填充，让 run 能带着 evidence 唤醒 Loop。",
  "Configure and continue": "配置并继续",
  "Save adapter": "保存 adapter",
  "Demo mode writes a tiny score fixture and fake TaskRun script. Use it only to test lifecycle wiring.": "Demo mode 会写入小型 score fixture 和 fake TaskRun script。只用于测试生命周期 wiring。",
  "Command mode re-runs the quick check, then launches your real external work after the accepted Codex turn.": "Command mode 会重新运行 quick check，然后在已接受 Codex turn 后启动真实外部任务。",
  "No external work will launch. CALO will stop again when long-work setup is required.": "不会启动外部任务。需要 long-work setup 时，CALO 会再次停止。",
  "Command adapter needs an external work command.": "Command adapter 需要 external work command。",
  "adapter setup failed with HTTP": "adapter setup failed with HTTP",
  "Select a loop": "选择一个 Loop",
  Mode: "Mode",
  "Current phase": "当前阶段",
  "Next action": "下一步",
  "Turns used": "Turns used",
  "Turn budget": "Turn budget",
  "Metric target": "Metric target",
  Elapsed: "Elapsed",
  "Token estimate": "Token estimate",
  Objective: "Objective",
  State: "State",
  "Last run": "Last run",
  "Last decision": "Last decision",
  Updated: "Updated",
  "Artifact root": "Artifact root",
  "Run owner": "Run owner",
  "Run status": "Run status",
  Callback: "Callback",
  "Callback ready": "Callback ready",
  "Callback not ready": "Callback not ready",
  "Callback processed": "Callback processed",
  "Wake path": "Wake path",
  "Run log": "Run log",
  "Codex control": "Codex control",
  "Run manifest": "Run manifest",
  Overview: "Overview",
  Work: "Work",
  Evidence: "Evidence",
  Timeline: "Timeline",
  "Codex sessions": "Codex sessions",
  "Guide next Codex turn": "指导下一个 Codex turn",
  "Operator guidance": "Operator guidance",
  "Task graph": "Task graph",
  TaskRuns: "TaskRuns",
  Artifacts: "Artifacts",
  "Loop timeline": "Loop timeline",
  "Loop controls": "Loop controls",
  Actions: "Actions",
  Run: "Run",
  Wake: "Wake",
  "Loop control": "Loop control",
  "TaskRun process": "TaskRun process",
  "Run until pause": "Run until pause",
  "Run one turn": "Run one turn",
  "Pause loop": "Pause loop",
  "Resume loop": "Resume loop",
  "Cancel orchestration": "Cancel orchestration",
  "Terminate local TaskRun": "Terminate local TaskRun",
  "Waiting for callback": "Waiting for callback",
  "No callback is ready yet. CALO is paused; the external owner must write the wake result.": "callback 尚未 ready。CALO 已暂停，外部 owner 必须写入 wake result。",
  "No TaskRun is running.": "没有 TaskRun 在运行。",
  "No local subprocess is running for CALO to terminate.": "没有 CALO 可终止的本地 subprocess。",
  "Collect callback": "Collect callback",
  Pause: "Pause",
  Resume: "Resume",
  Cancel: "Cancel",
  "Loop detail sections": "Loop detail sections",
  succeeded: "succeeded",
  failed: "failed",
  "Submitting guidance...": "正在提交 guidance...",
  "Guidance saved and goal brief revised.": "Guidance 已保存，goal brief 已更新。",
  "Guidance saved for the next Codex turn.": "Guidance 已保存给下一个 Codex turn。",
  "Guidance failed:": "Guidance 失败：",
  "Configuring adapter and continuing current turn...": "正在配置 adapter 并继续当前 turn...",
  "Saving adapter...": "正在保存 adapter...",
  "Adapter configured; current turn continued:": "Adapter 已配置，当前 turn 已继续：",
  "Adapter configured:": "Adapter 已配置：",
  "Adapter setup failed:": "Adapter setup 失败：",
};

function t(key) {
  if (state.language === "en") return key;
  return zh[key] || key;
}

function applyI18n(root = document) {
  document.documentElement.lang = state.language === "zh" ? "zh-CN" : "en";
  root.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
  });
  if (els.languageToggle) {
    els.languageToggle.textContent = state.language === "zh" ? "English" : "中文";
    els.languageToggle.setAttribute("aria-label", state.language === "zh" ? "Switch to English" : "切换到中文");
  }
}

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

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function renderInlineMarkdown(text) {
  const tokens = [];
  const token = (html) => {
    const placeholder = `@@MDTOKEN${tokens.length}@@`;
    tokens.push([placeholder, html]);
    return placeholder;
  };
  let source = `${text ?? ""}`;
  source = source.replace(/`([^`]+)`/g, (_match, code) => token(`<code>${escapeHtml(code)}</code>`));
  source = source.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_match, label, href) => {
    return token(`<a href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`);
  });
  let html = escapeHtml(source);
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  for (const [placeholder, value] of tokens) html = html.replaceAll(placeholder, value);
  return html;
}

function splitMarkdownTableRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function isMarkdownTableDivider(line) {
  const cells = splitMarkdownTableRow(line);
  return Boolean(cells?.length) && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function renderMarkdownTable(headerLine, dividerLine, bodyLines) {
  const headers = splitMarkdownTableRow(headerLine) || [];
  const divider = splitMarkdownTableRow(dividerLine) || [];
  const rows = bodyLines.map((line) => splitMarkdownTableRow(line)).filter(Boolean);
  if (!headers.length || !divider.length || headers.length !== divider.length) return null;
  return `
    <div class="markdown-table-scroll">
      <table>
        <thead>
          <tr>${headers.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>${headers.map((_header, index) => `<td>${renderInlineMarkdown(row[index] || "")}</td>`).join("")}</tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderMarkdown(markdown) {
  const source = `${markdown || ""}`.trim();
  if (!source) return `<p class="markdown-empty">${escapeHtml(t("Markdown preview appears here."))}</p>`;
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let listItems = [];
  let quoteLines = [];
  let codeLines = [];
  let inCodeBlock = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(`<ul>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
    listItems = [];
  };
  const flushQuote = () => {
    if (!quoteLines.length) return;
    blocks.push(`<blockquote>${quoteLines.map((line) => `<p>${renderInlineMarkdown(line)}</p>`).join("")}</blockquote>`);
    quoteLines = [];
  };
  const flushTextBlocks = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.replace(/\s+$/g, "");
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCodeBlock = false;
      } else {
        flushTextBlocks();
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }
    if (!line.trim()) {
      flushTextBlocks();
      continue;
    }
    if (splitMarkdownTableRow(line) && isMarkdownTableDivider(lines[index + 1] || "")) {
      flushTextBlocks();
      const bodyLines = [];
      let next = index + 2;
      while (next < lines.length && splitMarkdownTableRow(lines[next])) {
        bodyLines.push(lines[next]);
        next += 1;
      }
      const table = renderMarkdownTable(line, lines[index + 1], bodyLines);
      if (table) {
        blocks.push(table);
        index = next - 1;
        continue;
      }
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushTextBlocks();
      const level = heading[1].length + 2;
      blocks.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    const list = /^\s*[-*]\s+(.+)$/.exec(line);
    if (list) {
      flushParagraph();
      flushQuote();
      listItems.push(list[1]);
      continue;
    }
    const quote = /^\s*>\s?(.+)$/.exec(line);
    if (quote) {
      flushParagraph();
      flushList();
      quoteLines.push(quote[1]);
      continue;
    }
    flushList();
    flushQuote();
    paragraph.push(line);
  }
  if (inCodeBlock) blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  flushTextBlocks();
  return blocks.join("");
}

function syncGoalMarkdownPreview() {
  if (!els.goalObjectivePreview || !els.goalObjective) return;
  els.goalObjectivePreview.innerHTML = renderMarkdown(els.goalObjective.value);
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
  const label = kind === "codex-cli" ? t("Real Codex CLI") : t("Demo simulation");
  return model ? `${label} · ${model}` : label;
}

function taskAdapterText(mode) {
  const labels = {
    none: t("Stop before TaskRun"),
    command: t("Run my command"),
    demo: t("Demo fake TaskRun"),
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
      t("Stop boundary: CALO can run the Codex turn, then stops before commit or TaskRun launch.");
    if (els.goalValidationCommand) els.goalValidationCommand.value = "";
    if (els.goalTaskCommand) els.goalTaskCommand.value = "";
  } else if (mode === "demo") {
    els.adapterHelp.textContent =
      t("Demo mode writes a tiny score fixture and fake TaskRun script. Use it only to learn the lifecycle, not for real tasks.");
    if (els.goalValidationCommand && !els.goalValidationCommand.value.trim()) {
      els.goalValidationCommand.value = "python -m py_compile target_app.py";
    }
    if (els.goalTaskCommand && !els.goalTaskCommand.value.trim()) {
      els.goalTaskCommand.value =
        "python fake_train.py --callback-file {callback_file} --run-id {run_id} --turn-id {turn_id}";
    }
  } else {
    els.adapterHelp.textContent =
      t("Command mode launches your real external work after a Codex turn. The command must write the callback file.");
    if (runner === "local") {
      els.adapterHelp.textContent += t(" Local backend still uses the deterministic demo Codex runner for Planner, Worker, and Judge.");
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
    return `<div class="empty-timeline">${escapeHtml(t("No task graph has been recorded yet."))}</div>`;
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
    return `<div class="empty-timeline">${escapeHtml(t("No TaskRuns have been recorded yet."))}</div>`;
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
      body: t("Scopes the next turn and writes the task graph."),
    },
    {
      role: "Worker",
      started: byType.get("codex.worker.started"),
      completed: byType.get("codex.worker.completed"),
      artifactKey: null,
      body: t("Applies the approved source changes for this turn."),
    },
    {
      role: "Judge",
      started: null,
      completed: byType.get("codex.judge.completed"),
      artifactKey: null,
      body: t("Reviews evidence and produces an advisory verdict."),
    },
  ];
  if (!events || !events.length) {
    return `<div class="empty-timeline">${escapeHtml(t("No Codex role session has been recorded yet."))}</div>`;
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
    return `<div class="empty-timeline">${escapeHtml(t("No artifacts are available yet."))}</div>`;
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
              <pre>${escapeHtml(artifact.preview || t("Preview not available for this file type."))}</pre>
            </details>
          `
        )
        .join("")}
    </div>
  `;
}

function renderOperatorGuidance(guidanceItems) {
  if (!guidanceItems || !guidanceItems.length) {
    return `<div class="empty-timeline">${escapeHtml(t("No operator guidance has been submitted yet."))}</div>`;
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
                  ? `<div class="guidance-revision"><span>${escapeHtml(t("Revised objective"))}</span><div class="markdown-body">${renderMarkdown(item.revised_objective)}</div></div>`
                  : ""
              }
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderGuidanceForm(loop) {
  return `
    <form id="guidance-form" class="guidance-form">
      <div class="field-block">
        <label for="guidance-message">${escapeHtml(t("Instruction"))}</label>
        <textarea id="guidance-message" rows="3" placeholder="${escapeHtml(t("Tell Planner, Worker, or Judge what to consider next."))}"></textarea>
      </div>
      <div class="field-block">
        <label for="guidance-objective">${escapeHtml(t("Revise goal brief"))}</label>
        <textarea id="guidance-objective" rows="2" placeholder="${escapeHtml(t("Optional. Leave blank to keep the current objective."))}"></textarea>
        <small class="field-help">${escapeHtml(t("Current"))} Markdown:</small>
        <div class="markdown-body guidance-current">${renderMarkdown(loop.objective)}</div>
      </div>
      <div class="guidance-controls">
        <div class="field-block">
          <label for="guidance-applies">${escapeHtml(t("Scope"))}</label>
          <select id="guidance-applies">
            <option value="next_turn">${escapeHtml(t("Next Codex turn"))}</option>
            <option value="current_loop">${escapeHtml(t("Current loop"))}</option>
          </select>
        </div>
        <button class="button primary" type="submit">${escapeHtml(t("Submit guidance"))}</button>
      </div>
    </form>
  `;
}

function statusInsight(loop) {
  const target = `${loop.target_metric} ${formatValue(loop.target_value)}`;
  const messages = {
    ready: [t("Ready to start"), t("The orchestrator can run the next Codex turn when you choose a Run control.")],
    needs_setup: [
      t("External work mode required"),
      t("A Codex turn has produced evidence, but CALO stopped before committing or launching long work because no adapter is configured."),
    ],
    planning: [t("Planning next change"), t("Codex is producing a scoped plan; lifecycle control remains with the orchestrator.")],
    codex_running: [t("Applying code changes"), t("The Worker role is executing the approved plan.")],
    validation_running: [t("Running validation"), t("Fast checks are running before expensive work is launched.")],
    judging: [t("Evaluating evidence"), t("The Judge role is scoring results and recommending a policy decision.")],
    policy_checking: [t("Checking policy"), t("The Policy Engine is deciding whether to continue, pause, or complete.")],
    training_running: [t("TaskRun is running"), t("Codex is idle while the external TaskRun does the long work.")],
    waiting_callback: [t("Operational pause"), t("Codex is not monitoring. The external owner must write or post the wake result.")],
    review_required: [t("Human review required"), t("A gate or risk condition needs review before the loop continues.")],
    paused: [t("Paused"), t("Resume when you are ready for the orchestrator to continue.")],
    completed: [t("Target reached"), state.language === "zh" ? `Loop 已达到 ${target} 目标。` : `The loop met its objective for ${target}.`],
    failed: [t("Failed"), t("Inspect the latest event details and artifacts before retrying.")],
    cancelled: [t("Cancelled"), t("This loop was stopped by a user action.")],
  };
  return messages[loop.status] || [state.language === "zh" ? "状态更新" : "Status update", state.language === "zh" ? "Orchestrator 正在跟踪此 Loop。" : "The orchestrator is tracking this loop."];
}

function nextActionText(loop) {
  const actions = {
    ready: t("Run until the next pause, or run exactly one turn."),
    needs_setup: t("Choose a command adapter or cancel this loop; no external task is running."),
    training_running: t("Wait for external work to finish."),
    waiting_callback: loop.callback_ready ? t("Collect the callback from the wake path.") : t("Wait until the wake path exists."),
    paused: t("Resume the loop when ready."),
    review_required: t("Review artifacts, then resume if acceptable."),
    completed: t("Read the final report or create a new loop."),
    failed: t("Inspect artifacts, fix the cause, then run again."),
    cancelled: t("No further action is scheduled."),
  };
  return actions[loop.status] || t("Monitor the current orchestrator phase.");
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
  return `<details class="event-details"><summary>${escapeHtml(t("Details"))}</summary>${rows}</details>`;
}

function describeEvent(event) {
  const payload = event.payload || {};
  const type = event.event_type;
  const fallback = {
    title: labelize(type),
    body: t("The orchestrator recorded a lifecycle event."),
    chips: [{ label: "type", value: type }],
  };
  const descriptions = {
    "loop.created": {
      title: t("Loop contract created"),
      body: t("The orchestrator registered this loop and saved its contract."),
      chips: [{ label: "contract", value: payload.contract_path }],
    },
    "codex.planner.completed": {
      title: t("Planner finished"),
      body: payload.runner_is_simulated
        ? t("The local demo runner generated a deterministic plan. No real Codex session was used.")
        : t("Codex CLI produced the next scoped plan for the Worker role."),
      chips: [
        { label: "turn", value: payload.turn_id },
        { label: "plan", value: payload.plan_path },
        { label: "task graph", value: payload.task_graph_path },
      ],
    },
    "codex.worker.completed": {
      title: t("Worker finished"),
      body: payload.runner_is_simulated
        ? t("The local demo runner applied deterministic fixture changes.")
        : t("Codex CLI applied the proposed code or artifact changes for this turn."),
      chips: [
        { label: "turn", value: payload.turn_id },
        { label: "changed", value: (payload.changed_files || []).join(", ") },
      ],
    },
    "codex.judge.completed": {
      title: t("Judge finished"),
      body: payload.runner_is_simulated
        ? t("The local demo runner produced a deterministic judge verdict.")
        : t("Codex CLI evaluated evidence and wrote an advisory decision."),
      chips: [
        { label: "turn", value: payload.turn_id },
        { label: "verdict", value: labelize(payload.verdict) },
      ],
    },
    "validation.completed": {
      title: payload.passed ? t("Validation passed") : t("Validation failed"),
      body: payload.passed ? t("Fast checks passed before training launch.") : t("Fast checks failed; training should not launch."),
      chips: [{ label: "turn", value: payload.turn_id }],
    },
    "policy.checked": {
      title: t("Policy checked"),
      body: payload.reason || t("The Policy Engine evaluated the latest evidence."),
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
      title: t("Change committed"),
      body: t("The orchestrator committed accepted source changes for auditability."),
      chips: [
        { label: "turn", value: payload.turn_id },
        { label: "sha", value: shortSha(payload.sha) },
      ],
    },
    "run.started": {
      title: t("TaskRun started"),
      body: t("Long-running work was launched outside the Codex turn."),
      chips: [
        { label: "run", value: payload.run_id },
        { label: "turn", value: payload.turn_id },
        { label: "pid", value: payload.pid },
      ],
    },
    "run.launched_async": {
      title: t("TaskRun handed to external owner"),
      body: t("The async task has an owner and wake path, so the orchestrator can pause Codex work."),
      chips: [
        { label: "run", value: payload.run_id },
        { label: "owner", value: payload.owner },
        { label: "wake", value: payload.wake_path },
        { label: "control", value: labelize(payload.codex_control) },
      ],
    },
    "loop.operational_pause": {
      title: t("Operational pause entered"),
      body: payload.reason || t("Codex control has been released until a wake event arrives."),
      chips: [
        { label: "run", value: payload.run_id },
        { label: "owner", value: payload.owner },
        { label: "wake", value: payload.wake_path },
        { label: "control", value: labelize(payload.codex_control) },
      ],
    },
    "run.launch_failed": {
      title: t("TaskRun launch blocked"),
      body: payload.reason || t("The orchestrator refused to enter operational pause without a durable owner and wake path."),
      chips: [
        { label: "run", value: payload.run_id },
        { label: "manifest", value: payload.manifest_path },
      ],
    },
    "task.adapter.required": {
      title: t("External work mode required"),
      body:
        payload.reason ||
        t("The orchestrator refused to launch long-running work because this loop has no external work mode."),
      chips: [
        { label: "turn", value: payload.turn_id },
        { label: "adapter", value: taskAdapterText(payload.task_adapter_mode) },
        { label: "next", value: payload.next_step },
      ],
    },
    "task.adapter.configured": {
      title: t("External work mode configured"),
      body: t("The loop contract now has an explicit adapter choice for external work."),
      chips: [
        { label: "previous", value: taskAdapterText(payload.previous_mode) },
        { label: "current", value: taskAdapterText(payload.task_adapter_mode) },
        { label: "continue current turn", value: payload.continue_current_turn ? "yes" : "no" },
      ],
    },
    "task.adapter.continuing_current_turn": {
      title: t("Continuing accepted turn"),
      body: payload.reason || t("The orchestrator is continuing the already-reviewed turn after adapter setup."),
      chips: [
        { label: "turn", value: payload.turn_id },
        { label: "adapter", value: taskAdapterText(payload.task_adapter_mode) },
      ],
    },
    "task.adapter.validation.completed": {
      title: payload.passed ? t("Adapter quick check passed") : t("Adapter quick check failed"),
      body: payload.passed
        ? t("The recovery quick check passed before commit and TaskRun launch.")
        : t("The recovery quick check failed before commit and TaskRun launch."),
      chips: [
        { label: "turn", value: payload.turn_id },
        { label: "evidence", value: payload.validation_path },
      ],
    },
    "task.adapter.validation_failed": {
      title: t("Adapter recovery stopped"),
      body: payload.reason || t("The adapter quick check failed, so no commit or TaskRun was launched."),
      chips: [
        { label: "turn", value: payload.turn_id },
        { label: "evidence", value: payload.validation_path },
      ],
    },
    "loop.adapter.updated": {
      title: t("Adapter update saved"),
      body: t("The loop contract was updated without launching a TaskRun."),
      chips: [{ label: "adapter", value: taskAdapterText(payload.task_adapter_mode) }],
    },
    "run.completed": {
      title: `TaskRun ${labelize(payload.status || "completed")}`,
      body: payload.summary || t("The external work callback was recorded."),
      chips: [
        { label: "run", value: payload.run_id },
        { label: "turn", value: payload.turn_id },
        { label: "metrics", value: metricText(payload.metrics) },
        { label: "error", value: payload.error },
      ],
    },
    "run.callback.duplicate": {
      title: t("Duplicate callback ignored"),
      body: t("This run result had already been processed, so the orchestrator kept state unchanged."),
      chips: [{ label: "run", value: payload.run_id }],
    },
    "loop.callback.handled": {
      title: t("Callback processed"),
      body: t("The orchestrator updated loop state from the TaskRun result."),
      chips: [
        { label: "turn", value: payload.turn_id },
        { label: "decision", value: labelize(payload.decision) },
      ],
    },
    "operator.guidance.submitted": {
      title: payload.revised_objective ? t("Goal guidance submitted") : t("Operator guidance submitted"),
      body: payload.revised_objective
        ? t("The loop objective was revised and the next Codex turn will receive this guidance.")
        : t("The next Codex turn will receive this operator instruction in its evidence packet."),
      chips: [
        { label: "applies", value: labelize(payload.applies_to) },
        { label: "artifact", value: payload.artifact_path },
      ],
    },
    "loop.paused": {
      title: t("Loop paused"),
      body: t("Orchestrator execution is stopped until a resume command is received."),
      chips: [],
    },
    "loop.resumed": {
      title: t("Loop resumed"),
      body: t("The orchestrator can continue from its stored state."),
      chips: [],
    },
    "loop.cancelled": {
      title: t("Loop cancelled"),
      body:
        payload.external_task_control === "not_terminated"
          ? t("Orchestration was cancelled. The external TaskRun was not terminated and remains with its owner.")
          : t("The orchestrator will not schedule more turns for this loop."),
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
    start: status === "ready",
    step: status === "ready",
    collect: status === "waiting_callback" && loop.callback_ready === true,
    pause: !terminalStates.has(status) && status !== "paused" && status !== "waiting_callback" && status !== "needs_setup",
    resume: status === "paused" || status === "review_required",
    cancel: !terminalStates.has(status),
    terminate:
      ["training_running", "waiting_callback"].includes(status) &&
      Boolean(loop.last_run_id) &&
      loop.run_owner === "local_subprocess",
  };
}

function renderCommandControls(loop, actions) {
  const waitingForCallback = loop.status === "waiting_callback" && !loop.callback_ready;
  const noLocalRun = ["training_running", "waiting_callback"].includes(loop.status) && !actions.terminate;
  return `
    <div class="command-groups">
      <div class="command-group">
        <div class="command-group-title">${escapeHtml(t("Run"))}</div>
        <div class="button-row">
          <button class="button primary" data-action="start" ${actions.start ? "" : "disabled"}>${escapeHtml(t("Run until pause"))}</button>
          <button class="button" data-action="step" ${actions.step ? "" : "disabled"}>${escapeHtml(t("Run one turn"))}</button>
        </div>
      </div>
      <div class="command-group">
        <div class="command-group-title">${escapeHtml(t("Wake"))}</div>
        ${
          loop.callback_ready
            ? `<button class="button" data-action="collect-callback" ${actions.collect ? "" : "disabled"}>${escapeHtml(t("Collect callback"))}</button>`
            : `
              <div class="command-status ${waitingForCallback ? "waiting" : ""}">
                <strong>${escapeHtml(waitingForCallback ? t("Waiting for callback") : t("Callback not ready"))}</strong>
                <span>${escapeHtml(waitingForCallback ? t("No callback is ready yet. CALO is paused; the external owner must write the wake result.") : t("No TaskRun is running."))}</span>
              </div>
            `
        }
      </div>
      <div class="command-group">
        <div class="command-group-title">${escapeHtml(t("Loop control"))}</div>
        <div class="button-row">
          <button class="button" data-action="pause" ${actions.pause ? "" : "disabled"}>${escapeHtml(t("Pause loop"))}</button>
          <button class="button" data-action="resume" ${actions.resume ? "" : "disabled"}>${escapeHtml(t("Resume loop"))}</button>
          <button class="button danger-secondary" data-action="cancel" ${actions.cancel ? "" : "disabled"}>${escapeHtml(t("Cancel orchestration"))}</button>
        </div>
      </div>
      <div class="command-group">
        <div class="command-group-title">${escapeHtml(t("TaskRun process"))}</div>
        <button class="button danger" data-action="terminate-run" ${actions.terminate ? "" : "disabled"}>${escapeHtml(t("Terminate local TaskRun"))}</button>
        ${noLocalRun ? `<p class="command-note">${escapeHtml(t("No local subprocess is running for CALO to terminate."))}</p>` : ""}
      </div>
    </div>
  `;
}

async function loadDashboard() {
  try {
    els.health.textContent = t("Connected");
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
    els.health.textContent = t("Disconnected");
    els.health.className = "health error";
    els.detail.innerHTML = `<div class="detail-empty">${escapeHtml(t("Unable to load dashboard:"))} ${escapeHtml(error.message)}</div>`;
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
    : [{ label: t("Workspace"), path: state.defaultRepoPath || "" }];
  els.goalRepo.innerHTML = options
    .filter((option) => option.path)
    .map((option) => `<option value="${escapeHtml(option.path)}">${escapeHtml(option.label)} - ${escapeHtml(option.path)}</option>`)
    .join("");
}

function selectRepoPath(path, label = t("Selected folder")) {
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
  els.repoBrowserList.innerHTML = `<div class="empty-timeline">${escapeHtml(t("Loading directories..."))}</div>`;
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
      : `<div class="empty-timeline">${escapeHtml(t("No readable child directories."))}</div>`;
    els.repoBrowserList.querySelectorAll(".repo-dir").forEach((button) => {
      button.addEventListener("click", () => loadRepoDirectory(button.dataset.path));
    });
  } catch (error) {
    els.repoBrowserList.innerHTML = `<div class="empty-timeline">${escapeHtml(t("Directory could not be opened."))}</div>`;
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
    els.repoBrowseToggle.textContent = opening ? t("Hide") : t("Browse");
    if (opening) loadRepoDirectory(els.goalRepo.value || state.defaultRepoPath);
  });
  els.repoParent.addEventListener("click", () => {
    if (els.repoParent.dataset.path) loadRepoDirectory(els.repoParent.dataset.path);
  });
  els.repoRoot.addEventListener("click", () => loadRepoDirectory("/"));
  els.repoUse.addEventListener("click", () => {
    selectRepoPath(state.repoBrowserPath, t("Browsed folder"));
    setRepoBrowserMessage(t("Repository folder selected."), "success");
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
    setGoalMessage(t("Goal brief and repository selection are required."), "error");
    return;
  }
  if (taskAdapterMode === "command" && !taskCommand) {
    setGoalMessage(t("Command adapter needs a long-work adapter command."), "error");
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
  setGoalMessage(t("Creating loop..."));
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
    state.actionMessage =
      state.language === "zh"
        ? `${t("Created with")} ${runnerText(state.runner, state.model)} 和 ${taskAdapterText(taskAdapterMode)}。${t("Select Run until pause or Run one turn to begin.")}`
        : `Created with ${runnerText(state.runner, state.model)} and ${taskAdapterText(taskAdapterMode)}. Select Run until pause or Run one turn to begin.`;
    state.actionMessageKind = "success";
    setGoalMessage(
      state.language === "zh"
        ? `${t("Created")} ${created.loop_id}，${t("with")} ${runnerText(state.runner, state.model)} 和 ${taskAdapterText(taskAdapterMode)}。`
        : `Created ${created.loop_id} with ${runnerText(state.runner, state.model)} and ${taskAdapterText(taskAdapterMode)}.`,
      "success"
    );
    await loadDashboard();
  } catch (error) {
    setGoalMessage(`${t("Create failed:")} ${error.message}`, "error");
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
    state.actionMessage = t("Guidance failed: write an instruction for the next Codex turn.");
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

function renderTaskAdapterSetup(loop) {
  const setupStates = new Set(["ready", "needs_setup", "paused", "review_required"]);
  if (!setupStates.has(loop.status) || (loop.status !== "needs_setup" && loop.task_adapter_mode !== "none")) return "";
  const continueChecked = loop.status === "needs_setup" ? "checked" : "";
  const continueDisabled = loop.status === "needs_setup" ? "" : "disabled";
  return `
    <div class="section-title">${escapeHtml(t("External work setup"))}</div>
    <form id="task-adapter-form" class="adapter-setup-form">
      <div class="adapter-setup-copy">
        <strong>${escapeHtml(loop.status === "needs_setup" ? t("Choose what happens to this accepted change") : t("Choose external work behavior before starting"))}</strong>
        <span>
          ${escapeHtml(t("Command runs your workload. Demo records fake lifecycle evidence. None leaves the loop stopped without commit or TaskRun launch."))}
        </span>
      </div>
      <div class="field-grid">
        <div class="field-block">
          <label for="adapter-setup-mode">${escapeHtml(t("External work type"))}</label>
          <select id="adapter-setup-mode" name="task_adapter_mode">
            <option value="command" selected>${escapeHtml(t("Run my command"))}</option>
            <option value="demo">${escapeHtml(t("Demo fake TaskRun"))}</option>
            <option value="none">${escapeHtml(t("Stop before TaskRun"))}</option>
          </select>
          <small id="adapter-setup-help" class="field-help">${escapeHtml(t("Run a real command after a Codex turn is accepted."))}</small>
        </div>
        <label class="check-row adapter-continue" for="adapter-continue-current">
          <input id="adapter-continue-current" name="continue_current_turn" type="checkbox" ${continueChecked} ${continueDisabled} />
          <span>${escapeHtml(t("Continue current accepted turn"))}</span>
        </label>
      </div>
      <div id="adapter-setup-command-fields" class="field-grid">
        <div class="field-block">
          <label for="adapter-validation-command">${escapeHtml(t("Quick check"))}</label>
          <input id="adapter-validation-command" name="validation_command" type="text" placeholder="${escapeHtml(t("optional, for example: pytest -q"))}" />
          <small class="field-help">${escapeHtml(t("Fast check CALO runs before launching external work. Leave blank to skip."))}</small>
        </div>
        <div class="field-block wide-field">
          <label for="adapter-task-command">${escapeHtml(t("External work command"))}</label>
          <input id="adapter-task-command" name="task_command" type="text" placeholder="python train.py --callback-file {callback_file} --run-id {run_id} --turn-id {turn_id} --loop-id {loop_id}" />
          <small class="field-help">${escapeHtml(t("{callback_file}, {run_id}, {turn_id}, and {loop_id} are filled by CALO so the run can wake the loop with evidence."))}</small>
        </div>
      </div>
      <button class="button primary" type="submit">${escapeHtml(loop.status === "needs_setup" ? t("Configure and continue") : t("Save adapter"))}</button>
    </form>
  `;
}

function syncDetailAdapterFields() {
  const form = els.detail.querySelector("#task-adapter-form");
  if (!form) return;
  const mode = form.querySelector("#adapter-setup-mode").value;
  const fields = form.querySelector("#adapter-setup-command-fields");
  const help = form.querySelector("#adapter-setup-help");
  const validation = form.querySelector("#adapter-validation-command");
  const task = form.querySelector("#adapter-task-command");
  fields.hidden = mode === "none";
  if (mode === "demo") {
    help.textContent = t("Demo mode writes a tiny score fixture and fake TaskRun script. Use it only to test lifecycle wiring.");
    if (!validation.value.trim()) validation.value = "python -m py_compile target_app.py";
    if (!task.value.trim()) {
      task.value = "python fake_train.py --callback-file {callback_file} --run-id {run_id} --turn-id {turn_id}";
    }
  } else if (mode === "command") {
    help.textContent = t("Command mode re-runs the quick check, then launches your real external work after the accepted Codex turn.");
    if (task.value.includes("fake_train.py")) task.value = "";
  } else {
    help.textContent = t("Stop boundary: CALO can run the Codex turn, then stops before commit or TaskRun launch.");
    validation.value = "";
    task.value = "";
  }
}

async function submitTaskAdapter(loop) {
  const form = els.detail.querySelector("#task-adapter-form");
  const formData = new FormData(form);
  const mode = `${formData.get("task_adapter_mode") || "command"}`;
  const validationCommand = `${formData.get("validation_command") || ""}`.trim();
  const taskCommand = `${formData.get("task_command") || ""}`.trim();
  if (mode === "command" && !taskCommand) {
    throw new Error(t("Command adapter needs an external work command."));
  }
  const payload = {
    task_adapter_mode: mode,
    validation_command: validationCommand || null,
    task_command: taskCommand || null,
    continue_current_turn: Boolean(formData.get("continue_current_turn")),
  };
  const response = await fetch(`/api/v1/loops/${encodeURIComponent(loop.loop_id)}/task-adapter${runnerQuery(loop)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `${t("adapter setup failed with HTTP")} ${response.status}`);
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
        state.detailTab = "overview";
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
    els.detailTitle.textContent = t("Select a loop");
    els.detailStatus.textContent = t("No loop");
    els.detailStatus.className = "status neutral";
    els.detail.innerHTML = `<div class="detail-empty">${escapeHtml(t("No loop selected."))}</div>`;
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
      <section class="runner-banner warning compact" aria-label="Execution backend">
        <strong>${escapeHtml(t("Demo simulation backend"))}</strong>
        <span>${escapeHtml(t("This loop uses the deterministic local runner. It does not open real Codex Planner, Worker, or Judge sessions."))}</span>
      </section>
    `
    : `
      <section class="runner-banner ok compact" aria-label="Execution backend">
        <strong>${escapeHtml(runnerText(loop))}</strong>
        <span>${escapeHtml(t("Run controls and callback judging use the runner stored on this loop."))}</span>
      </section>
    `;
  const adapterBanner =
    loop.task_adapter_mode === "none"
      ? `
      <section class="runner-banner warning compact" aria-label="External work mode">
        <strong>${escapeHtml(t("No external work configured"))}</strong>
        <span>${escapeHtml(t("No TaskRun is running. CALO will stop before commit and external work until you choose Command or Demo."))}</span>
      </section>
    `
      : loop.task_adapter_mode === "demo"
        ? `
      <section class="runner-banner warning compact" aria-label="External work mode">
        <strong>${escapeHtml(t("Demo fake TaskRun mode"))}</strong>
        <span>${escapeHtml(t("This loop uses the fake score fixture for lifecycle testing. It is not executing your real workload."))}</span>
      </section>
    `
        : `
      <section class="runner-banner ok compact" aria-label="External work mode">
        <strong>${escapeHtml(t("Command TaskRun mode"))}</strong>
        <span>${escapeHtml(t("Accepted changes can launch the configured external command with a callback file and run manifest."))}</span>
      </section>
    `;
  const artifactWarning = loop.artifact_root_exists === false
    ? `
      <section class="runner-banner warning" aria-label="Artifact warning">
        <strong>${escapeHtml(t("Artifact directory missing"))}</strong>
        <span>${escapeHtml(t("The database still has loop state, but the evidence directory is not present:"))} ${escapeHtml(loop.artifact_root)}</span>
      </section>
    `
    : "";
  const tabs = [
    { id: "overview", label: t("Overview") },
    { id: "work", label: t("Work") },
    { id: "evidence", label: t("Evidence") },
    { id: "timeline", label: t("Timeline") },
  ];
  if (!tabs.some((tab) => tab.id === state.detailTab)) state.detailTab = "overview";
  const tabButtons = tabs
    .map(
      (tab) => `
        <button
          class="detail-tab ${state.detailTab === tab.id ? "active" : ""}"
          type="button"
          role="tab"
          aria-selected="${state.detailTab === tab.id ? "true" : "false"}"
          aria-controls="detail-tab-panel"
          data-detail-tab="${escapeHtml(tab.id)}"
        >${escapeHtml(tab.label)}</button>
      `
    )
    .join("");
  const stateGrid = `
    <div class="key-grid">
      <div><span>${escapeHtml(t("Mode"))}</span><strong>${escapeHtml(loop.execution_mode)}</strong></div>
      <div><span>${escapeHtml(t("Execution backend"))}</span><strong>${escapeHtml(runnerText(loop))}</strong></div>
      <div><span>${escapeHtml(t("External work mode"))}</span><strong>${escapeHtml(taskAdapterText(loop.task_adapter_mode))}</strong></div>
      <div><span>${escapeHtml(t("Last run"))}</span><strong>${escapeHtml(formatValue(loop.last_run_id))}</strong></div>
      <div><span>${escapeHtml(t("Last decision"))}</span><strong>${escapeHtml(loop.last_decision ? labelize(loop.last_decision) : "n/a")}</strong></div>
      <div><span>${escapeHtml(t("Updated"))}</span><strong>${escapeHtml(formatDate(loop.updated_at))}</strong></div>
      <div><span>${escapeHtml(t("Repository"))}</span><strong>${escapeHtml(formatValue(loop.repo_path))}</strong></div>
      <div><span>${escapeHtml(t("Artifact root"))}</span><strong>${escapeHtml(formatValue(loop.artifact_root))}</strong></div>
      <div><span>${escapeHtml(t("Run owner"))}</span><strong>${escapeHtml(formatValue(loop.run_owner))}</strong></div>
      <div><span>${escapeHtml(t("Run status"))}</span><strong>${escapeHtml(formatValue(loop.run_status))}</strong></div>
      <div><span>${escapeHtml(t("Callback"))}</span><strong>${escapeHtml(callbackState)}</strong></div>
      <div><span>${escapeHtml(t("Wake path"))}</span><strong>${escapeHtml(formatValue(loop.wake_path))}</strong></div>
      <div><span>${escapeHtml(t("Run log"))}</span><strong>${escapeHtml(formatValue(loop.run_stdout_path))}</strong></div>
      <div><span>${escapeHtml(t("Codex control"))}</span><strong>${escapeHtml(loop.codex_control ? labelize(loop.codex_control) : "n/a")}</strong></div>
      <div><span>${escapeHtml(t("Run manifest"))}</span><strong>${escapeHtml(formatValue(loop.run_manifest_path))}</strong></div>
    </div>
  `;
  const tabPanels = {
    overview: `
      <div class="detail-overview-grid">
        <section class="detail-card">
          <div class="section-title compact">${escapeHtml(t("State"))}</div>
          ${stateGrid}
        </section>
        <section class="detail-card">
          <div class="section-title compact">${escapeHtml(t("Codex sessions"))}</div>
          ${renderCodexSessions(loop.recent_events || [])}
        </section>
      </div>
    `,
    work: `
      <div class="detail-overview-grid">
        <section class="detail-card">
          <div class="section-title compact">${escapeHtml(t("Guide next Codex turn"))}</div>
          ${renderGuidanceForm(loop)}
          <div class="section-title compact">${escapeHtml(t("Operator guidance"))}</div>
          ${renderOperatorGuidance(loop.operator_guidance)}
        </section>
        <section class="detail-card detail-scroll">
          <div class="section-title compact">${escapeHtml(t("Task graph"))}</div>
          ${renderTaskGraph(loop.task_graph)}
          <div class="section-title compact">${escapeHtml(t("TaskRuns"))}</div>
          ${renderTaskRuns(loop.task_runs)}
        </section>
      </div>
    `,
    evidence: `
      <section class="detail-card detail-scroll">
        <div class="section-title compact">${escapeHtml(t("Artifacts"))}</div>
        ${renderArtifacts(loop.artifacts)}
      </section>
    `,
    timeline: `
      <section class="detail-card detail-scroll">
        <div class="section-title compact">${escapeHtml(t("Loop timeline"))}</div>
        <div class="event-list">${renderEvents(loop.recent_events || [])}</div>
      </section>
    `,
  };
  els.detail.innerHTML = `
    <div class="detail-body">
      ${runnerBanner}
      ${adapterBanner}
      ${artifactWarning}
      <section class="phase-panel" aria-label="${escapeHtml(t("Current phase"))}">
        <div>
          <div class="phase-kicker">${escapeHtml(t("Current phase"))}</div>
          <div class="phase-title">${escapeHtml(phaseTitle)}</div>
          <div class="phase-body">${escapeHtml(phaseBody)}</div>
        </div>
        <div class="next-action">
          <span>${escapeHtml(t("Next action"))}</span>
          <strong>${escapeHtml(nextActionText(loop))}</strong>
        </div>
      </section>
      <div class="detail-grid">
        <div class="stat"><div class="stat-label">${escapeHtml(t("Turns used"))}</div><div class="stat-value">${escapeHtml(`${loop.turn}/${loop.max_turns}`)}</div></div>
        <div class="stat"><div class="stat-label">${escapeHtml(t("Turn budget"))}</div><div class="stat-value">${escapeHtml(`${loop.progress_percent}%`)}</div></div>
        <div class="stat"><div class="stat-label">${escapeHtml(loop.target_metric)}</div><div class="stat-value">${escapeHtml(`${formatValue(loop.best_metric)} / ${formatValue(loop.target_value)}`)}</div></div>
        <div class="stat"><div class="stat-label">${escapeHtml(t("Metric target"))}</div><div class="stat-value">${escapeHtml(metricPercent)}</div></div>
        <div class="stat"><div class="stat-label">${escapeHtml(t("Elapsed"))}</div><div class="stat-value">${escapeHtml(formatDuration(loop.elapsed_seconds))}</div></div>
        <div class="stat"><div class="stat-label">${escapeHtml(t("Token estimate"))}</div><div class="stat-value">${escapeHtml(formatTokenEstimate(loop))}</div></div>
      </div>
      <section class="detail-command-center" aria-label="${escapeHtml(t("Loop controls"))}">
        <div class="command-primary">
          <div class="section-title compact">${escapeHtml(t("Objective"))}</div>
          <div class="objective-full markdown-body">${renderMarkdown(loop.objective)}</div>
          ${renderTaskAdapterSetup(loop)}
        </div>
        <div class="command-actions">
          <div class="section-title compact">${escapeHtml(t("Actions"))}</div>
          ${renderCommandControls(loop, actions)}
          <div id="action-message" class="action-message ${escapeHtml(state.actionMessageKind)}" role="status" aria-live="polite">${escapeHtml(state.actionMessage)}</div>
        </div>
      </section>
      <section class="detail-tabs" aria-label="${escapeHtml(t("Loop detail sections"))}">
        <div class="detail-tab-list" role="tablist" aria-label="${escapeHtml(t("Loop detail sections"))}">${tabButtons}</div>
        <div id="detail-tab-panel" class="detail-tab-panel" role="tabpanel">
          ${tabPanels[state.detailTab]}
        </div>
      </section>
    </div>
  `;
  els.detail.querySelectorAll("[data-detail-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.detailTab = button.dataset.detailTab;
      renderDetail(loop);
    });
  });
  els.detail.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      const actionMessage = els.detail.querySelector("#action-message");
      actionMessage.textContent =
        state.language === "zh"
          ? `${button.textContent} 使用 ${runnerText(loop)}...`
          : `${button.textContent} with ${runnerText(loop)}...`;
      actionMessage.className = "action-message";
      try {
        const result = await postAction(loop, button.dataset.action);
        state.actionMessage =
          state.language === "zh"
            ? `${button.textContent} ${t("succeeded")}: ${labelize(result.status || result.external_task_control)}.`
            : `${button.textContent} succeeded: ${labelize(result.status || result.external_task_control)}.`;
        state.actionMessageKind = "success";
        await loadDashboard();
      } catch (error) {
        state.actionMessage =
          state.language === "zh"
            ? `${button.textContent} ${t("failed")}: ${error.message}`
            : `${button.textContent} failed: ${error.message}`;
        state.actionMessageKind = "error";
        actionMessage.textContent = state.actionMessage;
        actionMessage.className = "action-message error";
      } finally {
        button.disabled = false;
      }
    });
  });
  const guidanceForm = els.detail.querySelector("#guidance-form");
  if (guidanceForm) {
    guidanceForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = guidanceForm.querySelector('button[type="submit"]');
      submit.disabled = true;
      const actionMessage = els.detail.querySelector("#action-message");
      actionMessage.textContent = t("Submitting guidance...");
      actionMessage.className = "action-message";
      try {
        const result = await submitGuidance(loop);
        state.actionMessage = result.revised_objective
          ? t("Guidance saved and goal brief revised.")
          : t("Guidance saved for the next Codex turn.");
        state.actionMessageKind = "success";
        await loadDashboard();
      } catch (error) {
        state.actionMessage = `${t("Guidance failed:")} ${error.message}`;
        state.actionMessageKind = "error";
        actionMessage.textContent = state.actionMessage;
        actionMessage.className = "action-message error";
      } finally {
        submit.disabled = false;
      }
    });
  }
  const adapterForm = els.detail.querySelector("#task-adapter-form");
  if (adapterForm) {
    const mode = adapterForm.querySelector("#adapter-setup-mode");
    mode.addEventListener("change", syncDetailAdapterFields);
    syncDetailAdapterFields();
    adapterForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = adapterForm.querySelector('button[type="submit"]');
      submit.disabled = true;
      const actionMessage = els.detail.querySelector("#action-message");
      actionMessage.textContent = loop.status === "needs_setup" ? t("Configuring adapter and continuing current turn...") : t("Saving adapter...");
      actionMessage.className = "action-message";
      try {
        const result = await submitTaskAdapter(loop);
        state.actionMessage =
          loop.status === "needs_setup"
            ? `${t("Adapter configured; current turn continued:")} ${labelize(result.status)}.`
            : `${t("Adapter configured:")} ${labelize(result.status)}.`;
        state.actionMessageKind = "success";
        await loadDashboard();
      } catch (error) {
        state.actionMessage = `${t("Adapter setup failed:")} ${error.message}`;
        state.actionMessageKind = "error";
        actionMessage.textContent = state.actionMessage;
        actionMessage.className = "action-message error";
      } finally {
        submit.disabled = false;
      }
    });
  }
}

els.refresh.addEventListener("click", loadDashboard);
els.goalForm.addEventListener("submit", submitGoal);
if (els.goalRunner) els.goalRunner.addEventListener("change", syncRunnerDefaults);
if (els.goalTaskAdapter) els.goalTaskAdapter.addEventListener("change", syncTaskAdapterFields);
if (els.goalObjective) els.goalObjective.addEventListener("input", syncGoalMarkdownPreview);
if (els.languageToggle) {
  els.languageToggle.addEventListener("click", () => {
    state.language = state.language === "zh" ? "en" : "zh";
    window.localStorage.setItem("calo.language", state.language);
    applyI18n();
    syncGoalMarkdownPreview();
    syncTaskAdapterFields();
    render();
  });
}
initRepoBrowser();
initLayoutResize();
applyI18n();
syncGoalMarkdownPreview();
syncTaskAdapterFields();
loadContext().then(loadDashboard);
setInterval(loadDashboard, 5000);
