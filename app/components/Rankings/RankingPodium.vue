<script setup lang="ts">
import { Medal } from 'lucide-vue-next'
import type { RankingRow } from '~/types/domain'

const props = defineProps<{
  rows: readonly RankingRow[]
}>()

const podiumRows = computed(() => props.rows.filter((row) => row.position <= 3))
</script>

<template>
  <div class="podium-grid">
    <NuxtLink
      v-for="row in podiumRows"
      :key="row.userId"
      class="podium-card panel"
      :to="`/participants/${row.userId}`"
    >
      <Medal :size="22" aria-hidden="true" />
      <span class="podium-place">{{ row.position }}.</span>
      <strong>{{ row.displayName }}</strong>
      <small>{{ row.totalPoints }} pkt</small>
    </NuxtLink>
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
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.podium-card:hover,
.podium-card:focus-visible {
  border-color: rgba(12, 107, 70, 0.38);
  box-shadow: 0 18px 46px rgba(26, 42, 34, 0.12);
  transform: translateY(-1px);
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
