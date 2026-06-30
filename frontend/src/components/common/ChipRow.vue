<script setup lang="ts">
import type { Chip } from "../../lib/events";
import { useI18n } from "../../i18n";

defineProps<{
  chips: Chip[];
}>();

const { label } = useI18n();
</script>

<template>
  <div class="chip-row">
    <span v-for="chip in chips.filter((item) => item.value !== null && item.value !== undefined && item.value !== '')" :key="`${chip.label}-${chip.value}`" class="chip">
      <span>{{ chip.label }}</span>
      {{ typeof chip.value === "string" ? chip.value : label(chip.value) }}
    </span>
  </div>
</template>
