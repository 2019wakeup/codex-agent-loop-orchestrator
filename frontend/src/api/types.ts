export type LoopStatus =
  | "ready"
  | "needs_setup"
  | "planning"
  | "codex_running"
  | "validation_running"
  | "judging"
  | "policy_checking"
  | "training_running"
  | "waiting_callback"
  | "review_required"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type RunnerKind = "local" | "codex-cli";
export type TaskAdapterMode = "none" | "command" | "demo";

export interface LoopSummaryLike {
  loop_id?: string;
  objective?: string;
  status: LoopStatus | string;
  turn?: number;
  max_turns?: number;
  progress_percent?: number;
  callback_ready?: boolean | null;
  last_run_id?: string | null;
  run_owner?: string | null;
  runner_kind?: RunnerKind | string | null;
  runner_model?: string | null;
  task_adapter_mode?: TaskAdapterMode | string | null;
  runner_is_simulated?: boolean | null;
  artifact_root?: string | null;
  artifact_root_exists?: boolean | null;
  execution_mode?: "sync" | "async" | string;
  last_decision?: string | null;
  updated_at?: string;
  repo_path?: string;
  elapsed_seconds?: number | null;
  wake_path?: string | null;
  run_manifest_path?: string | null;
  run_stdout_path?: string | null;
  run_status?: string | null;
  callback_processed?: boolean | null;
  codex_control?: string | null;
  target_metric?: string;
  target_value?: number | null;
  best_metric?: number | null;
  metric_percent?: number | null;
  estimated_codex_tokens?: number | null;
  token_budget_hint?: number | null;
  artifacts?: ArtifactEntryLike[];
  recent_events?: LoopEventLike[];
  operator_guidance?: OperatorGuidanceLike[];
  task_runs?: TaskRunRecordLike[];
  task_graph?: unknown;
}

export interface LoopEventLike {
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface OperatorGuidanceLike {
  message: string;
  applies_to?: string;
  created_at?: string;
  revised_objective?: string | null;
}

export interface TaskRunRecordLike {
  run_id: string;
  status: string;
  turn_id?: string | null;
  owner?: string | null;
  pid?: number | null;
  external_task_control?: string | null;
  wake_path?: string | null;
}

export interface ContextResponse {
  default_repo_path: string;
  repo_options: Array<{ label: string; path: string }>;
  runner: RunnerKind | string;
  runner_options: string[];
  codex_cli_available: boolean;
}

export interface FilesystemResponse {
  path: string;
  parent: string | null;
  entries: Array<{ name: string; path: string }>;
}

export interface ArtifactEntryLike {
  path: string;
  display_name?: string | null;
  kind?: string | null;
  size_bytes?: number | null;
  modified_at?: string | null;
  preview?: string | null;
  source?: string | null;
  role?: string | null;
  turn_id?: string | null;
  run_id?: string | null;
}
