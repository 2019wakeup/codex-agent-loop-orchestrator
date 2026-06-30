<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type { ArtifactEntryLike } from "../../api/types";
import { useI18n } from "../../i18n";
import { filterArtifacts, selectVisibleArtifact } from "../../lib/artifacts";
import { formatDate, formatValue } from "../../lib/format";
import ChipRow from "../common/ChipRow.vue";

const props = defineProps<{
  artifacts: ArtifactEntryLike[];
}>();

const { t, label } = useI18n();
const search = ref("");
const kind = ref("all");
const source = ref("all");
const turn = ref("all");
const selectedPath = ref("");

function optionsFor(key: keyof ArtifactEntryLike): string[] {
  return [...new Set(props.artifacts.map((artifact) => artifact[key]).filter(Boolean).map(String))].sort();
}

const visibleArtifacts = computed(() =>
  filterArtifacts(props.artifacts, {
    search: search.value,
    kind: kind.value,
    source: source.value,
    turn: turn.value
  })
);
const selected = computed(() => selectVisibleArtifact(visibleArtifacts.value, selectedPath.value));

watch(
  visibleArtifacts,
  () => {
    selectedPath.value = selected.value?.path || "";
  },
  { immediate: true }
);
</script>

<template>
  <div v-if="artifacts.length" class="artifact-browser" :aria-label="t('artifact.aria')">
    <div class="artifact-toolbar">
      <label class="field-block">
        <span>{{ t("artifact.search") }}</span>
        <input id="artifact-search" v-model="search" type="search" :placeholder="t('artifact.searchPlaceholder')" />
      </label>
      <label class="field-block">
        <span>{{ t("artifact.filterKind") }}</span>
        <select id="artifact-kind-filter" v-model="kind">
          <option value="all">{{ t("artifact.allKinds") }}</option>
          <option v-for="option in optionsFor('kind')" :key="option" :value="option">{{ label(option) }}</option>
        </select>
      </label>
      <label class="field-block">
        <span>{{ t("artifact.filterSource") }}</span>
        <select id="artifact-source-filter" v-model="source">
          <option value="all">{{ t("artifact.allSources") }}</option>
          <option v-for="option in optionsFor('source')" :key="option" :value="option">{{ label(option) }}</option>
        </select>
      </label>
      <label class="field-block">
        <span>{{ t("artifact.filterTurn") }}</span>
        <select id="artifact-turn-filter" v-model="turn">
          <option value="all">{{ t("artifact.allTurns") }}</option>
          <option v-for="option in optionsFor('turn_id')" :key="option" :value="option">{{ option }}</option>
        </select>
      </label>
    </div>

    <div class="artifact-count">{{ t("artifact.count", { count: visibleArtifacts.length }) }}</div>
    <div class="artifact-workbench">
      <div class="artifact-list" role="listbox" :aria-label="t('common.artifacts')">
        <button
          v-for="artifact in visibleArtifacts"
          :key="artifact.path"
          class="artifact-entry"
          :class="{ selected: artifact.path === selected?.path }"
          type="button"
          role="option"
          :aria-selected="artifact.path === selected?.path"
          @click="selectedPath = artifact.path"
        >
          <span>{{ artifact.display_name || artifact.path }}</span>
          <small>{{ artifact.path }}</small>
          <ChipRow
            :chips="[
              { label: t('common.source'), value: label(artifact.source) },
              { label: t('common.role'), value: label(artifact.role) },
              { label: t('common.turn'), value: artifact.turn_id },
              { label: t('common.run'), value: artifact.run_id }
            ]"
          />
        </button>
        <div v-if="!visibleArtifacts.length" class="empty-timeline">{{ t("artifact.noMatch") }}</div>
      </div>

      <article class="artifact-preview-panel">
        <template v-if="selected">
          <div class="artifact-preview-head">
            <div>
              <span>{{ t("artifact.preview") }}</span>
              <strong>{{ selected.path }}</strong>
            </div>
            <small>{{ label(selected.kind) }} · {{ t("artifact.bytes", { size: formatValue(selected.size_bytes) }) }}</small>
          </div>
          <div class="artifact-trace">
            <ChipRow
              :chips="[
                { label: t('common.source'), value: label(selected.source) },
                { label: t('common.role'), value: label(selected.role) },
                { label: t('common.turn'), value: selected.turn_id },
                { label: t('common.run'), value: selected.run_id },
                { label: t('common.modified'), value: formatDate(selected.modified_at || '') }
              ]"
            />
          </div>
          <pre>{{ selected.preview || t("artifact.previewUnavailable") }}</pre>
        </template>
        <div v-else class="empty-timeline">
          <strong>{{ t("artifact.select") }}</strong><br />
          {{ t("artifact.selectBody") }}
        </div>
      </article>
    </div>
  </div>
  <div v-else class="empty-timeline">{{ t("artifact.empty") }}</div>
</template>
