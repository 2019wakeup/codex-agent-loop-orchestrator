#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE="${1:-/tmp/calo-async-acceptance-demo}"
CONFIG="$WORKSPACE/async_contract.json"

rm -rf "$WORKSPACE"
mkdir -p "$WORKSPACE"
python - <<PY
import json
from pathlib import Path

root = Path("$ROOT")
workspace = Path("$WORKSPACE")
config = json.loads((root / "examples" / "async_loop_contract.json").read_text())
config["repo_path"] = str(workspace)
(Path("$CONFIG")).write_text(json.dumps(config, indent=2) + "\\n")
PY

PYTHONPATH="$ROOT/src" python -m calo.cli create --config "$CONFIG" --workspace "$WORKSPACE"

for TURN in 1 2 3; do
  STATUS="$(PYTHONPATH="$ROOT/src" python -m calo.cli status async_example_loop --workspace "$WORKSPACE" | python -c 'import json,sys; print(json.load(sys.stdin)["status"])')"
  if [ "$STATUS" = "completed" ]; then
    break
  fi

  PYTHONPATH="$ROOT/src" python -m calo.cli step async_example_loop --workspace "$WORKSPACE"
  RUN_ID="$(printf 'run_%04d' "$TURN")"
  CALLBACK="$WORKSPACE/.codex/agent-loop/async_example_loop/runs/${RUN_ID}_callback.json"
  for _ in $(seq 1 50); do
    if [ -f "$CALLBACK" ]; then
      break
    fi
    sleep 0.1
  done
  test -f "$CALLBACK"
  PYTHONPATH="$ROOT/src" python -m calo.cli collect-callback async_example_loop --workspace "$WORKSPACE"
done

FINAL_STATUS="$(PYTHONPATH="$ROOT/src" python -m calo.cli status async_example_loop --workspace "$WORKSPACE" | python -c 'import json,sys; print(json.load(sys.stdin)["status"])')"
test "$FINAL_STATUS" = "completed"
test -f "$WORKSPACE/.codex/agent-loop/async_example_loop/runs/run_0001_manifest.json"
test -f "$WORKSPACE/.codex/agent-loop/async_example_loop/reports/final_report.md"

echo "async acceptance demo passed: $WORKSPACE"
