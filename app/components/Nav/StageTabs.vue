<script setup lang="ts">
import type { TournamentStage } from '~/types/domain'

const props = defineProps<{
  stages: readonly TournamentStage[]
  activeStageId: string
  allLabel?: string
}>()

const emit = defineEmits<{
  select: [stageId: string]
}>()
</script>

<template>
  <div class="stage-tabs" role="tablist" aria-label="Etapy turnieju">
    <button
      v-if="props.allLabel"
      class="stage-tab"
      :class="{ 'stage-tab-active': props.activeStageId === '' }"
      type="button"
      role="tab"
      :aria-selected="props.activeStageId === ''"
      @click="emit('select', '')"
    >
      {{ props.allLabel }}
    </button>
    <button
      v-for="stage in props.stages"
      :key="stage.id"
      class="stage-tab"
      :class="{ 'stage-tab-active': stage.id === props.activeStageId }"
      type="button"
      role="tab"
      :aria-selected="stage.id === props.activeStageId"
      @click="emit('select', stage.id)"
    >
      {{ stage.shortName }}
    </button>
  </div>
</template>

<style scoped>
.stage-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.stage-tab {
  min-height: 36px;
  flex: 0 0 auto;
  border: 1px solid var(--app-line);
  border-radius: 7px;
  background: white;
  padding: 0 12px;
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 800;
}

.stage-tab-active {
  border-color: var(--app-primary);
  background: var(--app-primary);
  color: white;
}
</style>
