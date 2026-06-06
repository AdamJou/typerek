<script setup lang="ts">
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-vue-next'
import type { MatchScorerInput, Player, Team } from '~/types/domain'
import { displayTeamName } from '~/utils/footballUi'

const model = defineModel<MatchScorerInput[]>({ required: true })

const props = defineProps<{
  homeTeam: Team
  awayTeam: Team
  players: readonly Player[]
  homeScore: number
  awayScore: number
}>()

const draggingIndex = shallowRef<number | null>(null)

const homeTeamName = computed(() => displayTeamName(props.homeTeam))
const awayTeamName = computed(() => displayTeamName(props.awayTeam))
const totalGoals = computed(() => props.homeScore + props.awayScore)
const homeGoalsCount = computed(() => model.value.filter((goal) => goal.teamId === props.homeTeam.id).length)
const awayGoalsCount = computed(() => model.value.filter((goal) => goal.teamId === props.awayTeam.id).length)

watch(
  () => [props.homeScore, props.awayScore, props.homeTeam.id, props.awayTeam.id] as const,
  syncGoalRows,
  { immediate: true },
)

function syncGoalRows() {
  let nextGoals = model.value.filter((goal) => goal.teamId === props.homeTeam.id || goal.teamId === props.awayTeam.id)

  nextGoals = fitTeamGoals(nextGoals, props.homeTeam.id, props.homeScore)
  nextGoals = fitTeamGoals(nextGoals, props.awayTeam.id, props.awayScore)
  model.value = normalizeGoalOrder(nextGoals)
}

function fitTeamGoals(goals: MatchScorerInput[], teamId: string, requiredCount: number) {
  const nextGoals = [...goals]
  let teamCount = nextGoals.filter((goal) => goal.teamId === teamId).length

  while (teamCount > requiredCount) {
    const removeIndex = findLastIndex(nextGoals, (goal) => goal.teamId === teamId)
    nextGoals.splice(removeIndex, 1)
    teamCount -= 1
  }

  while (teamCount < requiredCount) {
    nextGoals.push({
      teamId,
      playerId: null,
      minute: nextGoals.length + 1,
      ownGoal: false,
    })
    teamCount += 1
  }

  return nextGoals
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index]!)) {
      return index
    }
  }

  return -1
}

function normalizeGoalOrder(goals: MatchScorerInput[]) {
  return goals.map((goal, index) => ({
    ...goal,
    minute: index + 1,
  }))
}

function teamName(teamId: string) {
  return teamId === props.homeTeam.id ? homeTeamName.value : awayTeamName.value
}

function opponentTeamId(teamId: string) {
  return teamId === props.homeTeam.id ? props.awayTeam.id : props.homeTeam.id
}

function teamById(teamId: string) {
  return teamId === props.homeTeam.id ? props.homeTeam : props.awayTeam
}

function playersForGoal(goal: MatchScorerInput) {
  const playerTeamId = goal.ownGoal ? opponentTeamId(goal.teamId) : goal.teamId

  return props.players.filter((player) => player.teamId === playerTeamId)
}

function teamsForGoal(goal: MatchScorerInput) {
  return [teamById(goal.ownGoal ? opponentTeamId(goal.teamId) : goal.teamId)]
}

function goalPlayerLabel(goal: MatchScorerInput) {
  return goal.ownGoal ? 'Autor samobója' : 'Strzelec gola'
}

function goalPlayerPlaceholder(goal: MatchScorerInput) {
  return goal.ownGoal ? `Wybierz zawodnika: ${teamName(opponentTeamId(goal.teamId))}` : `Wybierz strzelca: ${teamName(goal.teamId)}`
}

function setGoalPlayer(index: number, playerId: string | null) {
  model.value = model.value.map((goal, goalIndex) => (goalIndex === index ? { ...goal, playerId } : goal))
}

function toggleOwnGoal(index: number) {
  model.value = model.value.map((goal, goalIndex) =>
    goalIndex === index ? { ...goal, ownGoal: !goal.ownGoal, playerId: null } : goal,
  )
}

function moveGoal(fromIndex: number, toIndex: number) {
  if (toIndex < 0 || toIndex >= model.value.length || fromIndex === toIndex) {
    return
  }

  const nextGoals = [...model.value]
  const [movedGoal] = nextGoals.splice(fromIndex, 1)

  if (!movedGoal) {
    return
  }

  nextGoals.splice(toIndex, 0, movedGoal)
  model.value = normalizeGoalOrder(nextGoals)
}

function onDragStart(index: number) {
  draggingIndex.value = index
}

function onDrop(targetIndex: number) {
  if (draggingIndex.value === null) {
    return
  }

  moveGoal(draggingIndex.value, targetIndex)
  draggingIndex.value = null
}
</script>

