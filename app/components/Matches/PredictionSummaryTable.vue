<script setup lang="ts">
import type { LeagueMember, MatchPrediction } from '~/types/domain'
import { predictionScoreLabel } from '~/utils/footballUi'

type SortDirection = 'asc' | 'desc'
type SortKey = 'player' | 'stagePosition' | 'score' | 'scorer'
type PredictionSummaryRow = {
  member: LeagueMember
  prediction: MatchPrediction
  scorerName: string
  predictedAdvancedTeamName: string | null
  predictedAdvancedTeamSide: 'home' | 'away' | null
  stagePosition: number | null
}

const props = defineProps<{
  rows: readonly PredictionSummaryRow[]
  loading?: boolean
}>()

const sortKey = shallowRef<SortKey>('stagePosition')
const sortDirection = shallowRef<SortDirection>('asc')
const defaultSortDirection: Record<SortKey, SortDirection> = {
  player: 'asc',
  stagePosition: 'asc',
  score: 'desc',
  scorer: 'asc',
}

const sortedRows = computed(() =>
  [...props.rows].sort((left, right) => {
    const direction = sortDirection.value === 'asc' ? 1 : -1
    const result = compareRows(left, right, sortKey.value)

    return result ? result * direction : left.member.displayName.localeCompare(right.member.displayName, 'pl')
  }),
)

function setSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    return
  }

  sortKey.value = key
  sortDirection.value = defaultSortDirection[key]
}

function compareRows(left: PredictionSummaryRow, right: PredictionSummaryRow, key: SortKey) {
  if (key === 'player') {
    return left.member.displayName.localeCompare(right.member.displayName, 'pl')
  }

  if (key === 'stagePosition') {
    return (left.stagePosition ?? Number.MAX_SAFE_INTEGER) - (right.stagePosition ?? Number.MAX_SAFE_INTEGER)
  }

  if (key === 'score') {
    return (
      left.prediction.predictedHomeScore - right.prediction.predictedHomeScore ||
      left.prediction.predictedAwayScore - right.prediction.predictedAwayScore
    )
  }

  return left.scorerName.localeCompare(right.scorerName, 'pl')
}

function sortIndicator(key: SortKey) {
  if (sortKey.value !== key) {
    return '▲▼'
  }

  return sortDirection.value === 'asc' ? '▲' : '▼'
}

function sortButtonClass(key: SortKey) {
  return { 'is-active': sortKey.value === key }
}
</script>

