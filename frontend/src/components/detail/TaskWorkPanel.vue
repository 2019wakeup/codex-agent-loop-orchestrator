<script setup lang="ts">
import type { TaskRunRecordLike } from "../../api/types";
import { useI18n } from "../../i18n";
import ChipRow from "../common/ChipRow.vue";

defineProps<{
  taskGraph?: unknown;
  taskRuns?: TaskRunRecordLike[];
}>();

const { t, label } = useI18n();

interface TaskNode {
  id: string;
  type?: string;
  instruction?: string;
  status?: string;
  target_files?: string[];
}

function graphNodes(graph: unknown): TaskNode[] {
  if (!graph || typeof graph !== "object") return [];
  const nodes = (graph as { nodes?: unknown }).nodes;
  return Array.isArray(nodes) ? (nodes as TaskNode[]) : [];
}

function graphTurn(graph: unknown): string {
  if (!graph || typeof graph !== "object") return "n/a";
  return `${(graph as { turn_id?: string }).turn_id || "n/a"}`;
}
</script>

<template>
  <div class="work-artifacts">
    <div class="section-title compact">{{ t("work.taskGraph") }}</div>
    <div v-if="graphNodes(taskGraph).length" class="task-graph">
      <div class="task-graph-head">
        <strong>{{ graphTurn(taskGraph) }}</strong>
        <span>{{ t("work.tasksCount", { count: graphNodes(taskGraph).length }) }}</span>
      </div>
      <article v-for="node in graphNodes(taskGraph)" :key="node.id" class="task-node">
        <div>
          <strong>{{ node.id }}</strong>
          <span>{{ label(node.type) }}</span>
        </div>
        <p>{{ node.instruction }}</p>
        <ChipRow
          :chips="[
            { label: t('common.status'), value: label(node.status) },
            { label: t('common.files'), value: (node.target_files || []).join(', ') }
          ]"
        />
      </article>
    </div>
    <div v-else class="empty-timeline">{{ t("work.emptyGraph") }}</div>

    <div class="section-title compact">{{ t("common.taskRuns") }}</div>
    <div v-if="taskRuns?.length" class="task-runs">
      <article v-for="run in taskRuns" :key="run.run_id" class="task-run">
        <div class="task-run-main">
          <strong>{{ run.run_id }}</strong>
          <span class="status" :class="run.status">{{ label(run.status) }}</span>
        </div>
        <ChipRow
          :chips="[
            { label: t('common.turn'), value: run.turn_id },
            { label: t('common.owner'), value: run.owner },
            { label: t('common.pid'), value: run.pid },
            { label: t('common.control'), value: label(run.external_task_control) },
            { label: t('common.wake'), value: run.wake_path }
          ]"
        />
      </article>
    </div>
    <div v-else class="empty-timeline">{{ t("work.emptyRuns") }}</div>
  </div>
</template>
