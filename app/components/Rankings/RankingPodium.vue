<script setup lang="ts">
import { Medal } from 'lucide-vue-next'
import type { RankingRow } from '~/types/domain'

const props = defineProps<{
  rows: readonly RankingRow[]
}>()

const podiumRows = computed(() => props.rows.slice(0, 3))
</script>

<template>
  <div class="podium-grid">
    <article v-for="(row, index) in podiumRows" :key="row.userId" class="podium-card panel">
      <Medal :size="22" aria-hidden="true" />
      <span class="podium-place">{{ index + 1 }}.</span>
      <strong>{{ row.displayName }}</strong>
      <small>{{ row.totalPoints }} pkt</small>
    </article>
  </div>
</template>

<style scoped>
.podium-grid {
  display: grid;
  gap: 12px;
}

.podium-card {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 14px;
}

.podium-card svg,
.podium-place {
  color: var(--app-accent);
}

.podium-card strong {
  overflow: hidden;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.podium-card small {
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 900;
}

@media (min-width: 740px) {
  .podium-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
