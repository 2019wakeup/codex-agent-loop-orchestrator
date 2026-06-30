<script setup lang="ts">
import type { LoopSummaryLike } from "../../api/types";
import { useI18n } from "../../i18n";
import { formatTokenEstimate, formatValue } from "../../lib/format";

const props = defineProps<{
  loops: LoopSummaryLike[];
  selectedLoopId: string | null;
  title?: string;
  note?: string;
}>();

const emit = defineEmits<{
  "select-loop": [loopId: string];
}>();

const { t, status } = useI18n();

function metricText(loop: LoopSummaryLike): string {
  if (loop.best_metric === null || loop.best_metric === undefined) {
    return `${loop.target_metric || "score"} ${t("loop.na")} / ${formatValue(loop.target_value)}`;
  }
  return `${formatValue(loop.best_metric)} / ${formatValue(loop.target_value)}`;
}
</script>

<template>
  <section class="loops-section" :aria-label="props.title || t('app.loopQueue')">
    <div class="panel-header">
      <div>
        <h2>{{ props.title || t("app.loopQueue") }}</h2>
        <p class="panel-note">{{ props.note || t("app.loopNote") }}</p>
      </div>
      <span class="loop-count muted">{{ props.loops.length }}</span>
    </div>

    <div v-if="props.loops.length" class="loop-list">
      <button
        v-for="loop in props.loops"
        :key="loop.loop_id"
        class="loop-row"
        :class="{ selected: loop.loop_id === props.selectedLoopId }"
        type="button"
        :aria-label="`${loop.loop_id} ${status(loop.status)}`"
        @click="emit('select-loop', loop.loop_id || '')"
      >
        <div class="loop-row-main">
          <span class="loop-id">{{ loop.loop_id }}</span>
          <span class="status" :class="loop.status">{{ status(loop.status) }}</span>
        </div>
        <div class="objective">{{ loop.objective }}</div>
        <div class="metrics-line">
          <span>{{ t("loop.turnProgress", { turn: loop.turn, max: loop.max_turns }) }}</span>
          <span>{{ metricText(loop) }}</span>
          <span>{{ formatTokenEstimate(loop) }}</span>
        </div>
        <div class="bar" aria-hidden="true">
          <span :style="{ width: `${loop.progress_percent || 0}%` }" />
        </div>
      </button>
    </div>
    <div v-else class="detail-empty">{{ t("loop.empty") }}</div>
  </section>
</template>
