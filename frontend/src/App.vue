<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";

import { createCaloClient } from "./api/caloClient";
import type { ContextResponse } from "./api/types";
import DetailPanel from "./components/detail/DetailPanel.vue";
import GoalForm from "./components/loops/GoalForm.vue";
import LoopList from "./components/loops/LoopList.vue";
import { useDashboard } from "./composables/useDashboard";
import { isLanguage, provideI18n, type Language } from "./i18n";
import { runnerText, taskAdapterText } from "./lib/loopState";

const client = createCaloClient();
const storedLanguage = window.localStorage.getItem("calo.language");
const context = ref<ContextResponse>({
  default_repo_path: "",
  repo_options: [],
  runner: "codex-cli",
  runner_options: ["local", "codex-cli"],
  codex_cli_available: false
});
const contextForForm = computed(() => ({
  defaultRepoPath: context.value.default_repo_path,
  repoOptions: context.value.repo_options,
  runner: context.value.runner
}));
const dashboard = useDashboard(client);
const actionMessage = ref("");
let refreshTimer: number | null = null;
const language = ref<Language>(isLanguage(storedLanguage) ? storedLanguage : "zh");
const { t, label, status } = provideI18n(language);
const minLeftPaneWidth = 340;
const maxLeftPaneWidth = 720;
const detailPaneMinWidth = 478;
const splitterAndGapsWidth = 48;
const leftPaneWidth = ref(Number(window.localStorage.getItem("calo.leftPaneWidth") || "520"));
const isNarrowViewport = ref(window.innerWidth <= 900);
const isResizing = ref(false);

const copy = computed(() => ({
  subtitle: t("app.subtitle"),
  loopQueue: t("app.loopQueue"),
  loopNote: t("app.loopNote"),
  refresh: t("app.refresh")
}));

const layoutStyle = computed(() =>
  isNarrowViewport.value ? {} : { gridTemplateColumns: `${leftPaneWidth.value}px 16px minmax(0, 1fr)` }
);

async function refreshAll() {
  const [nextContext] = await Promise.all([client.getContext(), dashboard.refresh()]);
  context.value = nextContext;
}

async function createGoal(payload: Record<string, unknown>) {
  const result = (await client.createGoal(payload)) as { loop_id?: string };
  const loopId = `${payload.loop_id || result.loop_id || "loop"}`;
  actionMessage.value = t("toast.created", {
    loopId,
    runner: runnerText(`${payload.runner_kind || "local"}`, "", language.value),
    adapter: taskAdapterText(`${payload.task_adapter_mode || "none"}`, language.value)
  });
  await dashboard.refresh();
  dashboard.selectedLoopId.value = loopId;
}

async function runAction(action: string) {
  const loop = dashboard.selectedLoop.value;
  if (!loop?.loop_id) return;
  const result = (await client.postLoopAction({ ...loop, loop_id: loop.loop_id }, action as never)) as { status?: string; external_task_control?: string };
  const labels: Record<string, string> = {
    start: t("action.start"),
    step: t("action.step"),
    "collect-callback": t("action.collect"),
    pause: t("action.pause"),
    resume: t("action.resume"),
    cancel: t("action.cancel"),
    "terminate-run": t("action.terminate")
  };
  actionMessage.value = t("toast.actionSucceeded", {
    action: labels[action] || action,
    status: label(result.status || result.external_task_control || "ok")
  });
  await dashboard.refresh();
}

async function submitGuidance(payload: Record<string, unknown>) {
  const loop = dashboard.selectedLoop.value;
  if (!loop?.loop_id) return;
  const result = (await client.submitGuidance({ ...loop, loop_id: loop.loop_id }, payload)) as { revised_objective?: string | null };
  actionMessage.value = result.revised_objective ? t("toast.guidanceSavedRevised") : t("toast.guidanceSaved");
  await dashboard.refresh();
}

async function submitAdapter(payload: Record<string, unknown>) {
  const loop = dashboard.selectedLoop.value;
  if (!loop?.loop_id) return;
  try {
    const result = (await client.configureTaskAdapter({ ...loop, loop_id: loop.loop_id }, payload)) as { status?: string };
    actionMessage.value =
      loop.status === "needs_setup"
        ? t("toast.adapterConfiguredContinue", { status: label(result.status || "ok") })
        : t("toast.adapterConfigured", { status: label(result.status || "ok") });
    await dashboard.refresh();
  } catch (error) {
    actionMessage.value = t("toast.adapterFailed", { message: error instanceof Error ? error.message : `${error}` });
  }
}

