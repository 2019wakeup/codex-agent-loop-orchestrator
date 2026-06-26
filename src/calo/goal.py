from __future__ import annotations

import re
from datetime import datetime, timezone

from .models import Commands, GoalRequest, HumanGate, IterationLimits, LoopContract


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

    return LoopContract(
        loop_id=loop_id,
        objective=request.objective.strip(),
        repo_path=request.repo_path,
        target_metric=request.target_metric,
        target_value=request.target_value,
        execution_mode=request.execution_mode,
        iteration_limits=IterationLimits(max_turns=max_turns, patience=patience, min_delta=request.min_delta),
        commands=Commands(validation=request.validation_command, train=request.task_command),
        human_gate=HumanGate(diff_review=request.require_diff_review, auto_commit=request.auto_commit),
    )
