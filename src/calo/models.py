from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class LoopStatus(str, Enum):
    CREATED = "created"
    READY = "ready"
    PLANNING = "planning"
    CODEX_RUNNING = "codex_running"
    VALIDATION_RUNNING = "validation_running"
    JUDGING = "judging"
    POLICY_CHECKING = "policy_checking"
    TRAINING_RUNNING = "training_running"
    WAITING_CALLBACK = "waiting_callback"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"
    CANCELLED = "cancelled"
    REVIEW_REQUIRED = "review_required"
    NEEDS_SETUP = "needs_setup"


class Decision(str, Enum):
    CONTINUE_NOW = "continue_now"
    OPERATIONAL_PAUSE = "operational_pause"
    HEALTHY_WAIT = "healthy_wait"
    COMPLETED_VERIFY = "completed_verify"
    FAILED_NEEDS_ACTION = "failed_needs_action"
    BLOCKED_NEEDS_USER = "blocked_needs_user"


class RunStatus(str, Enum):
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"
    PARTIAL = "partial"


class TaskStatus(str, Enum):
    PLANNED = "planned"
    APPROVED = "approved"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class IterationLimits(BaseModel):
    max_turns: int = 3
    patience: int = 2
    min_delta: float = 0.001


class Commands(BaseModel):
    validation: str = "python -m py_compile target_app.py"
    train: str = "python fake_train.py --callback-file {callback_file}"


class HumanGate(BaseModel):
    diff_review: bool = False
    destructive_actions: bool = True
    auto_commit: bool = True


class WebhookSecurity(BaseModel):
    secret: str | None = None
    timestamp_tolerance_seconds: int = 300


class GoalRequest(BaseModel):
    objective: str = Field(min_length=1)
    repo_path: Path
    loop_id: str | None = None
    target_metric: str = "score"
    target_value: float = 0.8
    execution_mode: Literal["sync", "async"] = "sync"
    max_turns: int = 3
    patience: int | None = None
    min_delta: float = 0.001
    validation_command: str | None = None
    task_adapter_mode: Literal["none", "command", "demo"] = "none"
    task_command: str | None = None
    require_diff_review: bool = False
    auto_commit: bool = True
    runner_kind: Literal["local", "codex-cli"] = "local"
    runner_model: str | None = None

    @field_validator("objective")
    @classmethod
    def objective_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("objective must not be blank")
        return stripped

    @field_validator("loop_id")
    @classmethod
    def loop_id_must_be_safe(cls, value: str | None) -> str | None:
        if value is None:
            return value
        allowed = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.-")
        if value in {".", ".."} or not value or any(char not in allowed for char in value):
            raise ValueError("loop_id must be a single path-safe token")
        return value

    @field_validator("task_command")
    @classmethod
    def command_adapter_must_wake_loop(cls, value: str | None, info) -> str | None:
        if info.data.get("task_adapter_mode") == "command":
            command = (value or "").strip()
            if not command:
                raise ValueError("task_command is required when task_adapter_mode is command")
            if "{callback_file}" not in command:
                raise ValueError("task_command must include {callback_file} so the TaskRun can wake the loop")
            return command
        return value

    @model_validator(mode="after")
    def command_adapter_requires_wake_command(self) -> "GoalRequest":
        if self.task_adapter_mode == "command":
            command = (self.task_command or "").strip()
            if not command:
                raise ValueError("task_command is required when task_adapter_mode is command")
            if "{callback_file}" not in command:
                raise ValueError("task_command must include {callback_file} so the TaskRun can wake the loop")
        return self


class OperatorGuidanceRequest(BaseModel):
    message: str = Field(min_length=1)
    revised_objective: str | None = None
    applies_to: Literal["next_turn", "current_loop"] = "next_turn"

    @field_validator("message")
    @classmethod
    def message_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("message must not be blank")
        return stripped

    @field_validator("revised_objective")
    @classmethod
    def revised_objective_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is None:
            return value
        stripped = value.strip()
        if not stripped:
            raise ValueError("revised_objective must not be blank when provided")
        return stripped


