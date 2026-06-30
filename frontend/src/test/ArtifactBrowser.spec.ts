import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ArtifactBrowser from "../components/artifacts/ArtifactBrowser.vue";

const artifacts = [
  {
    path: "task_graph/turn_0001.json",
    display_name: "task_graph/turn_0001.json",
    kind: "json",
    source: "task_graph",
    role: "planner",
    turn_id: "turn_0001",
    size_bytes: 128,
    modified_at: "2026-06-30T00:00:00Z",
    preview: '{"turn_id": "turn_0001"}'
  },
  {
    path: "judge/turn_0001.md",
    display_name: "turn_0001.md",
    kind: "markdown",
    source: "judge",
    role: "judge",
    turn_id: "turn_0001",
    size_bytes: 64,
    modified_at: "2026-06-30T00:00:01Z",
    preview: "# Judge report"
  }
];

describe("ArtifactBrowser", () => {
  it("filters artifacts and resets the preview to the first visible artifact", async () => {
    const wrapper = mount(ArtifactBrowser, { props: { artifacts } });

    expect(wrapper.get(".artifact-preview-panel").text()).toContain("task_graph/turn_0001.json");

    await wrapper.get("#artifact-source-filter").setValue("judge");
    expect(wrapper.get(".artifact-preview-panel").text()).toContain("judge/turn_0001.md");
    expect(wrapper.text()).not.toContain('{"turn_id": "turn_0001"}');

    await wrapper.get("#artifact-search").setValue("missing");
    expect(wrapper.text()).toContain("No artifacts match the current filters.");
    expect(wrapper.get(".artifact-preview-panel").text()).toContain("Select an artifact");
  });
});
