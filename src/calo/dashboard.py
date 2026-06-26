from __future__ import annotations

from pathlib import Path

from .artifacts import list_artifacts, read_json
from .models import LoopContract, LoopState, LoopSummary
from .store import StateStore


def build_loop_summary(store: StateStore, state: LoopState, contract: LoopContract) -> LoopSummary:
    max_turns = max(contract.iteration_limits.max_turns, 1)
    progress_percent = min(100, round((state.turn / max_turns) * 100))
    metric_percent = None
    if state.best_metric is not None and contract.target_value:
        metric_percent = max(0, min(100, round((state.best_metric / contract.target_value) * 100)))
    run_owner = None
    wake_path = None
    run_manifest_path = None
    run_stdout_path = None
    run_status = None
    callback_ready = None
    callback_processed = None
    codex_control = None
    if state.last_run_id:
        manifest_path = contract.artifact_root / "runs" / f"{state.last_run_id}_manifest.json"
        if manifest_path.exists():
            manifest = read_json(manifest_path)
            run_manifest_path = str(manifest_path)
            run_owner = manifest.get("owner")
            wake_path = manifest.get("wake_path") or manifest.get("callback_file")
            run_stdout_path = manifest.get("stdout_file")
            run_status = manifest.get("status")
            callback_processed = bool(manifest.get("callback_processed"))
            callback_ready = bool(wake_path) and Path(wake_path).exists() and not callback_processed
            codex_control = manifest.get("codex_control")
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
        run_owner=run_owner,
        wake_path=wake_path,
        run_manifest_path=run_manifest_path,
        run_stdout_path=run_stdout_path,
        run_status=run_status,
        callback_ready=callback_ready,
        callback_processed=callback_processed,
        codex_control=codex_control,
        task_graph=store.latest_task_graph(state.loop_id),
        task_runs=store.list_task_runs(state.loop_id),
        artifacts=list_artifacts(contract.artifact_root, limit=30, preview_chars=240),
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
