from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from .models import ArtifactEntry


def ensure_artifact_dirs(root: Path) -> None:
    for name in ["plan", "task_graph", "handoff", "judge", "evidence", "runs", "reports", "guidance"]:
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


def _artifact_metadata(relative: str) -> dict[str, str | None]:
    first = relative.split("/", 1)[0] if relative else ""
    role_map = {
        "plan": "planner",
        "worker": "worker",
        "handoff": "worker",
        "judge": "judge",
        "runs": "taskrun",
        "guidance": "operator",
        "reports": "system",
        "evidence": "system",
        "task_graph": "system",
    }
    source_map = {
        "plan": "planner_plan",
        "worker": "worker_summary",
        "handoff": "worker_handoff",
        "judge": "judge_report",
        "runs": "taskrun",
        "guidance": "operator_guidance",
        "reports": "report",
        "evidence": "evidence_packet",
        "task_graph": "task_graph",
    }
    turn_match = re.search(r"(turn_\d+)", relative)
    run_match = re.search(r"(run_\d+)", relative)
    name = Path(relative).name
    return {
        "source": source_map.get(first, first or "unknown"),
        "role": role_map.get(first, "unknown"),
        "turn_id": turn_match.group(1) if turn_match else None,
        "run_id": run_match.group(1) if run_match else None,
        "display_name": name,
    }


def _preview(path: Path, kind: str, preview_chars: int) -> str | None:
    if kind not in {"json", "markdown", "text", "log"}:
        return None
    text = path.read_text(encoding="utf-8", errors="replace")
    if kind == "json":
        try:
            text = json.dumps(json.loads(text), indent=2, ensure_ascii=False)
        except json.JSONDecodeError:
            pass
    return text[:preview_chars]


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
        metadata = _artifact_metadata(relative)
        entries.append(
            ArtifactEntry(
                path=relative,
                kind=kind,
                size_bytes=stat.st_size,
                modified_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                preview=_preview(path, kind, preview_chars),
                **metadata,
            )
        )
    return entries
