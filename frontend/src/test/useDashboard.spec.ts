import { describe, expect, it, vi } from "vitest";

import { selectLoopId, useDashboard } from "../composables/useDashboard";

describe("useDashboard", () => {
  const loops = [
    { loop_id: "first", status: "ready", objective: "First" },
    { loop_id: "second", status: "waiting_callback", objective: "Second" }
  ];

  it("keeps the selected loop when refresh still contains it", () => {
    expect(selectLoopId(loops, "second")).toBe("second");
  });

  it("selects the first loop when the previous selection disappeared", () => {
    expect(selectLoopId(loops, "missing")).toBe("first");
    expect(selectLoopId([], "missing")).toBeNull();
  });

  it("refreshes dashboard state through an injected client", async () => {
    const client = {
      listDashboard: vi.fn().mockResolvedValue(loops)
    };
    const dashboard = useDashboard(client);

    await dashboard.refresh();

    expect(dashboard.loops.value).toEqual(loops);
    expect(dashboard.selectedLoopId.value).toBe("first");
    dashboard.selectedLoopId.value = "second";
    await dashboard.refresh();
    expect(dashboard.selectedLoop.value?.loop_id).toBe("second");
  });
});
