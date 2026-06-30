import type { RunnerKind, TaskAdapterMode } from "../api/types";

export type WizardType = "python" | "shell" | "custom";

export interface WizardCommandInput {
  type?: WizardType;
  script?: string;
  body?: string;
}

export interface TaskAdapterDefaultsInput {
  mode: TaskAdapterMode | string;
  runner?: RunnerKind | string;
  validationCommand: string;
  taskCommand: string;
}

export interface TaskAdapterDefaults {
  showCommands: boolean;
  validationCommand: string;
  taskCommand: string;
  helpText: string;
}

const wakeSuffix = "--callback-file {callback_file} --run-id {run_id} --turn-id {turn_id} --loop-id {loop_id}";

export function generateWizardCommand(input: WizardCommandInput): string {
  const type = input.type || "python";
  const script = input.script?.trim() || "train.py";
  const body = input.body?.trim() || "";
  if (type === "python") return `python ${script} ${wakeSuffix}`.trim();
  if (type === "shell") return `${body || "bash run.sh"} ${wakeSuffix}`.trim();
  return body;
}

export function validateCommandCallback(command: string): boolean {
  return command.includes("{callback_file}");
}

export function taskAdapterDefaults(input: TaskAdapterDefaultsInput): TaskAdapterDefaults {
  const mode = input.mode || "none";
  const result: TaskAdapterDefaults = {
    showCommands: mode === "command" || mode === "demo",
    validationCommand: input.validationCommand,
    taskCommand: input.taskCommand,
    helpText: "Stop boundary: CALO can run the Codex turn, then stops before commit or TaskRun launch."
  };

  if (mode === "none") {
    return { ...result, validationCommand: "", taskCommand: "" };
  }
  if (mode === "demo") {
    return {
      ...result,
      validationCommand: input.validationCommand.trim() || "python -m py_compile target_app.py",
      taskCommand: input.taskCommand.includes("fake_train.py")
        ? input.taskCommand
        : "python fake_train.py --callback-file {callback_file} --run-id {run_id} --turn-id {turn_id}",
      helpText: "Demo mode writes a tiny score fixture and fake TaskRun script. Use it only to learn the lifecycle, not for real tasks."
    };
  }

  return {
    ...result,
    taskCommand: input.taskCommand.includes("fake_train.py") ? "" : input.taskCommand,
    helpText:
      input.runner === "local"
        ? "Command mode launches your real external work after a Codex turn. The command must write the callback file. Local backend still uses the deterministic demo Codex runner for Planner, Worker, and Judge."
        : "Command mode launches your real external work after a Codex turn. The command must write the callback file."
  };
}
