<script setup lang="ts">
import { ref } from "vue";

import type { LoopSummaryLike } from "../../api/types";
import { useI18n } from "../../i18n";
import { formatDate } from "../../lib/format";
import { renderMarkdown } from "../../lib/markdown";

defineProps<{
  loop: Partial<LoopSummaryLike>;
}>();

const emit = defineEmits<{
  "submit-guidance": [payload: Record<string, unknown>];
}>();

const { t, label } = useI18n();
const message = ref("");
const revisedObjective = ref("");
const appliesTo = ref("next_turn");

function submitGuidance() {
  if (!message.value.trim()) return;
  emit("submit-guidance", {
    message: message.value.trim(),
    revised_objective: revisedObjective.value.trim() || null,
    applies_to: appliesTo.value
  });
}
</script>

<template>
  <section>
    <div class="section-title compact">{{ t("guidance.formTitle") }}</div>
    <form id="guidance-form" class="guidance-form" @submit.prevent="submitGuidance">
      <div class="field-block">
        <label for="guidance-message">{{ t("guidance.instruction") }}</label>
        <textarea id="guidance-message" v-model="message" rows="3" :placeholder="t('guidance.instructionPlaceholder')" />
      </div>
      <div class="field-block">
        <label for="guidance-objective">{{ t("guidance.objective") }}</label>
        <textarea id="guidance-objective" v-model="revisedObjective" rows="2" :placeholder="t('guidance.objectivePlaceholder')" />
        <small class="field-help">{{ t("guidance.currentMarkdown") }}</small>
        <div class="markdown-body guidance-current" v-html="renderMarkdown(loop.objective || '')" />
      </div>
      <div class="guidance-controls">
        <div class="field-block">
          <label for="guidance-applies">{{ t("guidance.scope") }}</label>
          <select id="guidance-applies" v-model="appliesTo">
            <option value="next_turn">{{ t("guidance.appliesNext") }}</option>
            <option value="current_loop">{{ t("guidance.appliesCurrent") }}</option>
          </select>
        </div>
        <button class="button primary" type="submit">{{ t("guidance.submit") }}</button>
      </div>
    </form>

    <div class="section-title compact">{{ t("guidance.listTitle") }}</div>
    <div v-if="loop.operator_guidance?.length" class="guidance-list">
      <article v-for="item in loop.operator_guidance" :key="`${item.created_at}-${item.message}`" class="guidance-entry">
        <div class="guidance-entry-head">
          <strong>{{ label(item.applies_to) }}</strong>
          <time>{{ formatDate(item.created_at || '') }}</time>
        </div>
        <p>{{ item.message }}</p>
      </article>
    </div>
    <div v-else class="empty-timeline">{{ t("guidance.empty") }}</div>
  </section>
</template>
