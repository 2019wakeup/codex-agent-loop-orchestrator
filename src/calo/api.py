from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Header, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from .controller import LoopController
from .dashboard import build_loop_summary, list_loop_summaries
from .models import CallbackPayload, LoopContract
from .security import verify_signature
from .store import StateStore


def create_app(db_path: Path | None = None) -> FastAPI:
    app = FastAPI(title="Codex Agent Loop Orchestrator")
    store = StateStore(db_path or Path(".calo/state.sqlite3"))
    controller = LoopController(store)
    ui_dir = Path(__file__).parent / "ui"
    app.mount("/ui", StaticFiles(directory=ui_dir, html=True), name="ui")

    @app.get("/", include_in_schema=False)
    def root():
        return RedirectResponse(url="/ui/")

    @app.post("/api/v1/loops")
    def create_loop(contract: LoopContract):
        return controller.create_loop(contract)

    @app.post("/api/v1/loops/{loop_id}/start")
    def start_loop(loop_id: str):
        contract = controller.load_contract(loop_id)
        return controller.run_until_done(contract)

    @app.post("/api/v1/loops/{loop_id}/pause")
    def pause_loop(loop_id: str):
        contract = controller.load_contract(loop_id)
        return controller.pause_loop(contract)

    @app.post("/api/v1/loops/{loop_id}/resume")
    def resume_loop(loop_id: str):
        contract = controller.load_contract(loop_id)
        return controller.resume_loop(contract)

    @app.post("/api/v1/loops/{loop_id}/cancel")
    def cancel_loop(loop_id: str):
        contract = controller.load_contract(loop_id)
        return controller.cancel_loop(contract)

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

    @app.post("/api/v1/loops/{loop_id}/runs/{run_id}/callback")
    async def callback(
        loop_id: str,
        run_id: str,
        request: Request,
        x_agent_loop_timestamp: str | None = Header(default=None),
        x_agent_loop_signature: str | None = Header(default=None),
    ):
        contract = controller.load_contract(loop_id)
        body = await request.body()
        verify_signature(contract, body, x_agent_loop_timestamp, x_agent_loop_signature)
        payload = CallbackPayload.model_validate_json(body)
        if payload.run_id != run_id or payload.loop_id != loop_id:
            from fastapi import HTTPException

            raise HTTPException(status_code=400, detail="callback path does not match payload")
        return controller.handle_callback(contract, payload)

    return app
