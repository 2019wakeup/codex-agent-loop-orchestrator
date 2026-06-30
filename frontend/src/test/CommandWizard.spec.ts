import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import CommandWizard from "../components/commands/CommandWizard.vue";

describe("CommandWizard", () => {
  it("generates Python callback commands into the bound model", async () => {
    const wrapper = mount(CommandWizard, {
      props: {
        modelValue: "",
        targetId: "goal-task-command"
      }
    });

    await wrapper.get("[data-wizard-script]").setValue("write_callback.py");

    expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toBe(
      "python write_callback.py --callback-file {callback_file} --run-id {run_id} --turn-id {turn_id} --loop-id {loop_id}"
    );
    expect(wrapper.get("[data-generated-command]").text()).toContain("--callback-file {callback_file}");
    expect(wrapper.get("[data-wizard-message]").classes()).toContain("success");
  });

  it("shows an error for custom commands that cannot wake the loop", async () => {
    const wrapper = mount(CommandWizard, {
      props: {
        modelValue: "",
        targetId: "adapter-task-command"
      }
    });

    await wrapper.get("[data-wizard-type]").setValue("custom");
    await wrapper.get("[data-wizard-body]").setValue("python train.py --run-id {run_id}");

    expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toBe("python train.py --run-id {run_id}");
    expect(wrapper.get("[data-wizard-message]").text()).toContain("{callback_file}");
    expect(wrapper.get("[data-wizard-message]").classes()).toContain("error");
  });
});
