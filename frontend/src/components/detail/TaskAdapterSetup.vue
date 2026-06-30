<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type { LoopSummaryLike } from "../../api/types";
import { useI18n } from "../../i18n";
import { taskAdapterDefaults, validateCommandCallback } from "../../lib/commandWizard";
import CommandWizard from "../commands/CommandWizard.vue";

const props = defineProps<{
  loop: Partial<LoopSummaryLike>;
}>();

const emit = defineEmits<{
  "submit-adapter": [payload: Record<string, unknown>];
}>();

const { t } = useI18n();
const setupStates = new Set(["ready", "needs_setup", "paused", "review_required"]);
const visible = computed(() => setupStates.has(`${props.loop.status}`) && (props.loop.status === "needs_setup" || props.loop.task_adapter_mode === "none"));
const mode = ref("command");
const continueCurrentTurn = ref(props.loop.status === "needs_setup");
const validationCommand = ref("");
const taskCommand = ref("");
const message = ref("");

watch(
  () => props.loop.status,
  (status) => {
    continueCurrentTurn.value = status === "needs_setup";
  }
);

watch(
  mode,
  () => {
    const defaults = taskAdapterDefaults({
      mode: mode.value,
      validationCommand: validationCommand.value,
      taskCommand: taskCommand.value
    });
    validationCommand.value = defaults.validationCommand;
    taskCommand.value = defaults.taskCommand;
  },
  { immediate: true }
);

function submitAdapter() {
  message.value = "";
  if (mode.value === "command" && !validateCommandCallback(taskCommand.value)) {
    message.value = t("toast.adapterFailed", { message: t("command.callbackMissing") });
    return;
  }
  emit("submit-adapter", {
    task_adapter_mode: mode.value,
    validation_command: validationCommand.value.trim() || null,
    task_command: taskCommand.value.trim() || null,
    continue_current_turn: continueCurrentTurn.value
  });
}
</script>

<template>
  <div v-if="visible" class="task-adapter-setup">
    <div class="section-title">{{ t("adapterSetup.title") }}</div>
    <form id="task-adapter-form" class="adapter-setup-form" @submit.prevent="submitAdapter">
      <div class="adapter-setup-copy">
        <strong>{{ loop.status === "needs_setup" ? t("adapterSetup.copyNeedsSetup") : t("adapterSetup.copyConfigured") }}</strong>
        <span>{{ t("adapterSetup.copyText") }}</span>
      </div>
      <div class="field-grid">
        <div class="field-block">
          <label for="adapter-setup-mode">{{ t("adapterSetup.externalType") }}</label>
          <select id="adapter-setup-mode" v-model="mode" name="task_adapter_mode">
            <option value="command">{{ t("adapter.command") }}</option>
            <option value="demo">{{ t("adapter.demo") }}</option>
            <option value="none">{{ t("adapter.none") }}</option>
          </select>
          <small id="adapter-setup-help" class="field-help">{{ t("adapterSetup.help") }}</small>
        </div>
        <label class="check-row adapter-continue" for="adapter-continue-current">
          <input id="adapter-continue-current" v-model="continueCurrentTurn" name="continue_current_turn" type="checkbox" :disabled="loop.status !== 'needs_setup'" />
          <span>{{ t("adapterSetup.continue") }}</span>
        </label>
      </div>
      <div v-if="mode !== 'none'" id="adapter-setup-command-fields" class="field-grid">
        <div class="field-block">
          <label for="adapter-validation-command">{{ t("adapterSetup.quickCheck") }}</label>
          <input id="adapter-validation-command" v-model="validationCommand" name="validation_command" type="text" placeholder="optional, for example: pytest -q" />
        </div>
        <div v-if="mode === 'command'" class="field-block wide-field">
          <label for="adapter-task-command">{{ t("adapterSetup.workCommand") }}</label>
          <CommandWizard v-model="taskCommand" target-id="adapter-task-command" />
        </div>
      </div>
      <button class="button primary" type="submit">{{ loop.status === "needs_setup" ? t("adapterSetup.submitContinue") : t("adapterSetup.save") }}</button>
      <div v-if="message" class="form-message error" role="status">{{ message }}</div>
    </form>
  </div>
</template>
