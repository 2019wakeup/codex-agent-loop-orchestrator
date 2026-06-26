from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from .models import ArtifactEntry


def ensure_artifact_dirs(root: Path) -> None:
    for name in ["plan", "task_graph", "handoff", "judge", "evidence", "runs", "reports"]:
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


def list_artifacts(root: Path, limit: int = 80, preview_chars: int = 400) -> list[ArtifactEntry]:
    if not root.exists():
        return []
    entries: list[ArtifactEntry] = []
    suffix_kinds = {
        ".json": "json",
        ".md": "markdown",
        ".txt": "text",
        ".log": "log",
    }
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        if len(entries) >= limit:
            break
        relative = path.relative_to(root).as_posix()
        kind = suffix_kinds.get(path.suffix.lower(), "file")
        stat = path.stat()
        preview = None
        if kind in {"json", "markdown", "text", "log"}:
            preview = path.read_text(encoding="utf-8", errors="replace")[:preview_chars]
        entries.append(
            ArtifactEntry(
                path=relative,
                kind=kind,
                size_bytes=stat.st_size,
                modified_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                preview=preview,
            )
        )
    return entries