class TaskAdapterRequest(BaseModel):
    task_adapter_mode: Literal["none", "command", "demo"] = "command"
    validation_command: str | None = None
    task_command: str | None = None
    continue_current_turn: bool = True

    @field_validator("task_command")
    @classmethod
    def command_adapter_must_wake_loop(cls, value: str | None, info) -> str | None:
        if info.data.get("task_adapter_mode") == "command":
            command = (value or "").strip()
            if not command:
                raise ValueError("task_command is required when task_adapter_mode is command")
            if "{callback_file}" not in command:
                raise ValueError("task_command must include {callback_file} so the TaskRun can wake the loop")
            return command
        return value

    @model_validator(mode="after")
    def command_adapter_requires_wake_command(self) -> "TaskAdapterRequest":
        if self.task_adapter_mode == "command":
            command = (self.task_command or "").strip()
            if not command:
                raise ValueError("task_command is required when task_adapter_mode is command")
            if "{callback_file}" not in command:
                raise ValueError("task_command must include {callback_file} so the TaskRun can wake the loop")
        return self


class OperatorGuidance(BaseModel):
    loop_id: str
    message: str
    applies_to: Literal["next_turn", "current_loop"] = "next_turn"
    revised_objective: str | None = None
    previous_objective: str | None = None
    artifact_path: str | None = None
    created_at: str = Field(default_factory=utc_now)


class LoopContract(BaseModel):
    loop_id: str
    objective: str
    repo_path: Path
    target_metric: str = "score"
    target_value: float = 0.8
    branch: str = "agent-loop/main"
    execution_mode: Literal["sync", "async"] = "sync"
    iteration_limits: IterationLimits = Field(default_factory=IterationLimits)
    commands: Commands = Field(default_factory=Commands)
    human_gate: HumanGate = Field(default_factory=HumanGate)
    webhook: WebhookSecurity = Field(default_factory=WebhookSecurity)
    runner_kind: Literal["local", "codex-cli"] = "local"
    runner_model: str | None = None
    task_adapter_mode: Literal["none", "command", "demo"] = "none"
    created_at: str = Field(default_factory=utc_now)

    @property
    def artifact_root(self) -> Path:
        return self.repo_path / ".codex" / "agent-loop" / self.loop_id

    @field_validator("objective")
    @classmethod
    def objective_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("objective must not be blank")
        return stripped

    @field_validator("loop_id")
    @classmethod
    def loop_id_must_be_safe(cls, value: str) -> str:
        allowed = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.-")
        if value in {".", ".."} or not value or any(char not in allowed for char in value):
            raise ValueError("loop_id must be a single path-safe token")
        return value

    @model_validator(mode="after")
    def command_adapter_requires_wake_command(self) -> "LoopContract":
        if self.task_adapter_mode == "command":
            command = (self.commands.train or "").strip()
            if not command:
                raise ValueError("commands.train is required when task_adapter_mode is command")
            if "{callback_file}" not in command:
                raise ValueError("commands.train must include {callback_file} so the TaskRun can wake the loop")
        return self


class LoopState(BaseModel):
    loop_id: str
    status: LoopStatus = LoopStatus.CREATED
    turn: int = 0
    best_metric: float | None = None
    no_improvement_turns: int = 0
    last_run_id: str | None = None
    last_decision: Decision | None = None
    updated_at: str = Field(default_factory=utc_now)


class PlannerTask(BaseModel):
    id: str
    type: Literal["code_change", "test_change", "config_change", "diagnosis"]
    target_files: list[str]
    instruction: str


class Plan(BaseModel):
    turn_id: str
    objective: str
    hypothesis: str
    tasks: list[PlannerTask]
    expected_impact: dict[str, Any] = Field(default_factory=dict)
    requires_human: bool = False


class TaskNode(BaseModel):
    id: str
    turn_id: str
    type: str
    target_files: list[str] = Field(default_factory=list)
    instruction: str
    status: TaskStatus = TaskStatus.PLANNED
    dependencies: list[str] = Field(default_factory=list)


