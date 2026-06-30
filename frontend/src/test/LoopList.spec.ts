import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import LoopList from "../components/loops/LoopList.vue";

describe("LoopList", () => {
  const loops = [
    {
      loop_id: "ready_loop",
      objective: "Improve evidence clarity",
      status: "ready",
      turn: 0,
      max_turns: 3,
      progress_percent: 0,
      target_metric: "score",
      target_value: 0.7,
      best_metric: null,
      metric_percent: null,
      estimated_codex_tokens: 0
    },
    {
      loop_id: "paused_loop",
      objective: "Recover adapter setup",
      status: "paused",
      turn: 1,
      max_turns: 4,
      progress_percent: 25,
      target_metric: "score",
      target_value: 0.8,
      best_metric: 0.6,
      metric_percent: 75,
      estimated_codex_tokens: 1800
    }
  ];

  it("renders loop rows with stable status and metric content", () => {
    const wrapper = mount(LoopList, { props: { loops, selectedLoopId: "ready_loop" } });

    expect(wrapper.get(".loop-count").text()).toBe("2");
    expect(wrapper.get(".loop-row.selected .loop-id").text()).toBe("ready_loop");
    expect(wrapper.text()).toContain("Improve evidence clarity");
    expect(wrapper.text()).toContain("turn 1 / 4");
    expect(wrapper.text()).toContain("0.600 / 0.800");
  });

  it("emits select-loop when a row is clicked", async () => {
    const wrapper = mount(LoopList, { props: { loops, selectedLoopId: "ready_loop" } });

    await wrapper.findAll(".loop-row")[1].trigger("click");

    expect(wrapper.emitted("select-loop")?.[0]).toEqual(["paused_loop"]);
  });
});
