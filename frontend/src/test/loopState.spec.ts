import { describe, expect, it } from "vitest";

import { actionConfig, nextActionText, runnerText, taskAdapterText } from "../lib/loopState";

describe("loop state helpers", () => {
  it("keeps waiting_callback loops out of pause and enables collect only when ready", () => {
    expect(
      actionConfig({
        status: "waiting_callback",
        callback_ready: false,
        last_run_id: "run_0001",
        run_owner: "local_subprocess"
      })
    ).toMatchObject({ collect: false, pause: false, cancel: true, terminate: true });

    expect(actionConfig({ status: "waiting_callback", callback_ready: true })).toMatchObject({
      collect: true,
      pause: false
    });
  });

  it("maps setup and terminal states to safe controls", () => {
    expect(actionConfig({ status: "needs_setup" })).toMatchObject({
      start: false,
      step: false,
      pause: false,
      cancel: true
    });
    expect(actionConfig({ status: "completed" })).toMatchObject({ cancel: false, pause: false });
  });

  it("formats runner and adapter labels", () => {
    expect(runnerText({ runner_kind: "codex-cli", runner_model: "gpt-test" })).toBe("Real Codex CLI · gpt-test");
    expect(runnerText({ runner_kind: "local" })).toBe("Demo simulation");
    expect(taskAdapterText("command")).toBe("Run my command");
  });

  it("describes next operator action by state", () => {
    expect(nextActionText({ status: "waiting_callback", callback_ready: true })).toBe("Collect the callback from the wake path.");
    expect(nextActionText({ status: "ready" })).toBe("Run until the next pause, or run exactly one turn.");
  });
});
