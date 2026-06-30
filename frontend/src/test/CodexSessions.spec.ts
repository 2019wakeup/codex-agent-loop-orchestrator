import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import CodexSessions from "../components/detail/CodexSessions.vue";

describe("CodexSessions", () => {
  it("renders role cards and opens focus modal details", async () => {
    const wrapper = mount(CodexSessions, {
      props: {
        events: [
          {
            event_type: "codex.planner.completed",
            created_at: "2026-06-30T00:00:00Z",
            payload: {
              turn_id: "turn_0001",
              runner_is_simulated: true,
              task_graph_path: "/tmp/repo/.codex/agent-loop/demo/task_graph/turn_0001.json"
            }
          },
          {
            event_type: "codex.worker.completed",
            created_at: "2026-06-30T00:00:01Z",
            payload: {
              turn_id: "turn_0001",
              runner_is_simulated: true,
              last_message_path: "/tmp/repo/.codex/agent-loop/demo/handoff/turn_0001.md"
            }
          }
        ]
      }
    });

    expect(wrapper.text()).toContain("Planner");
    expect(wrapper.text()).toContain("Worker");
    expect(wrapper.text()).toContain("Demo simulation");

    await wrapper.findAll("[data-focus-card]")[1].trigger("click");
    expect(wrapper.get('[role="dialog"]').attributes("aria-label")).toBe("Worker turn_0001");
    expect(wrapper.get('[role="dialog"]').text()).toContain("Evidence links");

    await wrapper.get("[data-focus-close]").trigger("click");
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });
});
