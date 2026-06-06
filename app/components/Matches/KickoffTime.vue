<script setup lang="ts">
import { Clock3 } from 'lucide-vue-next'
import { formatKickoff } from '~/utils/date'

const props = defineProps<{
  startsAtUtc: string
}>()
</script>

<template>
  <time class="kickoff-time" :datetime="props.startsAtUtc">
    <Clock3 :size="16" aria-hidden="true" />
    {{ formatKickoff(props.startsAtUtc) }}
  </time>
</template>

<style scoped>
.kickoff-time {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 800;
}
</style>
