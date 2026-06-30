<script setup lang="ts">
import type { LoopEventLike } from "../../api/types";
import { useI18n } from "../../i18n";
import { describeEvent, eventTime, flattenPayload } from "../../lib/events";
import ChipRow from "../common/ChipRow.vue";

defineProps<{
  events: LoopEventLike[];
}>();

const { language, t, label } = useI18n();
</script>

<template>
  <div v-if="events.length" class="event-list">
    <article v-for="event in events" :key="`${event.event_type}-${event.created_at}`" class="event">
      <time class="event-time">{{ eventTime(event.created_at) }}</time>
      <div class="event-copy">
        <div class="event-title">{{ describeEvent(event, language).title }}</div>
        <div class="event-body">{{ describeEvent(event, language).body }}</div>
        <ChipRow :chips="describeEvent(event, language).chips" />
        <details class="event-details">
          <summary>{{ t("common.details") }}</summary>
          <div v-for="[key, value] in flattenPayload(event.payload)" :key="key" class="detail-row">
            <span>{{ label(key) }}</span>
            <code>{{ value }}</code>
          </div>
        </details>
      </div>
    </article>
  </div>
  <div v-else class="empty-timeline">{{ t("timeline.empty") }}</div>
</template>