function toggleLanguage() {
  language.value = language.value === "zh" ? "en" : "zh";
  window.localStorage.setItem("calo.language", language.value);
}

function setLeftPaneWidth(value: number, persist = false) {
  const layoutWidth = document.querySelector<HTMLElement>(".layout")?.clientWidth || window.innerWidth - 80;
  const viewportMax = Math.max(minLeftPaneWidth, Math.min(maxLeftPaneWidth, layoutWidth - splitterAndGapsWidth - detailPaneMinWidth));
  const next = Math.max(minLeftPaneWidth, Math.min(viewportMax, Math.round(value)));
  leftPaneWidth.value = next;
  if (persist) window.localStorage.setItem("calo.leftPaneWidth", `${next}`);
}

function handleViewportResize() {
  isNarrowViewport.value = window.innerWidth <= 900;
  if (!isNarrowViewport.value) setLeftPaneWidth(leftPaneWidth.value, true);
}

function startResize(event: PointerEvent) {
  isResizing.value = true;
  const move = (moveEvent: PointerEvent) => setLeftPaneWidth(moveEvent.clientX - 32);
  const up = (upEvent: PointerEvent) => {
    setLeftPaneWidth(upEvent.clientX - 32, true);
    isResizing.value = false;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  event.preventDefault();
}

function resizeByKey(event: KeyboardEvent) {
  if (event.key === "ArrowLeft") setLeftPaneWidth(leftPaneWidth.value - 24, true);
  else if (event.key === "ArrowRight") setLeftPaneWidth(leftPaneWidth.value + 24, true);
  else if (event.key === "Home") setLeftPaneWidth(340, true);
  else if (event.key === "End") setLeftPaneWidth(720, true);
  else return;
  event.preventDefault();
}

onMounted(async () => {
  try {
    handleViewportResize();
    window.addEventListener("resize", handleViewportResize);
    await refreshAll();
    refreshTimer = window.setInterval(() => {
      dashboard.refresh().catch(() => undefined);
    }, 5000);
  } catch (error) {
    actionMessage.value = error instanceof Error ? error.message : `${error}`;
  }
});

watch(
  language,
  (nextLanguage) => {
    document.documentElement.lang = nextLanguage === "zh" ? "zh-CN" : "en";
  },
  { immediate: true }
);

onUnmounted(() => {
  window.removeEventListener("resize", handleViewportResize);
  if (refreshTimer !== null) window.clearInterval(refreshTimer);
});
</script>

<template>
  <main class="vue-migration-shell" :lang="language === 'zh' ? 'zh-CN' : 'en'" :aria-label="t('app.aria')">
    <header class="topbar">
      <div>
        <p class="eyebrow">CALO Web UI</p>
        <h1>Codex Agent Loop Orchestrator</h1>
        <p class="subtitle">{{ copy.subtitle }}</p>
      </div>
      <div class="topbar-actions">
        <button id="language-toggle" class="button language-toggle" type="button" @click="toggleLanguage">
          {{ language === "zh" ? "English" : "中文" }}
        </button>
        <span id="health" class="health">{{ t("app.connected") }}</span>
        <button id="refresh" class="button" type="button" @click="refreshAll">{{ copy.refresh }}</button>
      </div>
    </header>

    <div class="layout" :class="{ 'is-resizing': isResizing }" :style="layoutStyle">
      <section class="panel loops-panel">
        <GoalForm :context="contextForForm" :browse-directory="client.listFilesystem" @create-goal="createGoal" />
        <LoopList
          :loops="dashboard.loops.value"
          :selected-loop-id="dashboard.selectedLoopId.value"
          :title="copy.loopQueue"
          :note="copy.loopNote"
          @select-loop="dashboard.selectedLoopId.value = $event"
        />
      </section>

      <div
        id="layout-splitter"
        class="layout-splitter"
        role="separator"
        :aria-label="t('app.splitterAria')"
        aria-orientation="vertical"
        aria-valuemin="340"
        aria-valuemax="720"
        :aria-valuenow="leftPaneWidth"
        tabindex="0"
        @pointerdown="startResize"
        @keydown="resizeByKey"
      />

      <section class="panel detail-panel" :aria-label="t('app.detailAria')">
        <template v-if="dashboard.selectedLoop.value">
          <div class="panel-header">
            <div>
              <h2>{{ dashboard.selectedLoop.value.loop_id }}</h2>
              <p class="panel-note">{{ t("app.detailNote") }}</p>
            </div>
            <span class="status" :class="dashboard.selectedLoop.value.status">{{ status(dashboard.selectedLoop.value.status) }}</span>
          </div>
          <DetailPanel
            :loop="{ ...dashboard.selectedLoop.value, loop_id: dashboard.selectedLoop.value.loop_id || '' }"
            @action="runAction"
            @submit-guidance="submitGuidance"
            @submit-adapter="submitAdapter"
          />
        </template>
        <div v-else class="detail-empty">{{ t("app.emptyDetail") }}</div>
      </section>
    </div>

    <div v-if="actionMessage" class="form-message" role="status">{{ actionMessage }}</div>
  </main>
</template>

<style scoped>
.vue-migration-shell {
  min-height: 100vh;
  padding: 28px;
  color: var(--calo-ink);
  background:
    linear-gradient(90deg, rgba(28, 44, 39, 0.04) 1px, transparent 1px),
    linear-gradient(180deg, rgba(28, 44, 39, 0.035) 1px, transparent 1px),
    var(--calo-canvas);
  background-size:
    28px 28px,
    28px 28px,
    auto;
  font-family:
    "Aptos", "Segoe UI Variable", "Segoe UI", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
}

.topbar,
.panel {
  border: 1px solid var(--calo-line);
  border-radius: 8px;
  background: var(--calo-surface);
  box-shadow: var(--calo-shadow);
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 8;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 18px 22px;
  border-top: 4px solid var(--calo-accent);
  background:
    linear-gradient(90deg, rgba(180, 93, 34, 0.12), transparent 340px),
    var(--calo-surface);
}

.topbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.layout {
  display: grid;
  align-items: start;
  gap: 14px;
  margin-top: 16px;
}

.layout-splitter {
  position: relative;
  min-height: calc(100vh - 150px);
  border-radius: 8px;
  cursor: col-resize;
  background:
    linear-gradient(180deg, transparent, rgba(180, 93, 34, 0.16), transparent),
    var(--calo-rail);
  transition:
    background 160ms ease,
    transform 160ms ease;
}

.layout-splitter::after {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 4px;
  height: 52px;
  border-radius: 999px;
  background: var(--calo-accent);
  content: "";
  transform: translate(-50%, -50%);
}

.layout-splitter:hover,
.layout-splitter:focus-visible,
.layout.is-resizing .layout-splitter {
  background: var(--calo-rail-active);
}

.panel {
  min-width: 0;
  padding: 18px;
}

.loops-panel {
  border-top: 4px solid var(--calo-ink);
}

.detail-panel {
  border-top: 4px solid var(--calo-accent);
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--calo-accent-strong);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: clamp(24px, 3vw, 34px);
  font-weight: 820;
  line-height: 1.15;
}

.subtitle {
  max-width: 70ch;
  margin: 4px 0 0;
  color: var(--calo-muted);
  line-height: 1.5;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--calo-line);
}

.panel-header h2 {
  margin: 0;
  font-size: 18px;
  overflow-wrap: anywhere;
}

.panel-note {
  margin: 4px 0 0;
  color: var(--calo-muted);
}

.phase-panel {
  margin-bottom: 16px;
  padding: 16px;
  border: 1px solid var(--calo-line);
  border-radius: 8px;
}

.phase-panel h3,
.phase-panel p {
  margin: 0;
}

.phase-kicker {
  margin-bottom: 4px;
  color: var(--calo-muted);
  font-size: 12px;
  font-weight: 700;
}

@media (max-width: 900px) {
  .vue-migration-shell {
    padding: 16px;
  }

  .topbar,
  .layout {
    display: grid;
  }

  .topbar {
    position: static;
  }

  .topbar-actions {
    justify-content: start;
  }

  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
