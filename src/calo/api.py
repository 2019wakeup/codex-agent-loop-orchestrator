from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Header, Request

from .controller import LoopController
from .models import CallbackPayload, LoopContract
from .security import verify_signature
from .store import StateStore


def create_app(db_path: Path | None = None) -> FastAPI:
    app = FastAPI(title="Codex Agent Loop Orchestrator")
    store = StateStore(db_path or Path(".calo/state.sqlite3"))
    controller = LoopController(store)

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
