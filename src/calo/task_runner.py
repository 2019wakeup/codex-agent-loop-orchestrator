from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

from .artifacts import write_json
from .models import CallbackPayload, LoopContract, RunStatus


class TaskRunner:
    def validate(self, contract: LoopContract) -> tuple[bool, str]:
        if not contract.commands.validation.strip():
            return True, "No quick check command configured; validation skipped before TaskRun setup.\n"
        result = subprocess.run(
            contract.commands.validation,
            cwd=contract.repo_path,
            shell=True,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        return result.returncode == 0, result.stdout

    def run_training_sync(self, contract: LoopContract, turn_id: str, run_id: str) -> CallbackPayload:
        callback_file = contract.artifact_root / "runs" / f"{run_id}_callback.json"
        callback_file.parent.mkdir(parents=True, exist_ok=True)
        command = contract.commands.train.format(callback_file=callback_file, run_id=run_id, turn_id=turn_id)
        result = subprocess.run(
            command,
            cwd=contract.repo_path,
            shell=True,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        if callback_file.exists():
            payload = CallbackPayload.model_validate_json(callback_file.read_text(encoding="utf-8"))
        else:
            payload = CallbackPayload(
                loop_id=contract.loop_id,
                run_id=run_id,
                turn_id=turn_id,
                status=RunStatus.FAILED,
                metrics={},
                summary="training command did not write callback",
                error=result.stdout,
            )
        write_json(contract.artifact_root / "runs" / f"{run_id}.json", payload)
        return payload

    def launch_training_async(self, contract: LoopContract, turn_id: str, run_id: str) -> Path:
        callback_file = contract.artifact_root / "runs" / f"{run_id}_callback.json"
        stdout_file = contract.artifact_root / "runs" / f"{run_id}.log"
        callback_file.parent.mkdir(parents=True, exist_ok=True)
        command = contract.commands.train.format(callback_file=callback_file, run_id=run_id, turn_id=turn_id)
        out = stdout_file.open("w", encoding="utf-8")
        process = subprocess.Popen(
            command,
            cwd=contract.repo_path,
            shell=True,
            text=True,
            stdout=out,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        manifest = {
            "loop_id": contract.loop_id,
            "run_id": run_id,
            "turn_id": turn_id,
            "owner": "local_subprocess",
            "pid": process.pid,
            "process_group_id": process.pid,
            "command": command,
            "wake_path": str(callback_file),
            "callback_file": str(callback_file),
            "stdout_file": str(stdout_file),
            "codex_control": "released",
            "operational_pause": True,
            "status": "running",
        }
        manifest_path = contract.artifact_root / "runs" / f"{run_id}_manifest.json"
        write_json(manifest_path, manifest)
        return manifest_path

    def read_callback_file(self, contract: LoopContract, run_id: str) -> CallbackPayload:
        callback_file = contract.artifact_root / "runs" / f"{run_id}_callback.json"
        if not callback_file.exists():
            raise FileNotFoundError(f"callback file is not ready: {callback_file}")
        return CallbackPayload.model_validate_json(callback_file.read_text(encoding="utf-8"))


def write_fake_training_script(repo_path: Path) -> None:
    script = repo_path / "fake_train.py"
    if script.exists():
        return
    script.write_text(
        """from __future__ import annotations

import argparse
import json
import pathlib
import sys

parser = argparse.ArgumentParser()
parser.add_argument("--callback-file", required=True)
parser.add_argument("--run-id", default="run")
parser.add_argument("--turn-id", default="turn")
args = parser.parse_args()

sys.path.insert(0, str(pathlib.Path.cwd()))
from target_app import score

payload = {
    "loop_id": pathlib.Path(".codex/agent-loop").glob("*").__next__().name,
    "run_id": args.run_id,
    "turn_id": args.turn_id,
    "status": "succeeded",
    "metrics": {"score": float(score())},
    "artifacts": {"source": "fake_train.py"},
    "summary": "fake training completed"
}
pathlib.Path(args.callback_file).write_text(json.dumps(payload, indent=2) + "\\n", encoding="utf-8")
""",
        encoding="utf-8",
    )


def read_target_score(repo_path: Path) -> float:
    target = repo_path / "target_app.py"
    spec = importlib.util.spec_from_file_location("_calo_target_app", target)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load target_app.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return float(module.score())
