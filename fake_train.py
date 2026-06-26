from __future__ import annotations

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
pathlib.Path(args.callback_file).write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
