import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App.vue";

describe("App", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mounts the Vue dashboard shell", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string) => {
        if (path === "/api/v1/context") {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                default_repo_path: "/tmp/workspace",
                repo_options: [{ label: "Workspace", path: "/tmp/workspace" }],
                runner: "codex-cli",
                runner_options: ["local", "codex-cli"],
                codex_cli_available: true
              })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                loop_id: "vue_loop",
                objective: "Ship Vue shell",
                status: "ready",
                turn: 0,
                max_turns: 3,
                progress_percent: 0,
                target_metric: "score",
                target_value: 0.7,
                estimated_codex_tokens: 0
              }
            ])
        });
      })
    );
    const wrapper = mount(App);
    await flushPromises();

    expect(wrapper.get("h1").text()).toBe("Codex Agent Loop Orchestrator");
    expect(wrapper.get("#language-toggle").text()).toBe("English");
    expect(wrapper.text()).toContain("循环队列");
    expect(wrapper.find("#layout-splitter").exists()).toBe(true);
    expect(wrapper.find("#goal-form").exists()).toBe(true);
    expect(wrapper.text()).toContain("vue_loop");

    await wrapper.get("#language-toggle").trigger("click");
    expect(wrapper.get("#language-toggle").text()).toBe("中文");
    expect(wrapper.text()).toContain("Loop Queue");
  });
});
