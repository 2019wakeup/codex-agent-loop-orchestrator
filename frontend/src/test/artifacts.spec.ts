import { describe, expect, it } from "vitest";

import { artifactRelativePath, filterArtifacts, selectVisibleArtifact } from "../lib/artifacts";

const artifacts = [
  {
    path: "/tmp/repo/.codex/agent-loop/demo/task_graph/turn_0001.json",
    display_name: "task_graph/turn_0001.json",
    kind: "json",
    source: "task_graph",
    role: "planner",
    turn_id: "turn_0001"
  },
  {
    path: "/tmp/repo/.codex/agent-loop/demo/judge/turn_0001.md",
    display_name: "turn_0001.md",
    kind: "markdown",
    source: "judge",
    role: "judge",
    turn_id: "turn_0001"
  }
] as const;

describe("artifact helpers", () => {
  it("normalizes artifact paths relative to the loop root", () => {
    expect(artifactRelativePath(artifacts[0].path)).toBe("task_graph/turn_0001.json");
  });

  it("filters by source, kind, turn, and search text", () => {
    expect(filterArtifacts(artifacts, { source: "task_graph", kind: "json", turn: "turn_0001", search: "graph" })).toHaveLength(1);
    expect(filterArtifacts(artifacts, { source: "task_graph", kind: "markdown", turn: "all", search: "" })).toHaveLength(0);
  });

  it("clears stale selected artifacts when filters hide them", () => {
    const visible = filterArtifacts(artifacts, { source: "task_graph", kind: "all", turn: "all", search: "" });

    expect(selectVisibleArtifact(visible, artifacts[1].path)?.path).toBe(artifacts[0].path);
  });
});
