<script setup lang="ts">
import { computed, ref, watch } from "vue";

import CommandWizard from "../commands/CommandWizard.vue";
import RepoPicker from "./RepoPicker.vue";
import { taskAdapterDefaults } from "../../lib/commandWizard";
import { renderMarkdown } from "../../lib/markdown";
import type { FilesystemResponse } from "../../api/types";
import { useI18n } from "../../i18n";

interface GoalFormContext {
  defaultRepoPath: string;
  repoOptions: Array<{ label: string; path: string }>;
  runner: string;
}

const props = defineProps<{
  context: GoalFormContext;
  browseDirectory?: (path?: string) => Promise<FilesystemResponse>;
}>();

const emit = defineEmits<{
  "create-goal": [payload: Record<string, unknown>];
}>();

const { t } = useI18n();
const objective = ref("");
const repoPath = ref(props.context.defaultRepoPath);
const runner = ref(props.context.runner || "codex-cli");
const taskAdapterMode = ref("none");
const model = ref("");
const loopId = ref("");
const targetValue = ref(0.7);
const maxTurns = ref(3);
const targetMetric = ref("score");
const patience = ref<number | null>(null);
const minDelta = ref(0.001);
const asyncMode = ref(false);
const requireDiffReview = ref(false);
const autoCommit = ref(true);
const validationCommand = ref("");
const taskCommand = ref("");

const previewHtml = computed(() => renderMarkdown(objective.value, t("markdown.empty")));
const showCommandFields = computed(() => taskAdapterMode.value === "command" || taskAdapterMode.value === "demo");
const browseDirectory = computed(
  () =>
    props.browseDirectory ||
    (async () => ({
      path: repoPath.value || props.context.defaultRepoPath,
      parent: null,
      entries: []
    }))
);

watch(runner, (nextRunner) => {
  if (nextRunner === "local") {
    taskAdapterMode.value = "demo";
  } else if (taskAdapterMode.value === "demo") {
    taskAdapterMode.value = "none";
  }
});

watch(
  [taskAdapterMode, runner],
  () => {
    const defaults = taskAdapterDefaults({
      mode: taskAdapterMode.value,
      runner: runner.value,
      validationCommand: validationCommand.value,
      taskCommand: taskCommand.value
    });
    validationCommand.value = defaults.validationCommand;
    taskCommand.value = defaults.taskCommand;
  },
  { immediate: true }
);

function submitGoal() {
  const payload: Record<string, unknown> = {
    objective: objective.value,
    repo_path: repoPath.value,
    target_value: Number(targetValue.value),
    max_turns: Number(maxTurns.value),
    target_metric: targetMetric.value,
    min_delta: Number(minDelta.value),
    execution_mode: asyncMode.value ? "async" : "sync",
    require_diff_review: requireDiffReview.value,
    auto_commit: autoCommit.value,
    runner_kind: runner.value,
    task_adapter_mode: taskAdapterMode.value
  };
  if (loopId.value.trim()) payload.loop_id = loopId.value.trim();
  if (model.value.trim()) payload.runner_model = model.value.trim();
  if (patience.value) payload.patience = Number(patience.value);
  if (validationCommand.value.trim()) payload.validation_command = validationCommand.value.trim();
  if (taskCommand.value.trim()) payload.task_command = taskCommand.value.trim();
  emit("create-goal", payload);
}
</script>

