<script setup lang="ts">
import { computed } from "vue";

import type { LoopSummaryLike } from "../../api/types";
import { useI18n } from "../../i18n";
import { actionConfig, type ActionConfig } from "../../lib/loopState";

const props = defineProps<{
  loop: Partial<LoopSummaryLike> & { loop_id: string };
}>();

const emit = defineEmits<{
  action: [action: string];
}>();

const { t } = useI18n();
const actions = computed<ActionConfig>(() => actionConfig(props.loop));

function emitIfEnabled(action: keyof ActionConfig | "collect-callback" | "terminate-run", enabled: boolean) {
  if (enabled) emit("action", action);
}
</script>

<template>
  <div class="command-groups" :aria-label="t('actions.loopControl')">
    <div class="command-group">
      <div class="command-group-title">{{ t("actions.run") }}</div>
      <div class="button-row">
        <button class="button primary" data-action="start" :disabled="!actions.start" @click="emitIfEnabled('start', actions.start)">
          {{ t("action.start") }}
        </button>
        <button class="button" data-action="step" :disabled="!actions.step" @click="emitIfEnabled('step', actions.step)">
          {{ t("action.step") }}
        </button>
      </div>
    </div>

    <div class="command-group">
      <div class="command-group-title">{{ t("actions.wake") }}</div>
      <button
        class="button"
        data-action="collect-callback"
        :disabled="!actions.collect"
        @click="emitIfEnabled('collect-callback', actions.collect)"
      >
        {{ t("action.collect") }}
      </button>
      <div v-if="loop.status === 'waiting_callback' && !loop.callback_ready" class="command-status waiting">
        <strong>{{ t("actions.waitingCallback") }}</strong>
        <span>{{ t("actions.waitingCallbackBody") }}</span>
      </div>
      <div v-else-if="!loop.callback_ready" class="command-status">
        <strong>{{ t("actions.callbackNotReady") }}</strong>
        <span>{{ t("actions.callbackNotReadyBody") }}</span>
      </div>
    </div>

    <div class="command-group">
      <div class="command-group-title">{{ t("actions.loopControl") }}</div>
      <div class="button-row">
        <button class="button" data-action="pause" :disabled="!actions.pause" @click="emitIfEnabled('pause', actions.pause)">
          {{ t("action.pause") }}
        </button>
        <button class="button" data-action="resume" :disabled="!actions.resume" @click="emitIfEnabled('resume', actions.resume)">
          {{ t("action.resume") }}
        </button>
        <button class="button danger-secondary" data-action="cancel" :disabled="!actions.cancel" @click="emitIfEnabled('cancel', actions.cancel)">
          {{ t("action.cancel") }}
        </button>
      </div>
    </div>

    <div class="command-group">
      <div class="command-group-title">{{ t("actions.taskRunProcess") }}</div>
      <button
        class="button danger"
        data-action="terminate-run"
        :disabled="!actions.terminate"
        @click="emitIfEnabled('terminate-run', actions.terminate)"
      >
        {{ t("action.terminate") }}
      </button>
    </div>
  </div>
</template>
