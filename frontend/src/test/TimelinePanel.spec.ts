import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import TimelinePanel from "../components/timeline/TimelinePanel.vue";

describe("TimelinePanel", () => {
  it("renders human-readable event descriptions with chips", () => {
    const wrapper = mount(TimelinePanel, {
      props: {
        events: [
          {
            event_type: "task.adapter.required",
            created_at: "2026-06-30T00:00:00Z",
            payload: {
              turn_id: "turn_0001",
              task_adapter_mode: "none",
              next_step: "choose an adapter"
            }
          },
          {
            event_type: "run.completed",
            created_at: "2026-06-30T00:01:00Z",
            payload: {
              run_id: "run_0001",
              status: "succeeded",
              metrics: { score: 0.72 },
              summary: "callback recorded"
            }
          }
          ,
          {
            event_type: "task.adapter.validation.completed",
            created_at: "2026-06-30T00:02:00Z",
            payload: {
              passed: true,
              turn_id: "turn_0001",
              validation_path: "evidence/turn_0001_validation.json"
            }
          }
        ]
      }
    });

    expect(wrapper.text()).toContain("External work mode required");
    expect(wrapper.text()).toContain("choose an adapter");
    expect(wrapper.text()).toContain("TaskRun succeeded");
    expect(wrapper.text()).toContain("score=0.72");
    expect(wrapper.text()).toContain("Adapter quick check passed");
  });
});
