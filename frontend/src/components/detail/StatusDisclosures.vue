<script setup lang="ts">
import { computed } from "vue";

import type { LoopSummaryLike } from "../../api/types";
import { useI18n } from "../../i18n";
import { runnerText, taskAdapterText } from "../../lib/loopState";

const props = defineProps<{
  loop: Partial<LoopSummaryLike>;
}>();

interface Disclosure {
  title: string;
  body: string;
  tone: "warning" | "ok";
  meta: string;
}

const { language, t } = useI18n();

const disclosures = computed<Disclosure[]>(() => {
  const items: Disclosure[] = [
    props.loop.runner_is_simulated === false
      ? {
          title: runnerText(props.loop, "", language.value),
          body: t("disclosure.realRunnerBody"),
          tone: "ok",
          meta: t("disclosure.runnerMeta")
        }
      : {
          title: t("disclosure.demoRunnerTitle"),
          body: t("disclosure.demoRunnerBody"),
          tone: "warning",
          meta: runnerText(props.loop, "", language.value)
        }
  ];

  if (props.loop.task_adapter_mode === "command") {
    items.push({
      title: t("disclosure.commandTitle"),
      body: t("disclosure.commandBody"),
      tone: "ok",
      meta: t("disclosure.externalMode")
    });
  } else if (props.loop.task_adapter_mode === "demo") {
    items.push({
      title: t("disclosure.demoAdapterTitle"),
      body: t("disclosure.demoAdapterBody"),
      tone: "warning",
      meta: t("disclosure.externalMode")
    });
  } else {
    items.push({
      title: t("disclosure.noAdapterTitle"),
      body: t("disclosure.noAdapterBody"),
      tone: "warning",
      meta: t("disclosure.externalMode")
    });
  }

  if (props.loop.artifact_root_exists === false) {
    items.push({
      title: t("disclosure.artifactMissingTitle"),
      body: t("disclosure.artifactMissingBody", { path: props.loop.artifact_root || t("loop.na") }),
      tone: "warning",
      meta: t("common.evidence")
    });
  }
  return items;
});
</script>

<template>
  <section class="status-disclosure-stack" :aria-label="t('status.notes')">
    <details v-for="item in disclosures" :key="item.title" class="status-disclosure" :class="item.tone">
      <summary>
        <strong>{{ item.title }}</strong>
        <span>{{ item.meta }}</span>
      </summary>
      <p>{{ item.body }}</p>
    </details>
  </section>
</template>
