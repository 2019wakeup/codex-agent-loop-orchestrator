<script setup lang="ts">
import { computed, ref } from "vue";

import type { LoopSummaryLike } from "../../api/types";
import { useI18n } from "../../i18n";
import { formatDuration, formatTokenEstimate, formatValue } from "../../lib/format";
import { nextActionText, statusInsight } from "../../lib/loopState";
import { renderMarkdown } from "../../lib/markdown";
import ArtifactBrowser from "../artifacts/ArtifactBrowser.vue";
import ActionControls from "./ActionControls.vue";
import StatusDisclosures from "./StatusDisclosures.vue";
import GuidancePanel from "../guidance/GuidancePanel.vue";
import TimelinePanel from "../timeline/TimelinePanel.vue";
import TaskAdapterSetup from "./TaskAdapterSetup.vue";
import CodexSessions from "./CodexSessions.vue";
import TaskWorkPanel from "./TaskWorkPanel.vue";

const props = defineProps<{
  loop: LoopSummaryLike;
}>();

const emit = defineEmits<{
  action: [action: string];
  "submit-guidance": [payload: Record<string, unknown>];
  "submit-adapter": [payload: Record<string, unknown>];
}>();

const { language, t, label } = useI18n();
const activeTab = ref("overview");
const phase = computed(() => statusInsight(props.loop, language.value));
const tabs = computed(() => [
  { id: "overview", label: t("detail.tab.overview") },
  { id: "work", label: t("detail.tab.work") },
  { id: "evidence", label: t("detail.tab.evidence") },
  { id: "timeline", label: t("detail.tab.timeline") }
]);
</script>

<template>
  <div class="detail-body">
    <StatusDisclosures :loop="loop" />
    <section class="phase-panel" :aria-label="t('common.currentPhase')">
      <div>
        <div class="phase-kicker">{{ t("common.currentPhase") }}</div>
        <div class="phase-title">{{ phase[0] }}</div>
        <div class="phase-body">{{ phase[1] }}</div>
      </div>
      <div class="next-action">
        <span>{{ t("common.nextAction") }}</span>
        <strong>{{ nextActionText(loop, language) }}</strong>
      </div>
    </section>

    <div class="detail-grid">
      <div class="stat">
        <div class="stat-label">{{ t("detail.turnsUsed") }}</div>
        <div class="stat-value">{{ loop.turn }}/{{ loop.max_turns }}</div>
      </div>
      <div class="stat">
        <div class="stat-label">{{ t("detail.turnBudget") }}</div>
        <div class="stat-value">{{ loop.progress_percent }}%</div>
      </div>
      <div class="stat">
        <div class="stat-label">{{ loop.target_metric }}</div>
        <div class="stat-value">{{ formatValue(loop.best_metric) }} / {{ formatValue(loop.target_value) }}</div>
      </div>
      <div class="stat">
        <div class="stat-label">{{ t("common.elapsed") }}</div>
        <div class="stat-value">{{ formatDuration(loop.elapsed_seconds) }}</div>
      </div>
      <div class="stat">
        <div class="stat-label">{{ t("detail.tokenEstimate") }}</div>
        <div class="stat-value">{{ formatTokenEstimate(loop) }}</div>
      </div>
    </div>

    <section class="detail-command-center" :aria-label="t('actions.loopControl')">
      <div class="command-primary">
        <div class="section-title compact">{{ t("common.objective") }}</div>
        <div class="objective-full markdown-body" v-html="renderMarkdown(loop.objective || '')" />
        <TaskAdapterSetup :loop="loop" @submit-adapter="emit('submit-adapter', $event)" />
      </div>
      <div class="command-actions">
        <div class="section-title compact">{{ t("common.actions") }}</div>
        <ActionControls :loop="{ ...loop, loop_id: loop.loop_id || '' }" @action="emit('action', $event)" />
      </div>
    </section>

    <section class="detail-tabs" :aria-label="t('detail.loopSections')">
      <div class="detail-tab-list" role="tablist" :aria-label="t('detail.loopSections')">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="detail-tab"
          :class="{ active: activeTab === tab.id }"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.id"
          :data-detail-tab="tab.id"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>
      <div id="detail-tab-panel" class="detail-tab-panel" role="tabpanel">
        <div v-if="activeTab === 'overview'" class="detail-overview-grid">
          <section class="detail-card">
            <div class="section-title compact">{{ t("common.state") }}</div>
            <div class="key-grid">
              <div><span>{{ t("common.mode") }}</span><strong>{{ loop.execution_mode || "sync" }}</strong></div>
              <div><span>{{ t("common.lastDecision") }}</span><strong>{{ loop.last_decision ? label(loop.last_decision) : t("loop.na") }}</strong></div>
              <div><span>{{ t("common.repository") }}</span><strong>{{ loop.repo_path || t("loop.na") }}</strong></div>
            </div>
          </section>
          <section class="detail-card">
            <div class="section-title compact">{{ t("detail.codexSessions") }}</div>
            <CodexSessions :events="loop.recent_events || []" />
          </section>
        </div>
        <div v-else-if="activeTab === 'work'" class="detail-overview-grid">
          <section class="detail-card">
            <GuidancePanel :loop="loop" @submit-guidance="emit('submit-guidance', $event)" />
          </section>
          <section class="detail-card detail-scroll">
            <TaskWorkPanel :task-graph="loop.task_graph" :task-runs="loop.task_runs || []" />
          </section>
        </div>
        <section v-else-if="activeTab === 'evidence'" class="detail-card detail-scroll">
          <div class="section-title compact">{{ t("common.artifacts") }}</div>
          <ArtifactBrowser :artifacts="loop.artifacts || []" />
        </section>
        <section v-else class="detail-card detail-scroll">
          <div class="section-title compact">{{ t("detail.loopTimeline") }}</div>
          <TimelinePanel :events="loop.recent_events || []" />
        </section>
      </div>
    </section>
  </div>
</template>
