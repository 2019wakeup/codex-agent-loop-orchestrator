import type { LoopSummaryLike, TaskAdapterMode } from "../api/types";
import { translate, type Language } from "../i18n";
import { formatValue, labelize } from "./format";

export interface ActionConfig {
  start: boolean;
  step: boolean;
  collect: boolean;
  pause: boolean;
  resume: boolean;
  cancel: boolean;
  terminate: boolean;
}

export function runnerText(loopOrKind: Partial<LoopSummaryLike> | string | null | undefined, fallbackModel = "", language: Language = "en"): string {
  const kind = typeof loopOrKind === "string" ? loopOrKind : loopOrKind?.runner_kind;
  const model = typeof loopOrKind === "string" ? fallbackModel : loopOrKind?.runner_model;
  const label = kind === "codex-cli" ? translate("runner.codex", language) : translate("runner.demo", language);
  return model ? `${label} · ${model}` : label;
}

export function taskAdapterText(mode: TaskAdapterMode | string | null | undefined, language: Language = "en"): string {
  const labels: Record<string, string> = {
    none: translate("adapter.none", language),
    command: translate("adapter.command", language),
    demo: translate("adapter.demo", language)
  };
  return labels[mode || ""] || labelize(mode);
}

export function actionConfig(loop: Partial<LoopSummaryLike>): ActionConfig {
  const status = loop.status || "ready";
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
      loop.run_owner === "local_subprocess"
  };
}

export function nextActionText(loop: Partial<LoopSummaryLike>, language: Language = "en"): string {
  const status = loop.status || "ready";
  const actions: Record<string, string> = {
    ready:
      language === "zh"
        ? "运行到下一次暂停，或只运行一轮。"
        : "Run until the next pause, or run exactly one turn.",
    needs_setup:
      language === "zh"
        ? "选择命令适配器或取消该循环；当前没有外部长任务在运行。"
        : "Choose a command adapter or cancel this loop; no external task is running.",
    training_running: language === "zh" ? "等待外部长任务完成。" : "Wait for external work to finish.",
    waiting_callback: loop.callback_ready
      ? language === "zh"
        ? "从唤醒路径收取回调。"
        : "Collect the callback from the wake path."
      : language === "zh"
        ? "等待唤醒路径出现。"
        : "Wait until the wake path exists.",
    paused: language === "zh" ? "准备好后恢复循环。" : "Resume the loop when ready.",
    review_required: language === "zh" ? "审查证据，认可后再恢复。" : "Review artifacts, then resume if acceptable.",
    completed: language === "zh" ? "阅读最终报告，或创建新循环。" : "Read the final report or create a new loop.",
    failed: language === "zh" ? "检查证据，修复原因后再次运行。" : "Inspect artifacts, fix the cause, then run again.",
    cancelled: language === "zh" ? "没有后续计划动作。" : "No further action is scheduled."
  };
  return actions[status] || (language === "zh" ? "监控当前编排阶段。" : "Monitor the current orchestrator phase.");
}

export function statusInsight(loop: Partial<LoopSummaryLike>, language: Language = "en"): [string, string] {
  const target = `${loop.target_metric || "score"} ${formatValue(loop.target_value)}`;
  const messages: Record<string, [string, string]> = {
    ready: [translate("phase.readyTitle", language), translate("phase.readyBody", language)],
    needs_setup: [
      translate("phase.needsSetupTitle", language),
      translate("phase.needsSetupBody", language)
    ],
    waiting_callback: [translate("phase.waitingCallbackTitle", language), translate("phase.waitingCallbackBody", language)],
    completed: [translate("phase.completedTitle", language), translate("phase.completedBody", language, { target })],
    cancelled: [translate("phase.cancelledTitle", language), translate("phase.cancelledBody", language)]
  };
  return messages[loop.status || ""] || [translate("phase.defaultTitle", language), translate("phase.defaultBody", language)];
}
