from __future__ import annotations

import subprocess
from pathlib import Path

from fastapi import FastAPI, Header, Request
from fastapi import HTTPException
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from .artifacts import list_artifacts
from .controller import LoopController
from .codex_runner import CodexCliRunner, LocalDeterministicCodexRunner
from .dashboard import build_loop_summary, list_loop_summaries
from .goal import contract_from_goal
from .models import CallbackPayload, GoalRequest, LoopContract, LoopStatus, OperatorGuidanceRequest
from .security import verify_signature
from .store import StateStore


def create_app(db_path: Path | None = None) -> FastAPI:
    app = FastAPI(title="Codex Agent Loop Orchestrator")
    resolved_db_path = db_path or Path(".calo/state.sqlite3")
    store = StateStore(resolved_db_path)
    ui_dir = Path(__file__).parent / "ui"
    app.mount("/ui", StaticFiles(directory=ui_dir, html=True), name="ui")

    def make_runner(kind: str = "local", model: str | None = None):
        if kind == "local":
            return LocalDeterministicCodexRunner()
        if kind == "codex-cli":
            return CodexCliRunner(model=model)
        raise HTTPException(status_code=400, detail="runner must be one of: local, codex-cli")

    def controller_for(runner: str = "local", model: str | None = None) -> LoopController:
        return LoopController(store, runner=make_runner(runner, model))

    def default_workspace() -> Path:
        if resolved_db_path.name == "state.sqlite3" and resolved_db_path.parent.name == ".calo":
            return resolved_db_path.parent.parent
        return resolved_db_path.parent

    def repo_options() -> list[dict[str, str]]:
        options: dict[str, dict[str, str]] = {}

        def add(path: Path, label: str) -> None:
            resolved = path.expanduser().resolve()
            options[str(resolved)] = {"label": label, "path": str(resolved)}

        workspace = default_workspace()
        add(workspace, "Workspace")
        try:
            git_root = subprocess.run(
                ["git", "rev-parse", "--show-toplevel"],
                cwd=workspace,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                check=True,
            ).stdout.strip()
            if git_root:
                add(Path(git_root), "Current Git repository")
        except Exception:
            pass
        for state in store.list_loops():
            try:
                contract = store.load_contract(state.loop_id)
            except KeyError:
                continue
            add(contract.repo_path, f"Loop repo: {state.loop_id}")
        return list(options.values())

    @app.get("/", include_in_schema=False)
    def root():
        return RedirectResponse(url="/ui/")

    @app.get("/api/v1/context")
    def context():
        return {
            "default_repo_path": str(default_workspace()),
            "repo_options": repo_options(),
            "runner": "local",
            "runner_options": ["local", "codex-cli"],
        }

    @app.post("/api/v1/loops")
    def create_loop(contract: LoopContract):
        return controller_for().create_loop(contract)

    @app.post("/api/v1/goals")
    def create_goal(goal: GoalRequest):
        contract = contract_from_goal(goal)
        return controller_for().create_loop(contract)

    @app.post("/api/v1/loops/{loop_id}/start")
    def start_loop(loop_id: str, runner: str = "local", model: str | None = None):
        controller = controller_for(runner, model)
        contract = controller.load_contract(loop_id)
        state = store.load_state(loop_id)
        if state.status != LoopStatus.READY:
            raise HTTPException(status_code=409, detail=f"cannot start while loop status is {state.status}")
        try:
            return controller.run_until_done(contract)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    @app.post("/api/v1/loops/{loop_id}/step")
    def step_loop(loop_id: str, runner: str = "local", model: str | None = None):
        controller = controller_for(runner, model)
        contract = controller.load_contract(loop_id)
        try:
            return controller.run_one_turn(contract)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    @app.post("/api/v1/loops/{loop_id}/collect-callback")
    def collect_callback(loop_id: str, run_id: str | None = None, runner: str = "local", model: str | None = None):
        controller = controller_for(runner, model)
        contract = controller.load_contract(loop_id)
        try:
            return controller.collect_callback_file(contract, run_id)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/api/v1/loops/{loop_id}/pause")
    def pause_loop(loop_id: str, runner: str = "local", model: str | None = None):
        make_runner(runner, model)
        controller = controller_for()
        contract = controller.load_contract(loop_id)
        try:
            return controller.pause_loop(contract)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    @app.post("/api/v1/loops/{loop_id}/resume")
    def resume_loop(loop_id: str, runner: str = "local", model: str | None = None):
        make_runner(runner, model)
        controller = controller_for()
        contract = controller.load_contract(loop_id)
        return controller.resume_loop(contract)

    @app.post("/api/v1/loops/{loop_id}/cancel")
    def cancel_loop(loop_id: str, runner: str = "local", model: str | None = None):
        make_runner(runner, model)
        controller = controller_for()
        contract = controller.load_contract(loop_id)
        return controller.cancel_loop(contract)

    @app.post("/api/v1/loops/{loop_id}/guidance")
    def submit_guidance(loop_id: str, request: OperatorGuidanceRequest, runner: str = "local", model: str | None = None):
        make_runner(runner, model)
        controller = controller_for()
        contract = controller.load_contract(loop_id)
        return controller.submit_operator_guidance(contract, request)

    @app.post("/api/v1/loops/{loop_id}/runs/{run_id}/terminate")
    def terminate_run(loop_id: str, run_id: str, runner: str = "local", model: str | None = None):
        make_runner(runner, model)
        controller = controller_for()
        contract = controller.load_contract(loop_id)
        try:
            return controller.terminate_task_run(contract, run_id)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    @app.get("/api/v1/loops/{loop_id}")
    def get_loop(loop_id: str):
        return store.load_state(loop_id)

    @app.get("/api/v1/loops")
    def list_loops():
        return store.list_loops()

    @app.get("/api/v1/dashboard")
    def dashboard():
        return list_loop_summaries(store)

    @app.get("/api/v1/loops/{loop_id}/summary")
    def loop_summary(loop_id: str):
        state = store.load_state(loop_id)
        contract = store.load_contract(loop_id)
        return build_loop_summary(store, state, contract)

    @app.get("/api/v1/loops/{loop_id}/events")
    def get_events(loop_id: str):
        return store.list_events(loop_id)

    @app.get("/api/v1/loops/{loop_id}/tasks")
    def get_tasks(loop_id: str):
        store.load_state(loop_id)
        return {"task_graphs": store.list_task_graphs(loop_id), "task_runs": store.list_task_runs(loop_id)}

    @app.get("/api/v1/loops/{loop_id}/artifacts")
    def get_artifacts(loop_id: str):
        state = store.load_state(loop_id)
        contract = store.load_contract(state.loop_id)
        return list_artifacts(contract.artifact_root)

    @app.post("/api/v1/loops/{loop_id}/runs/{run_id}/callback")
    async def callback(
        loop_id: str,
        run_id: str,
        request: Request,
        x_agent_loop_timestamp: str | None = Header(default=None),
        x_agent_loop_signature: str | None = Header(default=None),
    ):
        controller = controller_for()
        contract = controller.load_contract(loop_id)
        body = await request.body()
        verify_signature(contract, body, x_agent_loop_timestamp, x_agent_loop_signature)
        payload = CallbackPayload.model_validate_json(body)
        if payload.run_id != run_id or payload.loop_id != loop_id:
            raise HTTPException(status_code=400, detail="callback path does not match payload")
        try:
            return controller.handle_callback(contract, payload)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    return app
