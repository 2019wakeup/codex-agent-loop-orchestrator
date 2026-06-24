from __future__ import annotations

from pathlib import Path

import typer

from .controller import LoopController
from .models import Commands, IterationLimits, LoopContract
from .store import StateStore

app = typer.Typer(help="Codex Agent Loop Orchestrator MVP")


def _controller(workspace: Path) -> LoopController:
    return LoopController(StateStore(workspace / ".calo" / "state.sqlite3"))


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


if __name__ == "__main__":
    app()
