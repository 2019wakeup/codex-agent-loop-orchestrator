from __future__ import annotations

import json
from pathlib import Path

import typer

from .controller import LoopController
from .models import Commands, IterationLimits, LoopContract
from .store import StateStore

app = typer.Typer(help="Codex Agent Loop Orchestrator MVP")


def _controller(workspace: Path) -> LoopController:
    return LoopController(StateStore(workspace / ".calo" / "state.sqlite3"))


def _store(workspace: Path) -> StateStore:
    return StateStore(workspace / ".calo" / "state.sqlite3")


@app.command()
def demo(
    workspace: Path = typer.Option(..., help="Workspace/repo path for the demo loop."),
    target: float = typer.Option(0.7, help="Target score."),
    max_turns: int = typer.Option(3, help="Maximum loop turns."),
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
    controller = _controller(workspace)
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
) -> None:
    contract = LoopContract(loop_id=loop_id, objective=objective, repo_path=workspace, target_value=target)
    state = _controller(workspace).create_loop(contract)
    typer.echo(f"created {contract.loop_id} status={state.status}")


@app.command()
def create(
    config: Path = typer.Option(..., help="JSON loop contract file."),
    workspace: Path | None = typer.Option(None, help="State workspace. Defaults to contract repo_path."),
) -> None:
    contract = LoopContract.model_validate_json(config.read_text(encoding="utf-8"))
    state_workspace = workspace or contract.repo_path
    state = _controller(state_workspace).create_loop(contract)
    typer.echo(f"created {contract.loop_id} status={state.status} db={state_workspace / '.calo' / 'state.sqlite3'}")


@app.command()
def start(
    loop_id: str = typer.Argument(...),
    workspace: Path = typer.Option(..., help="State workspace used when the loop was created."),
) -> None:
    controller = _controller(workspace)
    contract = controller.load_contract(loop_id)
    state = controller.run_until_done(contract)
    typer.echo(state.model_dump_json(indent=2))


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


if __name__ == "__main__":
    app()
