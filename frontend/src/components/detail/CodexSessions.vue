<script setup lang="ts">
import { computed, ref } from "vue";

import type { LoopEventLike } from "../../api/types";
import { useI18n } from "../../i18n";
import { artifactRelativePath } from "../../lib/artifacts";
import { runnerText } from "../../lib/loopState";
import ChipRow from "../common/ChipRow.vue";

const props = defineProps<{
  events: LoopEventLike[];
}>();

interface RoleCard {
  role: string;
  turnId: string;
  status: string;
  body: string;
  payload: Record<string, unknown>;
  links: string[];
}

const focused = ref<RoleCard | null>(null);
const { language, t, status } = useI18n();

const roleBodies = computed<Record<string, string>>(() => ({
  planner: t("codex.body.planner"),
  worker: t("codex.body.worker"),
  judge: t("codex.body.judge")
}));

function roleLabel(role: string): string {
  return t(`codex.role.${role}`, {}, role[0].toUpperCase() + role.slice(1));
}

const cards = computed<RoleCard[]>(() => {
  const byTurn = new Map<string, Record<string, Record<string, unknown>>>();
  for (const event of props.events) {
    const match = event.event_type.match(/^codex\.(planner|worker|judge)\.(started|completed)$/);
    if (!match) continue;
    const role = match[1];
    const phase = match[2];
    const payload = event.payload || {};
    const turnId = `${payload.turn_id || "turn_unknown"}`;
    if (!byTurn.has(turnId)) byTurn.set(turnId, {});
    const turn = byTurn.get(turnId)!;
    turn[role] = { ...(turn[role] || {}), [phase]: payload };
  }
  const result: RoleCard[] = [];
  for (const [turnId, roles] of byTurn) {
    for (const role of ["planner", "worker", "judge"]) {
      const roleEvents = roles[role] || {};
      const payload = (roleEvents.completed || roleEvents.started || {}) as Record<string, unknown>;
      const status = roleEvents.completed ? "completed" : roleEvents.started ? "running" : "not started";
      const links = [
        payload.plan_path,
        payload.task_graph_path,
        payload.last_message_path,
        role === "judge" ? `judge/${turnId}.json` : null,
        role === "worker" ? `worker/${turnId}.json` : null
      ]
        .filter(Boolean)
        .map(artifactRelativePath);
      result.push({ role, turnId, status, body: roleBodies.value[role], payload, links });
    }
  }
  return result;
});
</script>

<template>
  <div v-if="cards.length" class="codex-session-timeline" :aria-label="t('codex.timeline')">
    <section class="codex-turn">
      <div class="codex-turn-head">
        <strong>{{ cards[0]?.turnId }}</strong>
        <span>{{ t("codex.timeline") }}</span>
      </div>
      <div class="codex-role-lanes">
        <article v-for="card in cards" :key="`${card.turnId}-${card.role}`" class="codex-role-card" :class="card.status">
          <div class="codex-role-title">
            <strong>{{ roleLabel(card.role) }}</strong>
            <div class="card-title-actions">
              <span class="status" :class="card.status === 'completed' ? 'ready' : card.status === 'running' ? 'codex_running' : 'neutral'">{{ status(card.status) }}</span>
              <button class="card-focus-button" type="button" data-focus-card @click="focused = card">{{ t("codex.expand") }}</button>
            </div>
          </div>
          <p>{{ card.body }}</p>
          <ChipRow
            :chips="[
              { label: t('common.backend'), value: card.payload.runner_label || (card.payload.runner_kind ? runnerText(`${card.payload.runner_kind}`, '', language) : null) },
              { label: t('common.mode'), value: card.payload.runner_is_simulated === false ? t('runner.codex') : t('runner.demo') },
              { label: t('common.model'), value: card.payload.runner_model }
            ]"
          />
          <div v-if="card.links.length" class="artifact-link-list">
            <span>{{ t("codex.evidenceLinks") }}</span>
            <code v-for="link in card.links" :key="link">{{ link }}</code>
          </div>
        </article>
      </div>
    </section>
  </div>
  <div v-else class="empty-timeline">{{ t("codex.empty") }}</div>

  <div v-if="focused" class="focus-modal-backdrop">
    <section class="focus-modal" role="dialog" aria-modal="true" :aria-label="`${roleLabel(focused.role)} ${focused.turnId}`">
      <div class="focus-modal-head">
        <strong>{{ roleLabel(focused.role) }} {{ focused.turnId }}</strong>
        <button class="button" type="button" data-focus-close @click="focused = null">{{ t("codex.modalClose") }}</button>
      </div>
      <div class="focus-modal-body">
        <article class="codex-role-card" :class="focused.status">
          <p>{{ focused.body }}</p>
          <div v-if="focused.links.length" class="artifact-link-list">
            <span>{{ t("codex.evidenceLinks") }}</span>
            <code v-for="link in focused.links" :key="link">{{ link }}</code>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
