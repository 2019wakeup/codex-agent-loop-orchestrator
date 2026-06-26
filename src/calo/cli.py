from __future__ import annotations

import json
from pathlib import Path

import typer
import uvicorn

from .controller import LoopController
from .codex_runner import CodexCliRunner, LocalDeterministicCodexRunner
from .goal import contract_from_goal
from .models import Commands, GoalRequest, IterationLimits, LoopContract
from .store import StateStore

app = typer.Typer(help="Codex Agent Loop Orchestrator MVP")


def _make_runner(kind: str, model: str | None = None):
    if kind == "local":
        return LocalDeterministicCodexRunner()
    if kind == "codex-cli":
        return CodexCliRunner(model=model)
    raise typer.BadParameter("runner must be one of: local, codex-cli")


def _controller(workspace: Path, runner: str = "local", model: str | None = None) -> LoopController:
    return LoopController(StateStore(workspace / ".calo" / "state.sqlite3"), runner=_make_runner(runner, model))


def _store(workspace: Path) -> StateStore:
    return StateStore(workspace / ".calo" / "state.sqlite3")


@app.command()
def demo(
    workspace: Path = typer.Option(..., help="Workspace/repo path for the demo loop."),
    target: float = typer.Option(0.7, help="Target score."),
    max_turns: int = typer.Option(3, help="Maximum loop turns."),
    runner: str = typer.Option("local", help="Runner backend: local or codex-cli."),
    model: str | None = typer.Option(None, help="Model for codex-cli runner."),
) -> None:
    workspace.mkdir(parents=True, exist_ok=True)
    loop_id = "demo_loop"
    contract = LoopContract(
        loop_id=loop_id,
        objective=f"Raise fake score to {target}",
        repo_path=workspace,
        target_value=target,
        iteration_limits=IterationLimits(max_turns=max_turns, patience=max_turns),
        commands=Commands(train="python fake_train.py --callback-file {callback_file} --run-id {run_id} --turn-id {turn_id}"),
    )
    controller = _controller(workspace, runner, model)
    controller.create_loop(contract)
    state = controller.run_until_done(contract)
    typer.echo(f"status={state.status}")
    typer.echo(f"turns={state.turn}")
    typer.echo(f"best_score={state.best_metric}")
    typer.echo(f"artifacts={contract.artifact_root}")


@app.command()
def init(
    workspace: Path = typer.Option(..., help="Workspace/repo path."),
    loop_id: str = typer.Option("loop_0001"),
    objective: str = typer.Option("Improve target metric."),
    target: float = typer.Option(0.8),
    runner: str = typer.Option("local", help="Runner backend: local or codex-cli."),
    model: str | None = typer.Option(None, help="Model for codex-cli runner."),
) -> None:
    contract = LoopContract(loop_id=loop_id, objective=objective, repo_path=workspace, target_value=target)
    state = _controller(workspace, runner, model).create_loop(contract)
    typer.echo(f"created {contract.loop_id} status={state.status}")


@app.command()
def create(
    config: Path = typer.Option(..., help="JSON loop contract file."),
    workspace: Path | None = typer.Option(None, help="State workspace. Defaults to contract repo_path."),
    runner: str = typer.Option("local", help="Runner backend: local or codex-cli."),
    model: str | None = typer.Option(None, help="Model for codex-cli runner."),
) -> None:
    contract = LoopContract.model_validate_json(config.read_text(encoding="utf-8"))
    state_workspace = workspace or contract.repo_path
    state = _controller(state_workspace, runner, model).create_loop(contract)
    typer.echo(f"created {contract.loop_id} status={state.status} db={state_workspace / '.calo' / 'state.sqlite3'}")


@app.command()
def goal(
    objective: str = typer.Option(..., "--objective", "-o", help="Plain-language goal brief."),
    workspace: Path = typer.Option(..., help="State workspace for .calo/state.sqlite3."),
    repo_path: Path | None = typer.Option(None, help="Repository/work directory. Defaults to workspace."),
    loop_id: str | None = typer.Option(None, help="Optional stable loop id."),
    target_metric: str = typer.Option("score", help="Metric name the judge/policy should track."),
    target: float = typer.Option(0.8, help="Target metric value."),
    execution_mode: str = typer.Option("sync", help="Execution mode: sync or async."),
    max_turns: int = typer.Option(3, help="Maximum loop turns."),
    patience: int | None = typer.Option(None, help="No-improvement patience. Defaults to max_turns."),
    min_delta: float = typer.Option(0.001, help="Minimum metric improvement."),
    validation_command: str = typer.Option("python -m py_compile target_app.py", help="Fast validation command."),
    task_command: str = typer.Option(
        "python fake_train.py --callback-file {callback_file} --run-id {run_id} --turn-id {turn_id}",
        help="TaskRun command. Supports {callback_file}, {run_id}, and {turn_id}.",
    ),
    require_diff_review: bool = typer.Option(False, help="Require human review before committing/running."),
    auto_commit: bool = typer.Option(True, help="Allow orchestrator audit commits for accepted changes."),
    runner: str = typer.Option("local", help="Runner backend: local or codex-cli."),
    model: str | None = typer.Option(None, help="Model for codex-cli runner."),
) -> None:
    if execution_mode not in {"sync", "async"}:
        raise typer.BadParameter("execution_mode must be one of: sync, async")
    goal_request = GoalRequest(
        objective=objective,
        repo_path=repo_path or workspace,
        loop_id=loop_id,
        target_metric=target_metric,
        target_value=target,
        execution_mode=execution_mode,
        max_turns=max_turns,
        patience=patience,
        min_delta=min_delta,
        validation_command=validation_command,
        task_command=task_command,
        require_diff_review=require_diff_review,
        auto_commit=auto_commit,
    )
    contract = contract_from_goal(goal_request)
    state = _controller(workspace, runner, model).create_loop(contract)
    typer.echo(f"created {contract.loop_id} from goal brief status={state.status}")
    typer.echo(f"objective={contract.objective}")
    typer.echo(f"contract={contract.artifact_root / 'contract.json'}")
    typer.echo(f"start=calo start {contract.loop_id} --workspace {workspace}")


