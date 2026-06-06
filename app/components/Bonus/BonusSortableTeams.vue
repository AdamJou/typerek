<script setup lang="ts">
import { GripVertical, RotateCcw } from 'lucide-vue-next'
import type { Team } from '~/types/domain'
import { displayTeamName, getTeamFlag } from '~/utils/footballUi'

const model = defineModel<string[]>({ required: true })

const props = defineProps<{
  title: string
  teams: readonly Team[]
  disabled?: boolean
  compact?: boolean
}>()

const dragFromIndex = shallowRef<number | null>(null)

const orderedTeams = computed(() => {
  const byId = new Map(props.teams.map((team) => [team.id, team]))
  return model.value.map((teamId) => byId.get(teamId)).filter((team): team is Team => Boolean(team))
})

function moveTeam(fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
    return
  }

  const next = [...model.value]
  const [moved] = next.splice(fromIndex, 1)

  if (!moved) {
    return
  }

  next.splice(toIndex, 0, moved)
  model.value = next
}

function resetOrder() {
  model.value = props.teams.map((team) => team.id)
}
</script>

<template>
  <section class="sortable-block">
    <div class="sortable-header">
      <h4>{{ title }}</h4>
      <button v-if="!disabled" class="reset-button" type="button" @click="resetOrder">
        <RotateCcw :size="14" aria-hidden="true" />
        Reset
      </button>
    </div>

    <div class="sortable-list">
      <article
        v-for="(team, index) in orderedTeams"
        :key="team.id"
        class="sortable-item"
        :class="{ compact }"
        :draggable="!disabled"
        @dragstart="dragFromIndex = index"
        @dragover.prevent
        @drop.prevent="dragFromIndex !== null ? moveTeam(dragFromIndex, index) : undefined"
      >
        <span class="position-pill">{{ index + 1 }}</span>
        <div class="team-copy">
          <img
            v-if="getTeamFlag(team).src"
            class="team-flag-image"
            :src="getTeamFlag(team).src ?? undefined"
            :alt="getTeamFlag(team).alt"
            loading="lazy"
          >
          <span v-else class="team-flag">{{ getTeamFlag(team).emoji }}</span>
          <strong>{{ displayTeamName(team) }}</strong>
        </div>
        <GripVertical :size="16" aria-hidden="true" />
      </article>
    </div>
  </section>
</template>

<style scoped>
.sortable-block,
.sortable-list {
  display: grid;
  gap: 10px;
}

.sortable-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sortable-header h4 {
  margin: 0;
  font-size: 16px;
}

.reset-button {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--app-line);
  border-radius: 999px;
  background: #f6faf7;
  padding: 0 10px;
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 800;
}

.sortable-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: white;
  padding: 12px;
}

.sortable-item.compact {
  padding: 10px;
}

.position-pill {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #f0f7f2;
  color: var(--app-primary-dark);
  font-size: 12px;
  font-weight: 900;
}

.team-copy {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.team-copy strong {
  min-width: 0;
  font-size: 14px;
  font-weight: 900;
  line-height: 1.2;
}

.team-flag {
  font-size: 20px;
}

.team-flag-image {
  width: 24px;
  height: 18px;
  border-radius: 2px;
  object-fit: cover;
  flex: 0 0 auto;
}
</style>
