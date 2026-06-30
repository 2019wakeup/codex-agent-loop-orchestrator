import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import TaskAdapterSetup from "../components/detail/TaskAdapterSetup.vue";

describe("TaskAdapterSetup", () => {
  it("rejects command setup without callback_file and emits valid setup", async () => {
    const wrapper = mount(TaskAdapterSetup, {
      props: {
        loop: {
          loop_id: "needs_setup",
          status: "needs_setup",
          task_adapter_mode: "none"
        }
      }
    });

    expect(wrapper.text()).toContain("Choose what happens to this accepted change");
    await wrapper.get("[data-wizard-type]").setValue("custom");
    await wrapper.get("[data-wizard-body]").setValue("python write_callback.py --run-id {run_id}");
    await wrapper.get("#task-adapter-form").trigger("submit");
    expect(wrapper.text()).toContain("Command adapter needs {callback_file}");

    await wrapper.get("[data-wizard-type]").setValue("python");
    await wrapper.get("[data-wizard-script]").setValue("write_callback.py");
    await wrapper.get("#task-adapter-form").trigger("submit");
    expect(wrapper.emitted("submit-adapter")?.[0]?.[0]).toMatchObject({
      task_adapter_mode: "command",
      continue_current_turn: true,
      task_command:
        "python write_callback.py --callback-file {callback_file} --run-id {run_id} --turn-id {turn_id} --loop-id {loop_id}"
    });
  });

  it("continues the accepted turn when a visible adapter panel transitions into needs_setup", async () => {
    const wrapper = mount(TaskAdapterSetup, {
      props: {
        loop: {
          loop_id: "recover_loop",
          status: "ready",
          task_adapter_mode: "none"
        }
      }
    });

    await wrapper.setProps({
      loop: {
        loop_id: "recover_loop",
        status: "needs_setup",
        task_adapter_mode: "none"
      }
    });
    await wrapper.get("[data-wizard-script]").setValue("write_callback.py");
    await wrapper.get("#task-adapter-form").trigger("submit");

    expect(wrapper.emitted("submit-adapter")?.[0]?.[0]).toMatchObject({
      task_adapter_mode: "command",
      continue_current_turn: true,
      task_command:
        "python write_callback.py --callback-file {callback_file} --run-id {run_id} --turn-id {turn_id} --loop-id {loop_id}"
    });
  });
});