<template>
  <form id="goal-form" class="goal-form" @submit.prevent="submitGoal">
    <div class="field-block">
      <label for="goal-objective">{{ t("goal.brief") }}</label>
      <textarea
        id="goal-objective"
        v-model="objective"
        name="objective"
        rows="5"
        required
        :placeholder="t('goal.briefPlaceholder')"
      />
      <small class="field-help">{{ t("goal.markdownHelp") }}</small>
      <div class="markdown-preview-shell">
        <div class="preview-title">{{ t("goal.markdownPreview") }}</div>
        <!-- The renderer escapes unsupported HTML before producing the small supported subset. -->
        <div id="goal-objective-preview" class="markdown-preview markdown-body" aria-live="polite" v-html="previewHtml" />
      </div>
    </div>

    <div class="field-grid">
      <div class="field-block wide-field">
        <label for="goal-repo">{{ t("goal.repository") }}</label>
        <RepoPicker v-model="repoPath" :options="context.repoOptions" :default-path="context.defaultRepoPath" :browse-directory="browseDirectory" />
      </div>
      <div class="field-block">
        <label for="goal-runner">{{ t("goal.executionBackend") }}</label>
        <select id="goal-runner" v-model="runner" name="runner">
          <option value="codex-cli">{{ t("runner.codex") }}</option>
          <option value="local">{{ t("runner.demo") }}</option>
        </select>
      </div>
      <div class="field-block">
        <label for="goal-task-adapter">{{ t("goal.externalWorkMode") }}</label>
        <select id="goal-task-adapter" v-model="taskAdapterMode" name="task_adapter_mode">
          <option value="none">{{ t("adapter.none") }}</option>
          <option value="command">{{ t("adapter.command") }}</option>
          <option value="demo">{{ t("adapter.demo") }}</option>
        </select>
      </div>
      <div class="field-block">
        <label for="goal-model">{{ t("goal.model") }}</label>
        <input id="goal-model" v-model="model" name="model" type="text" :placeholder="t('goal.modelPlaceholder')" />
      </div>
      <div class="field-block">
        <label for="goal-loop-id">{{ t("goal.loopId") }}</label>
        <input id="goal-loop-id" v-model="loopId" name="loop_id" type="text" :placeholder="t('goal.optionalPlaceholder')" />
      </div>
      <div class="field-block">
        <label for="goal-target">{{ t("goal.targetScore") }}</label>
        <input id="goal-target" v-model.number="targetValue" name="target_value" type="number" min="0" step="0.01" required />
      </div>
      <div class="field-block">
        <label for="goal-turns">{{ t("goal.maxTurns") }}</label>
        <input id="goal-turns" v-model.number="maxTurns" name="max_turns" type="number" min="1" step="1" required />
      </div>
    </div>

    <details class="advanced-settings">
      <summary>{{ t("goal.advanced") }}</summary>
      <div class="field-grid">
        <div class="field-block">
          <label for="goal-target-metric">{{ t("goal.targetMetric") }}</label>
          <input id="goal-target-metric" v-model="targetMetric" name="target_metric" type="text" />
        </div>
        <div class="field-block">
          <label for="goal-patience">{{ t("goal.patience") }}</label>
          <input id="goal-patience" v-model.number="patience" name="patience" type="number" min="1" step="1" :placeholder="t('goal.patiencePlaceholder')" />
        </div>
        <div class="field-block">
          <label for="goal-min-delta">{{ t("goal.minDelta") }}</label>
          <input id="goal-min-delta" v-model.number="minDelta" name="min_delta" type="number" min="0" step="0.001" />
        </div>
      </div>
      <div v-if="showCommandFields" id="adapter-command-fields" class="field-grid adapter-command-fields">
        <div class="field-block">
          <label for="goal-validation-command">{{ t("goal.quickCheck") }}</label>
          <input id="goal-validation-command" v-model="validationCommand" name="validation_command" type="text" />
        </div>
        <div v-if="taskAdapterMode === 'command'" class="field-block wide-field">
          <label for="goal-task-command">{{ t("goal.workCommand") }}</label>
          <CommandWizard v-model="taskCommand" target-id="goal-task-command" />
        </div>
      </div>
    </details>

    <div class="form-row">
      <div class="check-group">
        <label class="check-row" for="goal-async">
          <input id="goal-async" v-model="asyncMode" name="async" type="checkbox" />
          <span>{{ t("goal.asyncMode") }}</span>
        </label>
        <label class="check-row" for="goal-review">
          <input id="goal-review" v-model="requireDiffReview" name="require_diff_review" type="checkbox" />
          <span>{{ t("goal.diffReview") }}</span>
        </label>
        <label class="check-row" for="goal-auto-commit">
          <input id="goal-auto-commit" v-model="autoCommit" name="auto_commit" type="checkbox" />
          <span>{{ t("goal.autoCommit") }}</span>
        </label>
      </div>
      <button id="goal-submit" class="button primary" type="submit">{{ t("goal.createLoop") }}</button>
    </div>
  </form>
</template>