class TaskGraph(BaseModel):
    loop_id: str
    turn_id: str
    objective: str
    nodes: list[TaskNode] = Field(default_factory=list)
    artifact_path: str | None = None
    updated_at: str = Field(default_factory=utc_now)


class TaskRunRecord(BaseModel):
    loop_id: str
    run_id: str
    turn_id: str
    task_id: str = "external_task"
    status: TaskStatus = TaskStatus.RUNNING
    owner: str | None = None
    command: str | None = None
    pid: int | None = None
    wake_path: str | None = None
    stdout_path: str | None = None
    manifest_path: str | None = None
    callback_processed: bool = False
    external_task_control: Literal["owned", "released", "terminated", "not_terminated", "already_exited", "unknown"] = "unknown"
    created_at: str = Field(default_factory=utc_now)
    updated_at: str = Field(default_factory=utc_now)


class WorkerSummary(BaseModel):
    turn_id: str
    changed_files: list[str]
    validation_commands_to_run: list[str]
    risk_notes: list[str] = Field(default_factory=list)
    expected_metric_impact: str = "unknown"


class JudgeReport(BaseModel):
    turn_id: str
    verdict: Literal[
        "accept_change",
        "needs_fix",
        "continue_next_iteration",
        "stop_success",
        "stop_no_progress",
        "rollback_recommended",
        "needs_human_review",
    ]
    confidence: Literal["low", "medium", "high"]
    accept_change: bool
    rollback_recommended: bool = False
    evidence: list[str]
    risks: list[str] = Field(default_factory=list)
    next_step_recommendation: str | None = None
    requires_human: bool = False


class CallbackPayload(BaseModel):
    loop_id: str
    run_id: str
    turn_id: str
    status: RunStatus
    metrics: dict[str, float] = Field(default_factory=dict)
    artifacts: dict[str, str] = Field(default_factory=dict)
    summary: str | None = None
    error: str | None = None


class PolicyResult(BaseModel):
    decision: Decision
    next_status: LoopStatus
    reason: str
    should_continue: bool
    should_commit: bool = True
    should_launch_training: bool = False


class LoopEvent(BaseModel):
    event_type: str
    payload: dict[str, Any]
    created_at: str


class ArtifactEntry(BaseModel):
    path: str
    kind: Literal["json", "markdown", "text", "log", "file"]
    size_bytes: int
    modified_at: str
    preview: str | None = None
    source: str = "unknown"
    role: Literal["planner", "worker", "judge", "taskrun", "operator", "system", "unknown"] = "unknown"
    turn_id: str | None = None
    run_id: str | None = None
    display_name: str | None = None


class LoopSummary(BaseModel):
    loop_id: str
    objective: str
    status: LoopStatus
    turn: int
    max_turns: int
    progress_percent: int
    target_metric: str
    target_value: float
    best_metric: float | None
    metric_percent: int | None
    last_decision: Decision | None
    last_run_id: str | None
    updated_at: str
    repo_path: str
    execution_mode: Literal["sync", "async"]
    runner_kind: Literal["local", "codex-cli"] = "local"
    runner_model: str | None = None
    runner_label: str = "Local deterministic demo"
    runner_is_simulated: bool = True
    task_adapter_mode: Literal["none", "command", "demo"] = "none"
    artifact_root: str | None = None
    artifact_root_exists: bool = True
    created_at: str | None = None
    elapsed_seconds: int = 0
    estimated_codex_tokens: int = 0
    token_budget_hint: int | None = None
    run_owner: str | None = None
    wake_path: str | None = None
    run_manifest_path: str | None = None
    run_stdout_path: str | None = None
    run_status: str | None = None
    callback_ready: bool | None = None
    callback_processed: bool | None = None
    codex_control: str | None = None
    task_graph: TaskGraph | None = None
    task_runs: list[TaskRunRecord] = Field(default_factory=list)
    artifacts: list[ArtifactEntry] = Field(default_factory=list)
    operator_guidance: list[OperatorGuidance] = Field(default_factory=list)
    recent_events: list[LoopEvent] = Field(default_factory=list)