@app.command()
def start(
    loop_id: str = typer.Argument(...),
    workspace: Path = typer.Option(..., help="State workspace used when the loop was created."),
    runner: str = typer.Option("local", help="Runner backend: local or codex-cli."),
    model: str | None = typer.Option(None, help="Model for codex-cli runner."),
) -> None:
    controller = _controller(workspace, runner, model)
    contract = controller.load_contract(loop_id)
    state = controller.run_until_done(contract)
    typer.echo(state.model_dump_json(indent=2))


@app.command("step")
def step(
    loop_id: str = typer.Argument(...),
    workspace: Path = typer.Option(..., help="State workspace used when the loop was created."),
    runner: str = typer.Option("local", help="Runner backend: local or codex-cli."),
    model: str | None = typer.Option(None, help="Model for codex-cli runner."),
) -> None:
    controller = _controller(workspace, runner, model)
    contract = controller.load_contract(loop_id)
    state = controller.run_one_turn(contract)
    typer.echo(state.model_dump_json(indent=2))


@app.command("collect-callback")
def collect_callback(
    loop_id: str = typer.Argument(...),
    workspace: Path = typer.Option(..., help="State workspace used when the loop was created."),
    run_id: str | None = typer.Option(None, help="Run id to collect. Defaults to last run."),
    runner: str = typer.Option("local", help="Runner backend: local or codex-cli."),
    model: str | None = typer.Option(None, help="Model for codex-cli runner."),
) -> None:
    controller = _controller(workspace, runner, model)
    contract = controller.load_contract(loop_id)
    state = controller.collect_callback_file(contract, run_id)
    typer.echo(state.model_dump_json(indent=2))


@app.command()
def pause(
    loop_id: str = typer.Argument(...),
    workspace: Path = typer.Option(..., help="State workspace used when the loop was created."),
) -> None:
    controller = _controller(workspace)
    state = controller.pause_loop(controller.load_contract(loop_id))
    typer.echo(state.model_dump_json(indent=2))


@app.command()
def resume(
    loop_id: str = typer.Argument(...),
    workspace: Path = typer.Option(..., help="State workspace used when the loop was created."),
) -> None:
    controller = _controller(workspace)
    state = controller.resume_loop(controller.load_contract(loop_id))
    typer.echo(state.model_dump_json(indent=2))


@app.command()
def cancel(
    loop_id: str = typer.Argument(...),
    workspace: Path = typer.Option(..., help="State workspace used when the loop was created."),
) -> None:
    controller = _controller(workspace)
    state = controller.cancel_loop(controller.load_contract(loop_id))
    typer.echo(state.model_dump_json(indent=2))


@app.command("terminate-run")
def terminate_run(
    loop_id: str = typer.Argument(...),
    workspace: Path = typer.Option(..., help="State workspace used when the loop was created."),
    run_id: str | None = typer.Option(None, help="TaskRun id to terminate. Defaults to last run."),
) -> None:
    controller = _controller(workspace)
    contract = controller.load_contract(loop_id)
    record = controller.terminate_task_run(contract, run_id)
    typer.echo(record.model_dump_json(indent=2))


@app.command()
def status(
    loop_id: str = typer.Argument(...),
    workspace: Path = typer.Option(..., help="State workspace used when the loop was created."),
) -> None:
    state = _store(workspace).load_state(loop_id)
    typer.echo(state.model_dump_json(indent=2))


@app.command()
def events(
    loop_id: str = typer.Argument(...),
    workspace: Path = typer.Option(..., help="State workspace used when the loop was created."),
) -> None:
    typer.echo(json.dumps(_store(workspace).list_events(loop_id), indent=2, ensure_ascii=False))


@app.command("list")
def list_loops(
    workspace: Path = typer.Option(..., help="State workspace."),
) -> None:
    for state in _store(workspace).list_loops():
        typer.echo(f"{state.loop_id}\t{state.status}\tturn={state.turn}\tbest={state.best_metric}")


@app.command()
def serve(
    workspace: Path = typer.Option(Path("."), help="Workspace containing .calo/state.sqlite3."),
    host: str = typer.Option("127.0.0.1"),
    port: int = typer.Option(8000),
) -> None:
    from .api import create_app

    uvicorn.run(create_app(workspace / ".calo" / "state.sqlite3"), host=host, port=port)


if __name__ == "__main__":
    app()