<template>
  <section class="goal-editor">
    <div class="goal-editor-head">
      <span>Strzelcy bramek</span>
      <div class="goal-counts">
        <strong>{{ homeTeamName }} {{ homeGoalsCount }}/{{ props.homeScore }}</strong>
        <strong>{{ awayTeamName }} {{ awayGoalsCount }}/{{ props.awayScore }}</strong>
      </div>
    </div>

    <p v-if="totalGoals === 0" class="goal-editor-empty">Wynik 0:0 - brak listy strzelców.</p>

    <div v-else class="goal-list">
      <article
        v-for="(goal, index) in model"
        :key="`${goal.teamId}-${index}`"
        class="goal-row"
        draggable="true"
        @dragstart="onDragStart(index)"
        @dragover.prevent
        @drop="onDrop(index)"
        @dragend="draggingIndex = null"
      >
        <div class="goal-row-main">
          <div class="goal-row-top">
            <div class="goal-row-meta">
              <GripVertical :size="16" aria-hidden="true" />
              <strong>#{{ index + 1 }}</strong>
              <span>Gol dla {{ teamName(goal.teamId) }}</span>
            </div>

            <label class="own-goal-toggle" :class="{ 'is-checked': goal.ownGoal }">
              <input type="checkbox" :checked="goal.ownGoal" @change="toggleOwnGoal(index)" />
              <span>Samobój</span>
            </label>
          </div>

          <PlayerSelect
            :model-value="goal.playerId"
            :players="playersForGoal(goal)"
            :teams="teamsForGoal(goal)"
            :label="goalPlayerLabel(goal)"
            :placeholder="goalPlayerPlaceholder(goal)"
            @update:model-value="setGoalPlayer(index, $event)"
          />
        </div>

        <div class="goal-row-actions">
          <button type="button" :disabled="index === 0" aria-label="Przesuń gol wyżej" @click="moveGoal(index, index - 1)">
            <ArrowUp :size="16" aria-hidden="true" />
          </button>
          <button
            type="button"
            :disabled="index === model.length - 1"
            aria-label="Przesuń gol niżej"
            @click="moveGoal(index, index + 1)"
          >
            <ArrowDown :size="16" aria-hidden="true" />
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.goal-editor {
  display: grid;
  gap: 10px;
}

.goal-editor-head {
  display: grid;
  gap: 8px;
}

.goal-editor-head > span {
  font-size: 13px;
  font-weight: 950;
}

.goal-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.goal-counts strong {
  display: inline-flex;
  min-height: 26px;
  align-items: center;
  border-radius: 7px;
  background: #eef4ef;
  padding: 0 9px;
  color: var(--app-primary-dark);
  font-size: 11px;
  font-weight: 950;
}

.goal-editor-empty {
  margin: 0;
  border: 1px dashed var(--app-line);
  border-radius: 8px;
  padding: 12px;
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 800;
}

.goal-list {
  display: grid;
  gap: 10px;
}

.goal-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 34px;
  gap: 8px;
  align-items: stretch;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: #fbfdf9;
  padding: 8px;
}

.goal-row-main {
  display: grid;
  min-width: 0;
  gap: 8px;
}

.goal-row-main :deep(.player-select) {
  min-width: 0;
}

.goal-row-top {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.own-goal-toggle {
  display: inline-flex;
  flex: 0 0 auto;
  width: fit-content;
  min-height: 26px;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--app-line);
  border-radius: 7px;
  background: white;
  padding: 0 8px;
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 950;
  cursor: pointer;
}

.own-goal-toggle.is-checked {
  border-color: rgba(215, 180, 106, 0.85);
  background: #fff6dd;
  color: #765813;
}

.own-goal-toggle input {
  width: 13px;
  height: 13px;
  accent-color: var(--app-primary);
}

.goal-row-meta {
  display: flex;
  min-width: 0;
  gap: 6px;
  align-items: center;
  color: var(--app-muted);
  cursor: grab;
}

.goal-row-meta strong {
  flex: 0 0 auto;
  color: var(--app-ink);
  font-size: 12px;
  font-weight: 950;
}

.goal-row-meta span {
  min-width: 0;
  overflow: hidden;
  color: var(--app-primary-dark);
  font-size: 11px;
  font-weight: 950;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.goal-row-actions {
  display: grid;
  align-content: center;
  gap: 6px;
}

.goal-row-actions button {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--app-line);
  border-radius: 7px;
  background: white;
  color: var(--app-primary-dark);
}

.goal-row-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

@media (max-width: 680px) {
  .goal-row-actions {
    align-content: stretch;
  }
}
</style>
