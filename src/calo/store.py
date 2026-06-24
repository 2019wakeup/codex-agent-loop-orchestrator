from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

from .models import LoopContract
from .models import LoopState, utc_now


class StateStore:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init()

    def _connect(self) -> sqlite3.Connection:
        con = sqlite3.connect(self.db_path)
        con.row_factory = sqlite3.Row
        return con

    def _init(self) -> None:
        with self._connect() as con:
            con.executescript(
                """
                create table if not exists loops (
                  loop_id text primary key,
                  state_json text not null,
                  contract_json text,
                  updated_at text not null
                );
                create table if not exists events (
                  id integer primary key autoincrement,
                  loop_id text not null,
                  event_type text not null,
                  payload_json text not null,
                  created_at text not null
                );
                create table if not exists processed_callbacks (
                  loop_id text not null,
                  run_id text not null,
                  payload_json text not null,
                  created_at text not null,
                  primary key(loop_id, run_id)
                );
                """
            )
            cols = {
                row["name"]
                for row in con.execute("pragma table_info(loops)").fetchall()
            }
            if "contract_json" not in cols:
                con.execute("alter table loops add column contract_json text")

    def save_state(self, state: LoopState, contract: LoopContract | None = None) -> None:
        state.updated_at = utc_now()
        payload = state.model_dump_json()
        contract_payload = contract.model_dump_json() if contract else None
        with self._connect() as con:
            if contract_payload is None:
                con.execute(
                    """
                    insert into loops(loop_id, state_json, updated_at)
                    values (?, ?, ?)
                    on conflict(loop_id) do update set
                      state_json=excluded.state_json,
                      updated_at=excluded.updated_at
                    """,
                    (state.loop_id, payload, state.updated_at),
                )
            else:
                con.execute(
                    """
                    insert into loops(loop_id, state_json, contract_json, updated_at)
                    values (?, ?, ?, ?)
                    on conflict(loop_id) do update set
                      state_json=excluded.state_json,
                      contract_json=excluded.contract_json,
                      updated_at=excluded.updated_at
                    """,
                    (state.loop_id, payload, contract_payload, state.updated_at),
                )

    def load_state(self, loop_id: str) -> LoopState:
        with self._connect() as con:
            row = con.execute("select state_json from loops where loop_id = ?", (loop_id,)).fetchone()
        if row is None:
            raise KeyError(f"unknown loop: {loop_id}")
        return LoopState.model_validate_json(row["state_json"])

    def load_contract(self, loop_id: str) -> LoopContract:
        with self._connect() as con:
            row = con.execute("select contract_json from loops where loop_id = ?", (loop_id,)).fetchone()
        if row is None or row["contract_json"] is None:
            raise KeyError(f"unknown loop contract: {loop_id}")
        return LoopContract.model_validate_json(row["contract_json"])

    def list_loops(self) -> list[LoopState]:
        with self._connect() as con:
            rows = con.execute("select state_json from loops order by updated_at desc").fetchall()
        return [LoopState.model_validate_json(row["state_json"]) for row in rows]

    def add_event(self, loop_id: str, event_type: str, payload: dict[str, Any]) -> None:
        with self._connect() as con:
            con.execute(
                "insert into events(loop_id, event_type, payload_json, created_at) values (?, ?, ?, ?)",
                (loop_id, event_type, json.dumps(payload, ensure_ascii=False), utc_now()),
            )

    def claim_callback(self, loop_id: str, run_id: str, payload: dict[str, Any]) -> bool:
        try:
            with self._connect() as con:
                con.execute(
                    """
                    insert into processed_callbacks(loop_id, run_id, payload_json, created_at)
                    values (?, ?, ?, ?)
                    """,
                    (loop_id, run_id, json.dumps(payload, ensure_ascii=False), utc_now()),
                )
            return True
        except sqlite3.IntegrityError:
            return False

    def has_callback(self, loop_id: str, run_id: str) -> bool:
        with self._connect() as con:
            row = con.execute(
                "select 1 from processed_callbacks where loop_id = ? and run_id = ?",
                (loop_id, run_id),
            ).fetchone()
        return row is not None

    def list_events(self, loop_id: str) -> list[dict[str, Any]]:
        with self._connect() as con:
            rows = con.execute(
                "select event_type, payload_json, created_at from events where loop_id = ? order by id",
                (loop_id,),
            ).fetchall()
        return [
            {
                "event_type": row["event_type"],
                "payload": json.loads(row["payload_json"]),
                "created_at": row["created_at"],
            }
            for row in rows
        ]
