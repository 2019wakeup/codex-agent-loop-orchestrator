#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE="${1:-/tmp/calo-acceptance-demo}"

rm -rf "$WORKSPACE"
PYTHONPATH="$ROOT/src" python -m calo.cli demo --workspace "$WORKSPACE" --target 0.7 --max-turns 3

test -f "$WORKSPACE/.codex/agent-loop/demo_loop/contract.json"
test -f "$WORKSPACE/.codex/agent-loop/demo_loop/plan/turn_0001.json"
test -f "$WORKSPACE/.codex/agent-loop/demo_loop/handoff/turn_0001.md"
test -f "$WORKSPACE/.codex/agent-loop/demo_loop/reports/final_report.md"

echo "acceptance demo passed: $WORKSPACE"