<template>
  <section class="prediction-summary" aria-label="Typy graczy">
    <div class="prediction-summary-head">
      <span>Typy graczy</span>
      <strong v-if="props.loading">Pobieram...</strong>
    </div>

    <div class="prediction-summary-table">
      <div class="prediction-summary-row prediction-summary-row-head">
        <button type="button" class="sort-button" :class="sortButtonClass('stagePosition')" @click="setSort('stagePosition')">
          Poz. etap <span aria-hidden="true">{{ sortIndicator('stagePosition') }}</span>
        </button>
        <button type="button" class="sort-button" :class="sortButtonClass('player')" @click="setSort('player')">
          Gracz <span aria-hidden="true">{{ sortIndicator('player') }}</span>
        </button>
        <button type="button" class="sort-button" :class="sortButtonClass('score')" @click="setSort('score')">
          Wynik <span aria-hidden="true">{{ sortIndicator('score') }}</span>
        </button>
        <button type="button" class="sort-button" :class="sortButtonClass('scorer')" @click="setSort('scorer')">
          Strzelec <span aria-hidden="true">{{ sortIndicator('scorer') }}</span>
        </button>
      </div>

      <div v-for="{ member, prediction, scorerName, predictedAdvancedTeamName, predictedAdvancedTeamSide, stagePosition } in sortedRows" :key="prediction.id" class="prediction-summary-row">
        <span class="prediction-summary-position">{{ stagePosition ? `#${stagePosition}` : '-' }}</span>
        <strong class="prediction-summary-player">{{ member.displayName }}</strong>
        <div class="prediction-summary-score-cell">
          <strong
            class="prediction-summary-score"
            :aria-label="predictedAdvancedTeamName
              ? `${predictionScoreLabel(prediction)}, awansuje ${predictedAdvancedTeamName}`
              : predictionScoreLabel(prediction)"
          >
            <span
              class="prediction-summary-score-number"
              :class="{ 'is-advancing': predictedAdvancedTeamSide === 'home' }"
              aria-hidden="true"
            >{{ prediction.predictedHomeScore }}</span>
            <span class="prediction-summary-score-separator" aria-hidden="true">:</span>
            <span
              class="prediction-summary-score-number"
              :class="{ 'is-advancing': predictedAdvancedTeamSide === 'away' }"
              aria-hidden="true"
            >{{ prediction.predictedAwayScore }}</span>
          </strong>
        </div>
        <span class="prediction-summary-scorer">{{ scorerName }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.prediction-summary {
  display: grid;
  width: 100%;
  gap: 8px;
  border-top: 1px solid rgba(223, 230, 221, 0.8);
  padding-top: 11px;
}

.prediction-summary-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.prediction-summary-head span,
.prediction-summary-head strong,
.prediction-summary-row-head {
  color: var(--app-muted);
  font-size: 10px;
  font-weight: 950;
  text-transform: uppercase;
}

.prediction-summary-table {
  display: grid;
  overflow: hidden;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: #fbfdf9;
}

.prediction-summary-row {
  display: grid;
  grid-template-columns: 76px minmax(120px, 220px) minmax(82px, 138px) minmax(140px, 1fr);
  align-items: center;
  gap: 8px;
  min-width: 0;
  border-top: 1px solid var(--app-line);
  padding: 9px 10px;
}

.prediction-summary-row:first-child {
  border-top: 0;
}

.prediction-summary-row-head {
  background: #f3f7f1;
  padding-block: 8px;
}

.sort-button {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  padding: 0;
  text-align: left;
  text-transform: inherit;
}

.sort-button:hover,
.sort-button:focus-visible {
  color: var(--app-primary-dark);
  outline: 0;
}

.sort-button.is-active {
  color: var(--app-primary-dark);
}

.sort-button span {
  display: inline-flex;
  min-width: 18px;
  justify-content: flex-start;
  color: rgba(89, 99, 110, 0.65);
  font-size: 9px;
  letter-spacing: -0.08em;
}

.sort-button.is-active span {
  color: var(--app-primary-dark);
  letter-spacing: 0;
}

.prediction-summary-player,
.prediction-summary-position,
.prediction-summary-scorer {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prediction-summary-score-cell {
  display: flex;
  align-items: center;
  min-width: 0;
}

.prediction-summary-player {
  color: var(--app-primary-dark);
  font-size: 13px;
  font-weight: 950;
}

.prediction-summary-position {
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 950;
}

.prediction-summary-score {
  display: inline-flex;
  min-width: 42px;
  min-height: 28px;
  align-items: center;
  justify-content: center;
  justify-self: start;
  border-radius: 7px;
  background: #13231b;
  color: white;
  font-size: 13px;
  font-weight: 950;
}

.prediction-summary-score-number {
  display: inline-flex;
  min-width: 0.65em;
  justify-content: center;
}

.prediction-summary-score-number.is-advancing {
  color: #f1ca72;
  text-decoration: underline;
  text-decoration-color: #d7b46a;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}

.prediction-summary-scorer {
  color: var(--app-ink);
  font-size: 12px;
  font-weight: 850;
}

@media (max-width: 420px) {
  .prediction-summary {
    width: 100%;
  }

  .prediction-summary-row {
    grid-template-columns: 46px minmax(72px, 1fr) minmax(64px, 92px) minmax(76px, 1fr);
    gap: 7px;
    padding-inline: 8px;
  }

  .prediction-summary-player,
  .prediction-summary-scorer {
    font-size: 11px;
  }
}
</style>
