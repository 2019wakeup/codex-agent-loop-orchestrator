from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI

from .controller import LoopController
from .models import CallbackPayload, LoopContract
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
    def callback(loop_id: str, run_id: str, payload: CallbackPayload):
        contract = controller.load_contract(loop_id)
        return controller.handle_callback(contract, payload)

    return app
