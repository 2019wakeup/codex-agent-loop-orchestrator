<script setup lang="ts">
import { ref } from "vue";

import type { FilesystemResponse } from "../../api/types";
import { useI18n } from "../../i18n";

const props = defineProps<{
  modelValue: string;
  options: Array<{ label: string; path: string }>;
  defaultPath: string;
  browseDirectory: (path?: string) => Promise<FilesystemResponse>;
}>();

const emit = defineEmits<{
  "update:modelValue": [path: string];
}>();

const { t } = useI18n();
const open = ref(false);
const loading = ref(false);
const message = ref("");
const current = ref<FilesystemResponse>({
  path: props.defaultPath,
  parent: null,
  entries: []
});

async function load(path?: string) {
  loading.value = true;
  message.value = t("repo.loading");
  try {
    current.value = await props.browseDirectory(path || props.defaultPath);
    message.value = current.value.entries.length ? "" : t("repo.noChildren");
  } catch (error) {
    message.value = error instanceof Error ? error.message : t("repo.cannotOpen");
  } finally {
    loading.value = false;
  }
}

async function toggle() {
  open.value = !open.value;
  if (open.value) await load(props.modelValue || props.defaultPath);
}

function useCurrentFolder() {
  emit("update:modelValue", current.value.path);
  message.value = t("repo.selected");
}
</script>

<template>
  <div class="repo-picker">
    <div class="repo-picker-row">
      <select id="goal-repo" :value="modelValue" name="repo_path" required @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)">
        <option v-for="option in options" :key="option.path" :value="option.path">{{ option.label }} - {{ option.path }}</option>
        <option v-if="modelValue && !options.some((option) => option.path === modelValue)" :value="modelValue">{{ modelValue }}</option>
      </select>
      <button id="repo-browse-toggle" class="button" type="button" @click="toggle">{{ open ? t("repo.hide") : t("repo.browse") }}</button>
    </div>

    <div v-if="open" id="repo-browser" class="repo-browser">
      <div class="repo-browser-head">
        <button id="repo-parent" class="button" type="button" :disabled="!current.parent || loading" @click="load(current.parent || undefined)">{{ t("repo.up") }}</button>
        <button id="repo-root" class="button" type="button" :disabled="loading" @click="load('/')">{{ t("repo.root") }}</button>
        <code id="repo-browser-path">{{ current.path }}</code>
        <button id="repo-use" class="button primary" type="button" @click="useCurrentFolder">{{ t("repo.useFolder") }}</button>
      </div>
      <div id="repo-browser-list" class="repo-browser-list" role="list">
        <button v-for="entry in current.entries" :key="entry.path" class="repo-dir" type="button" role="listitem" @click="load(entry.path)">
          {{ entry.name }}
        </button>
      </div>
      <div id="repo-browser-message" class="form-message" role="status" aria-live="polite">{{ message }}</div>
    </div>
  </div>
</template>
