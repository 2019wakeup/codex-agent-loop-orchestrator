import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import DetailPanel from "../components/detail/DetailPanel.vue";

const loop = {
  loop_id: "detail_loop",
  objective: "# Inspect evidence\n\n- Keep state visible",
  status: "ready",
  turn: 1,
  max_turns: 3,
  progress_percent: 33,
  target_metric: "score",
  target_value: 0.7,
  best_metric: 0.55,
  metric_percent: 79,
  runner_kind: "local",
  runner_is_simulated: true,
  task_adapter_mode: "demo",
  artifact_root_exists: true,
  estimated_codex_tokens: 2400,
  token_budget_hint: 9000,
  artifacts: [
    {
      path: "judge/turn_0001.md",
      display_name: "turn_0001.md",
      kind: "markdown",
      source: "judge",
      role: "judge",
      turn_id: "turn_0001",
      size_bytes: 64,
      modified_at: "2026-06-30T00:00:01Z",
      preview: "# Judge"
    }
  ],
  recent_events: [
    {
      event_type: "loop.created",
      created_at: "2026-06-30T00:00:00Z",
      payload: { contract_path: "contract.json" }
    }
  ],
  operator_guidance: [],
  task_runs: []
};

describe("DetailPanel", () => {
  it("shows overview by default and switches to evidence and timeline tabs", async () => {
    const wrapper = mount(DetailPanel, { props: { loop } });

    expect(wrapper.text()).toContain("Ready to start");
    expect(wrapper.text()).toContain("Demo fake TaskRun mode");
    expect(wrapper.text()).toContain("Inspect evidence");

    await wrapper.get('[data-detail-tab="evidence"]').trigger("click");
    expect(wrapper.text()).toContain("Artifacts");
    expect(wrapper.text()).toContain("judge/turn_0001.md");

    await wrapper.get('[data-detail-tab="timeline"]').trigger("click");
    expect(wrapper.text()).toContain("Loop timeline");
    expect(wrapper.text()).toContain("Loop contract created");
  });

  it("renders task graph and task runs on the Work tab", async () => {
    const wrapper = mount(DetailPanel, {
      props: {
        loop: {
          ...loop,
          task_graph: {
            turn_id: "turn_0001",
            nodes: [{ id: "task_1", type: "code_change", instruction: "Update evidence view", status: "planned", target_files: ["app.js"] }]
          },
          task_runs: [
            {
              run_id: "run_0001",
              status: "succeeded",
              turn_id: "turn_0001",
              owner: "local_subprocess",
              wake_path: "/tmp/callback.json",
              external_task_control: "released"
            }
          ]
        }
      }
    });

    await wrapper.get('[data-detail-tab="work"]').trigger("click");
    expect(wrapper.text()).toContain("Task graph");
    expect(wrapper.text()).toContain("Update evidence view");
    expect(wrapper.text()).toContain("TaskRuns");
    expect(wrapper.get(".task-run").text()).toContain("succeeded");
  });
});
