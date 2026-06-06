<script setup lang="ts">
import type { MatchStatus } from '~/types/domain'

const props = defineProps<{
  status: MatchStatus
}>()

const labels: Record<MatchStatus, string> = {
  scheduled: 'Zaplanowany',
  live: 'W toku',
  finished: 'Zakończony',
  confirmed: 'Potwierdzony',
  postponed: 'Przełożony',
}
</script>

<template>
  <span class="status-badge" :class="`status-${props.status}`">{{ labels[props.status] }}</span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  min-height: 24px;
  align-items: center;
  border-radius: 6px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  white-space: nowrap;
}

.status-scheduled {
  background: #e9f2ec;
  color: var(--app-primary-dark);
}

.status-live {
  background: #fff1cf;
  color: #826014;
}

.status-finished,
.status-confirmed {
  background: #e7eef5;
  color: var(--app-blue);
}

.status-postponed {
  background: #f7e4e2;
  color: var(--app-danger);
}
</style>
