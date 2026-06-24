from __future__ import annotations

from .models import LoopContract, LoopState, LoopSummary
from .store import StateStore


def build_loop_summary(store: StateStore, state: LoopState, contract: LoopContract) -> LoopSummary:
    max_turns = max(contract.iteration_limits.max_turns, 1)
    progress_percent = min(100, round((state.turn / max_turns) * 100))
    metric_percent = None
    if state.best_metric is not None and contract.target_value:
        metric_percent = max(0, min(100, round((state.best_metric / contract.target_value) * 100)))
    return LoopSummary(
        loop_id=state.loop_id,
        objective=contract.objective,
        status=state.status,
        turn=state.turn,
        max_turns=max_turns,
        progress_percent=progress_percent,
        target_metric=contract.target_metric,
        target_value=contract.target_value,
        best_metric=state.best_metric,
        metric_percent=metric_percent,
        last_decision=state.last_decision,
        last_run_id=state.last_run_id,
        updated_at=state.updated_at,
        repo_path=str(contract.repo_path),
        execution_mode=contract.execution_mode,
        recent_events=store.recent_events(state.loop_id),
    )


def list_loop_summaries(store: StateStore) -> list[LoopSummary]:
    summaries: list[LoopSummary] = []
    for state in store.list_loops():
        try:
            contract = store.load_contract(state.loop_id)
        except KeyError:
            continue
        summaries.append(build_loop_summary(store, state, contract))
    return summaries
