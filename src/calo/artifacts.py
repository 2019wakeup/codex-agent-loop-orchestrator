from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel


def ensure_artifact_dirs(root: Path) -> None:
    for name in ["plan", "handoff", "judge", "evidence", "runs", "reports"]:
        (root / name).mkdir(parents=True, exist_ok=True)


def write_json(path: Path, data: BaseModel | dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = data.model_dump(mode="json") if isinstance(data, BaseModel) else data
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
