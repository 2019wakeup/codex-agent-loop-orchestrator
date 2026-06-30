import { afterEach, describe, expect, it, vi } from "vitest";

import { createCaloClient, loopActionPath, runnerQuery } from "../api/caloClient";

describe("caloClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds runner query strings from loop state", () => {
    expect(runnerQuery({ runner_kind: "codex-cli", runner_model: "gpt-test" })).toBe("?runner=codex-cli&model=gpt-test");
    expect(runnerQuery({ runner_kind: "local" })).toBe("?runner=local");
  });

  it("builds lifecycle action paths including terminate-run", () => {
    expect(loopActionPath({ loop_id: "loop one", runner_kind: "local" }, "step")).toBe(
      "/api/v1/loops/loop%20one/step?runner=local"
    );
    expect(loopActionPath({ loop_id: "loop one", last_run_id: "run/1", runner_kind: "local" }, "terminate-run")).toBe(
      "/api/v1/loops/loop%20one/runs/run%2F1/terminate?runner=local"
    );
  });

  it("turns non-2xx responses into readable errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        text: () => Promise.resolve("cannot start while loop status is waiting_callback")
      })
    );

    await expect(createCaloClient().listDashboard()).rejects.toThrow("cannot start while loop status is waiting_callback");
  });

  it("posts JSON bodies for goal creation", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "ready" })
    });
    vi.stubGlobal("fetch", fetch);

    await createCaloClient().createGoal({ loop_id: "goal_loop", objective: "Ship", repo_path: "/tmp/repo" });

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/goals",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loop_id: "goal_loop", objective: "Ship", repo_path: "/tmp/repo" })
      })
    );
  });
});
