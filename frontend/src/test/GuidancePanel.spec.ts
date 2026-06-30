import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import GuidancePanel from "../components/guidance/GuidancePanel.vue";

describe("GuidancePanel", () => {
  it("emits operator guidance payloads and renders existing guidance", async () => {
    const wrapper = mount(GuidancePanel, {
      props: {
        loop: {
          objective: "# Current objective",
          operator_guidance: [
            {
              applies_to: "next_turn",
              created_at: "2026-06-30T00:00:00Z",
              message: "Keep evidence readable"
            }
          ]
        }
      }
    });

    expect(wrapper.text()).toContain("Keep evidence readable");
    await wrapper.get("#guidance-message").setValue("Focus on operator intent.");
    await wrapper.get("#guidance-objective").setValue("# Revised objective");
    await wrapper.get("#guidance-form").trigger("submit");

    expect(wrapper.emitted("submit-guidance")?.[0]?.[0]).toEqual({
      message: "Focus on operator intent.",
      revised_objective: "# Revised objective",
      applies_to: "next_turn"
    });
  });
});
