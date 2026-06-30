import type { LoopEventLike } from "../api/types";
import { translate, type Language } from "../i18n";
import { formatDate, formatValue, labelize } from "./format";
import { runnerText, taskAdapterText } from "./loopState";

export interface Chip {
  label: string;
  value: unknown;
}

export interface EventDescription {
  title: string;
  body: string;
  chips: Chip[];
}

export function metricText(metrics: unknown): string {
  if (!metrics || typeof metrics !== "object") return "";
  return Object.entries(metrics as Record<string, unknown>)
    .map(([key, value]) => `${key}=${formatValue(value, "")}`)
    .join(", ");
}

export function shortSha(value: unknown): string {
  return value ? `${value}`.slice(0, 8) : "";
}

export function describeEvent(event: LoopEventLike, language: Language = "en"): EventDescription {
  const payload = event.payload || {};
  const type = event.event_type;
  const fallback: EventDescription = {
    title: labelize(type),
    body: translate("event.fallbackBody", language),
    chips: [{ label: "type", value: type }]
  };
  const descriptions: Record<string, EventDescription> = {
    "loop.created": {
      title: translate("event.loopCreatedTitle", language),
      body: translate("event.loopCreatedBody", language),
      chips: [{ label: "contract", value: payload.contract_path }]
    },
    "task.adapter.required": {
      title: translate("event.adapterRequiredTitle", language),
      body:
        `${payload.reason || ""}` ||
        translate("event.adapterRequiredBody", language),
      chips: [
        { label: translate("common.turn", language), value: payload.turn_id },
        { label: "adapter", value: taskAdapterText(`${payload.task_adapter_mode || "none"}`, language) },
        { label: "next", value: payload.next_step }
      ]
    },
    "task.adapter.configured": {
      title: translate("event.adapterConfiguredTitle", language),
      body: translate("event.adapterConfiguredBody", language),
      chips: [
        { label: "previous", value: taskAdapterText(`${payload.previous_mode || ""}`, language) },
        { label: "current", value: taskAdapterText(`${payload.task_adapter_mode || ""}`, language) }
      ]
    },
    "run.completed": {
      title: translate("event.runCompletedTitle", language, { status: labelize(payload.status || "completed") }),
      body: `${payload.summary || translate("event.runCompletedBody", language)}`,
      chips: [
        { label: translate("common.run", language), value: payload.run_id },
        { label: translate("common.turn", language), value: payload.turn_id },
        { label: "metrics", value: metricText(payload.metrics) },
        { label: "error", value: payload.error }
      ]
    },
    "task.adapter.validation.completed": {
      title: payload.passed ? translate("event.quickCheckPassed", language) : translate("event.quickCheckFailed", language),
      body: payload.passed
        ? translate("event.quickCheckPassedBody", language)
        : translate("event.quickCheckFailedBody", language),
      chips: [
        { label: translate("common.turn", language), value: payload.turn_id },
        { label: translate("common.evidence", language), value: payload.validation_path }
      ]
    },
    "loop.operational_pause": {
      title: translate("event.operationalPauseTitle", language),
      body: `${payload.reason || translate("event.operationalPauseBody", language)}`,
      chips: [
        { label: translate("common.run", language), value: payload.run_id },
        { label: translate("common.owner", language), value: payload.owner },
        { label: translate("common.wake", language), value: payload.wake_path }
      ]
    },
    "git.commit.created": {
      title: translate("event.commitTitle", language),
      body: translate("event.commitBody", language),
      chips: [
        { label: translate("common.turn", language), value: payload.turn_id },
        { label: "sha", value: shortSha(payload.sha) }
      ]
    }
  };
  const description = descriptions[type] || fallback;
  if (payload.runner_kind) {
    description.chips = [
      ...description.chips,
      { label: translate("common.backend", language), value: payload.runner_label || runnerText(`${payload.runner_kind}`, "", language) }
    ];
  }
  return description;
}

export function flattenPayload(value: unknown, prefix = ""): Array<[string, string]> {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    if (!value.length) return [[prefix, "none"]];
    return value.flatMap((item, index) => flattenPayload(item, `${prefix} ${index + 1}`.trim()));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) return [[prefix, "none"]];
    return entries.flatMap(([key, nested]) => flattenPayload(nested, `${prefix} ${labelize(key)}`.trim()));
  }
  return [[prefix, formatValue(value, "")]];
}

export function eventTime(value: string): string {
  return formatDate(value);
}
