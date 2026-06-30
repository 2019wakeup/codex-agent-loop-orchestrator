import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import StatusDisclosures from "../components/detail/StatusDisclosures.vue";

describe("StatusDisclosures", () => {
  it("renders runner, adapter, and missing artifact warnings", () => {
    const wrapper = mount(StatusDisclosures, {
      props: {
        loop: {
          loop_id: "demo",
          status: "ready",
          runner_kind: "local",
          runner_is_simulated: true,
          task_adapter_mode: "none",
          artifact_root_exists: false,
          artifact_root: "/tmp/repo/.codex/agent-loop/demo"
        }
      }
    });

    expect(wrapper.text()).toContain("Demo simulation backend");
    expect(wrapper.text()).toContain("No external work configured");
    expect(wrapper.text()).toContain("Artifact directory missing");
  });

  it("renders real runner and command task mode as ok disclosures", () => {
    const wrapper = mount(StatusDisclosures, {
      props: {
        loop: {
          loop_id: "real",
          status: "ready",
          runner_kind: "codex-cli",
          runner_model: "gpt-test",
          runner_is_simulated: false,
          task_adapter_mode: "command",
          artifact_root_exists: true
        }
      }
    });

    expect(wrapper.text()).toContain("Real Codex CLI · gpt-test");
    expect(wrapper.text()).toContain("Command TaskRun mode");
    expect(wrapper.findAll(".status-disclosure.ok")).toHaveLength(2);
  });
});
