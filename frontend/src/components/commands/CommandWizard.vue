<script setup lang="ts">
import { computed, watch } from "vue";

import { useI18n } from "../../i18n";
import { generateWizardCommand, validateCommandCallback, type WizardType } from "../../lib/commandWizard";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    targetId: string;
  }>(),
  {
    modelValue: ""
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const { t } = useI18n();
const type = defineModel<WizardType>("type", { default: "python" });
const script = defineModel<string>("script", { default: "train.py" });
const body = defineModel<string>("body", { default: "python train.py" });

const generatedCommand = computed(() =>
  generateWizardCommand({
    type: type.value,
    script: script.value,
    body: body.value
  })
);
const activeCommand = computed(() => props.modelValue || generatedCommand.value);
const hasCallback = computed(() => validateCommandCallback(activeCommand.value));

watch(
  generatedCommand,
  (command) => {
    emit("update:modelValue", command);
  },
  { immediate: true }
);
</script>

<template>
  <div class="command-wizard" data-command-wizard="vue">
    <div class="command-wizard-head">
      <strong>{{ t("command.head") }}</strong>
      <span>{{ t("command.help") }}</span>
    </div>
    <div class="command-wizard-grid">
      <label class="field-block">
        <span>{{ t("command.taskType") }}</span>
        <select v-model="type" data-wizard-type :aria-label="t('command.taskType')">
          <option value="python">{{ t("command.typePython") }}</option>
          <option value="shell">{{ t("command.typeShell") }}</option>
          <option value="custom">{{ t("command.typeCustom") }}</option>
        </select>
      </label>
      <label v-if="type === 'python'" class="field-block">
        <span>{{ t("command.script") }}</span>
        <input v-model="script" data-wizard-script type="text" :placeholder="t('command.scriptPlaceholder')" />
      </label>
      <label v-else class="field-block wide-field">
        <span>{{ t("command.body") }}</span>
        <input v-model="body" data-wizard-body type="text" :placeholder="t('command.placeholder')" />
      </label>
    </div>
    <div class="generated-command">
      <span>{{ t("command.generated") }}</span>
      <code data-generated-command>{{ generatedCommand }}</code>
    </div>
    <div
      class="form-message wizard-message"
      :class="hasCallback ? 'success' : 'error'"
      data-wizard-message
      role="status"
      aria-live="polite"
    >
      {{
        hasCallback
          ? t("command.generatedOk")
          : t("command.callbackMissing")
      }}
    </div>
    <input :id="targetId" :value="activeCommand" type="hidden" />
  </div>
</template>
