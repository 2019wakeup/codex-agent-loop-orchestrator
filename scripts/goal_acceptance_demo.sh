#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="${1:-/tmp/calo-goal-acceptance-demo}"

rm -rf "$WORKSPACE"
calo goal \
  --objective "Raise fake score from a plain goal brief" \
  --workspace "$WORKSPACE" \
  --loop-id goal_acceptance_loop \
  --target 0.6 \
  --max-turns 2

calo start goal_acceptance_loop --workspace "$WORKSPACE"

test -f "$WORKSPACE/.codex/agent-loop/goal_acceptance_loop/contract.json"
test -f "$WORKSPACE/.codex/agent-loop/goal_acceptance_loop/reports/final_report.md"

echo "goal acceptance demo passed: $WORKSPACE"
