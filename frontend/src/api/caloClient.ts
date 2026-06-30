import type { ContextResponse, FilesystemResponse, LoopSummaryLike } from "./types";

export type LoopAction = "start" | "step" | "collect-callback" | "pause" | "resume" | "cancel" | "terminate-run";

export interface CaloClient {
  getContext(): Promise<ContextResponse>;
  listFilesystem(path?: string): Promise<FilesystemResponse>;
  listDashboard(): Promise<LoopSummaryLike[]>;
  createGoal(payload: Record<string, unknown>): Promise<unknown>;
  postLoopAction(loop: Partial<LoopSummaryLike> & { loop_id: string }, action: LoopAction): Promise<unknown>;
  submitGuidance(loop: Partial<LoopSummaryLike> & { loop_id: string }, payload: Record<string, unknown>): Promise<unknown>;
  configureTaskAdapter(loop: Partial<LoopSummaryLike> & { loop_id: string }, payload: Record<string, unknown>): Promise<unknown>;
}

export function runnerQuery(loop: Partial<LoopSummaryLike> | null | undefined): string {
  const params = new URLSearchParams();
  const runner = loop?.runner_kind || "";
  const model = loop?.runner_model || "";
  if (runner) params.set("runner", `${runner}`);
  if (model) params.set("model", model);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function loopActionPath(loop: Partial<LoopSummaryLike> & { loop_id: string }, action: LoopAction): string {
  const loopId = encodeURIComponent(loop.loop_id);
  const query = runnerQuery(loop);
  if (action === "terminate-run") {
    return `/api/v1/loops/${loopId}/runs/${encodeURIComponent(loop.last_run_id || "")}/terminate${query}`;
  }
  return `/api/v1/loops/${loopId}/${action}${query}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `request failed with HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function postJson<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  return requestJson<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function createCaloClient(): CaloClient {
  return {
    getContext: () => requestJson<ContextResponse>("/api/v1/context", { cache: "no-store" }),
    listFilesystem: (path?: string) => {
      const params = new URLSearchParams();
      if (path) params.set("path", path);
      const query = params.toString();
      return requestJson<FilesystemResponse>(`/api/v1/filesystem${query ? `?${query}` : ""}`, { cache: "no-store" });
    },
    listDashboard: () => requestJson<LoopSummaryLike[]>("/api/v1/dashboard", { cache: "no-store" }),
    createGoal: (payload) => postJson("/api/v1/goals", payload),
    postLoopAction: (loop, action) => requestJson(loopActionPath(loop, action), { method: "POST" }),
    submitGuidance: (loop, payload) => postJson(`/api/v1/loops/${encodeURIComponent(loop.loop_id)}/guidance${runnerQuery(loop)}`, payload),
    configureTaskAdapter: (loop, payload) =>
      postJson(`/api/v1/loops/${encodeURIComponent(loop.loop_id)}/task-adapter${runnerQuery(loop)}`, payload)
  };
}
