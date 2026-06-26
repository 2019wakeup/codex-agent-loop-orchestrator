from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


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
    validation_command: str = "python -m py_compile target_app.py"
    task_command: str = "python fake_train.py --callback-file {callback_file} --run-id {run_id} --turn-id {turn_id}"
    require_diff_review: bool = False
    auto_commit: bool = True

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
    run_owner: str | None = None
    wake_path: str | None = None
    run_manifest_path: str | None = None
    run_stdout_path: str | None = None
    run_status: str | None = None
    callback_ready: bool | None = None
    callback_processed: bool | None = None
    codex_control: str | None = None
    recent_events: list[LoopEvent] = Field(default_factory=list)
