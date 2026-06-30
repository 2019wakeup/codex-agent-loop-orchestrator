import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import GoalForm from "../components/loops/GoalForm.vue";

describe("GoalForm", () => {
  const context = {
    defaultRepoPath: "/tmp/workspace",
    repoOptions: [{ label: "Workspace", path: "/tmp/workspace" }],
    runner: "codex-cli"
  };

  it("renders markdown preview from the goal brief", async () => {
    const wrapper = mount(GoalForm, { props: { context } });

    await wrapper.get("#goal-objective").setValue("**Browser acceptance async loop**\n\n- Evidence clarity");

    expect(wrapper.get("#goal-objective-preview strong").text()).toBe("Browser acceptance async loop");
    expect(wrapper.get("#goal-objective-preview li").text()).toBe("Evidence clarity");
  });

  it("switches local runner to demo external work mode", async () => {
    const wrapper = mount(GoalForm, { props: { context } });

    await wrapper.get("#goal-runner").setValue("local");

    expect((wrapper.get("#goal-task-adapter").element as HTMLSelectElement).value).toBe("demo");
  });

  it("emits the goal payload on submit", async () => {
    const wrapper = mount(GoalForm, { props: { context } });

    await wrapper.get("#goal-objective").setValue("Ship a Vue dashboard");
    await wrapper.get("#goal-loop-id").setValue("vue_loop");
    await wrapper.get("#goal-target").setValue("0.8");
    await wrapper.get("#goal-turns").setValue("4");
    await wrapper.get("#goal-form").trigger("submit");

    expect(wrapper.emitted("create-goal")?.[0]?.[0]).toMatchObject({
      objective: "Ship a Vue dashboard",
      loop_id: "vue_loop",
      repo_path: "/tmp/workspace",
      target_value: 0.8,
      max_turns: 4,
      runner_kind: "codex-cli",
      task_adapter_mode: "none"
    });
  });
});
