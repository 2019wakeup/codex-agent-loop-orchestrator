import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ActionControls from "../components/detail/ActionControls.vue";

describe("ActionControls", () => {
  it("disables pause for waiting_callback and enables collect when callback is ready", async () => {
    const wrapper = mount(ActionControls, {
      props: {
        loop: {
          loop_id: "async_loop",
          status: "waiting_callback",
          callback_ready: true,
          last_run_id: "run_0001",
          run_owner: "local_subprocess"
        }
      }
    });

    expect(wrapper.get('[data-action="pause"]').attributes("disabled")).toBeDefined();
    expect(wrapper.get('[data-action="collect-callback"]').attributes("disabled")).toBeUndefined();

    await wrapper.get('[data-action="collect-callback"]').trigger("click");
    expect(wrapper.emitted("action")?.[0]).toEqual(["collect-callback"]);
  });

  it("shows callback waiting status while the external owner has not written evidence", () => {
    const wrapper = mount(ActionControls, {
      props: {
        loop: {
          loop_id: "async_loop",
          status: "waiting_callback",
          callback_ready: false,
          last_run_id: "run_0001",
          run_owner: "local_subprocess"
        }
      }
    });

    expect(wrapper.text()).toContain("Waiting for callback");
    expect(wrapper.get('[data-action="collect-callback"]').attributes("disabled")).toBeDefined();
  });

  it("enables start and step for ready loops", () => {
    const wrapper = mount(ActionControls, {
      props: {
        loop: {
          loop_id: "ready_loop",
          status: "ready",
          callback_ready: false
        }
      }
    });

    expect(wrapper.get('[data-action="start"]').attributes("disabled")).toBeUndefined();
    expect(wrapper.get('[data-action="step"]').attributes("disabled")).toBeUndefined();
    expect(wrapper.get('[data-action="terminate-run"]').attributes("disabled")).toBeDefined();
  });
});
