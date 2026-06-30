import { computed, ref } from "vue";

import { createCaloClient, type CaloClient } from "../api/caloClient";
import type { LoopSummaryLike } from "../api/types";

export function selectLoopId(loops: Array<Pick<LoopSummaryLike, "loop_id">>, current: string | null | undefined): string | null {
  if (current && loops.some((loop) => loop.loop_id === current)) return current;
  return loops[0]?.loop_id || null;
}

export function useDashboard(client: Pick<CaloClient, "listDashboard"> = createCaloClient()) {
  const loops = ref<LoopSummaryLike[]>([]);
  const selectedLoopId = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const selectedLoop = computed(() => loops.value.find((loop) => loop.loop_id === selectedLoopId.value) || null);

  async function refresh(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const nextLoops = await client.listDashboard();
      loops.value = nextLoops;
      selectedLoopId.value = selectLoopId(nextLoops, selectedLoopId.value);
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : `${caught}`;
      throw caught;
    } finally {
      loading.value = false;
    }
  }

  return {
    loops,
    selectedLoopId,
    selectedLoop,
    loading,
    error,
    refresh
  };
}
