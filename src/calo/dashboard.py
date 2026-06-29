from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from .artifacts import list_artifacts, read_json
from .models import LoopContract, LoopState, LoopSummary
from .store import StateStore


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


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
    created_at = _parse_dt(contract.created_at)
    updated_at = datetime.now(timezone.utc)
    elapsed_seconds = 0
    if created_at is not None:
        elapsed_seconds = max(0, round((updated_at - created_at).total_seconds()))
    event_count = len(store.list_events(state.loop_id))
    token_estimate = max(0, (state.turn * 2400) + (event_count * 90) + (len(store.list_operator_guidance(state.loop_id)) * 180))
    runner_label = "Codex CLI" if contract.runner_kind == "codex-cli" else "Local deterministic demo"
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
        runner_kind=contract.runner_kind,
        runner_model=contract.runner_model,
        runner_label=runner_label,
        runner_is_simulated=contract.runner_kind == "local",
        task_adapter_mode=contract.task_adapter_mode,
        artifact_root=str(contract.artifact_root),
        artifact_root_exists=contract.artifact_root.exists(),
        created_at=contract.created_at,
        elapsed_seconds=elapsed_seconds,
        estimated_codex_tokens=token_estimate,
        token_budget_hint=contract.iteration_limits.max_turns * 3000,
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
        operator_guidance=store.list_operator_guidance(state.loop_id),
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
