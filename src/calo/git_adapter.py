from __future__ import annotations

import subprocess
from pathlib import Path


class GitAdapter:
    def __init__(self, repo_path: Path):
        self.repo_path = repo_path

    def run(self, args: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["git", *args],
            cwd=self.repo_path,
            check=check,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

    def ensure_repo(self) -> None:
        if not (self.repo_path / ".git").exists():
            self.run(["init"])
        self.run(["config", "user.email", "calo@example.local"], check=False)
        self.run(["config", "user.name", "CALO"], check=False)

    def status_short(self) -> str:
        return self.run(["status", "--short"]).stdout

    def diff_summary(self) -> str:
        return self.run(["diff", "--stat"], check=False).stdout

    def add_all(self) -> None:
        self.run(["add", "."])

    def commit(self, message: str) -> str | None:
        self.add_all()
        if not self.status_short().strip():
            return None
        self.run(["commit", "-m", message])
        return self.run(["rev-parse", "HEAD"]).stdout.strip()
