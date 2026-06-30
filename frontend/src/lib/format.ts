import type { LoopSummaryLike } from "../api/types";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function escapeHtml(value: unknown): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };
  return `${value ?? ""}`.replace(/[&<>"']/g, (char) => entities[char]);
}

export function escapeAttribute(value: unknown): string {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

export function formatValue(value: unknown, fallback = "n/a"): string {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number") return Number.isInteger(value) ? `${value}` : value.toFixed(3);
  return `${value}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function formatDuration(seconds: number | null | undefined): string {
  const total = Number(seconds || 0);
  if (!Number.isFinite(total) || total <= 0) return "0s";
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = Math.floor(total % 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export function formatTokens(value: number | null | undefined): string {
  const count = Number(value || 0);
  if (!Number.isFinite(count) || count <= 0) return "0";
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return `${Math.round(count)}`;
}

export function formatTokenEstimate(loop: Pick<LoopSummaryLike, "estimated_codex_tokens" | "token_budget_hint">): string {
  const used = formatTokens(loop.estimated_codex_tokens);
  const budget = loop.token_budget_hint ? formatTokens(loop.token_budget_hint) : null;
  return budget ? `${used} / ${budget}` : used;
}

export function labelize(value: unknown): string {
  return `${value || "unknown"}`.replaceAll("_", " ");
}

export function statusClass(status: string | null | undefined): string {
  return `status ${status || "neutral"}`;
}
