from __future__ import annotations

import re
from datetime import datetime, timezone

from .models import Commands, GoalRequest, HumanGate, IterationLimits, LoopContract


DEMO_VALIDATION_COMMAND = "python -m py_compile target_app.py"
DEMO_TASK_COMMAND = "python fake_train.py --callback-file {callback_file} --run-id {run_id} --turn-id {turn_id}"


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", value.strip().lower()).strip("_")
    return slug[:40] or "goal"


def contract_from_goal(request: GoalRequest) -> LoopContract:
    loop_id = request.loop_id
    if not loop_id:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        loop_id = f"{_slugify(request.objective)}_{stamp}"

    max_turns = max(1, request.max_turns)
    patience = request.patience if request.patience is not None else max_turns
    patience = max(1, patience)

    task_adapter_mode = request.task_adapter_mode
    if task_adapter_mode == "none" and request.runner_kind == "local":
        task_adapter_mode = "demo"

    validation_command = request.validation_command or ""
    task_command = request.task_command or ""
    if task_adapter_mode == "demo":
        validation_command = validation_command or DEMO_VALIDATION_COMMAND
        task_command = task_command or DEMO_TASK_COMMAND
    elif task_adapter_mode == "command" and not task_command.strip():
        raise ValueError("task_command is required when task_adapter_mode is command")

    return LoopContract(
        loop_id=loop_id,
        objective=request.objective.strip(),
        repo_path=request.repo_path,
        target_metric=request.target_metric,
        target_value=request.target_value,
        execution_mode=request.execution_mode,
        iteration_limits=IterationLimits(max_turns=max_turns, patience=patience, min_delta=request.min_delta),
        commands=Commands(validation=validation_command, train=task_command),
        human_gate=HumanGate(diff_review=request.require_diff_review, auto_commit=request.auto_commit),
        runner_kind=request.runner_kind,
        runner_model=request.runner_model or None,
        task_adapter_mode=task_adapter_mode,
    )
