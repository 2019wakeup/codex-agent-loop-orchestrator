import { describe, expect, it } from "vitest";

import { generateWizardCommand, taskAdapterDefaults, validateCommandCallback } from "../lib/commandWizard";

describe("command wizard helpers", () => {
  it("generates the Python command with all wake placeholders", () => {
    expect(generateWizardCommand({ type: "python", script: "write_callback.py" })).toBe(
      "python write_callback.py --callback-file {callback_file} --run-id {run_id} --turn-id {turn_id} --loop-id {loop_id}"
    );
  });

  it("does not silently bless custom commands without callback_file", () => {
    const command = generateWizardCommand({ type: "custom", body: "python write_callback.py --run-id {run_id}" });

    expect(command).toBe("python write_callback.py --run-id {run_id}");
    expect(validateCommandCallback(command)).toBe(false);
  });

  it("sets demo defaults and clears fake commands for real command mode", () => {
    expect(taskAdapterDefaults({ mode: "demo", validationCommand: "", taskCommand: "" })).toMatchObject({
      validationCommand: "python -m py_compile target_app.py",
      taskCommand: "python fake_train.py --callback-file {callback_file} --run-id {run_id} --turn-id {turn_id}"
    });
    expect(
      taskAdapterDefaults({
        mode: "command",
        runner: "local",
        validationCommand: "pytest -q",
        taskCommand: "python fake_train.py --callback-file {callback_file}"
      })
    ).toMatchObject({ validationCommand: "pytest -q", taskCommand: "" });
  });
});
