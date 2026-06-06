<script setup lang="ts">
import type { Match, Player, Team } from '~/types/domain'
import { displayTeamName, getTeamFlag } from '~/utils/footballUi'
import { validatePredictionInput } from '~/utils/scoring'

export interface BulkPredictionDraft {
  predictedHomeScore: number
  predictedAwayScore: number
  firstScorerPlayerId: string | null
  noScorer: boolean
}

const draft = defineModel<BulkPredictionDraft>('draft', { required: true })

const props = defineProps<{
  match: Match
  players: readonly Player[]
  teams: readonly Team[]
}>()

const emit = defineEmits<{
  validity: [message: string | null]
}>()

const homeTeam = computed(() => props.teams.find((team) => team.id === props.match.homeTeamId))
const awayTeam = computed(() => props.teams.find((team) => team.id === props.match.awayTeamId))
const homeFlag = computed(() => getTeamFlag(homeTeam.value))
const awayFlag = computed(() => getTeamFlag(awayTeam.value))

const homeScore = computed({
  get: () => draft.value.predictedHomeScore,
  set: (value: number) => {
    draft.value = { ...draft.value, predictedHomeScore: value }
  },
})

const awayScore = computed({
  get: () => draft.value.predictedAwayScore,
  set: (value: number) => {
    draft.value = { ...draft.value, predictedAwayScore: value }
  },
})

const firstScorerPlayerId = computed({
  get: () => draft.value.firstScorerPlayerId,
  set: (value: string | null) => {
    draft.value = { ...draft.value, firstScorerPlayerId: value }
  },
})

const noScorer = computed({
  get: () => draft.value.noScorer,
  set: (value: boolean) => {
    draft.value = {
      ...draft.value,
      noScorer: value,
      firstScorerPlayerId: value ? null : draft.value.firstScorerPlayerId,
      predictedHomeScore: value ? 0 : draft.value.predictedHomeScore,
      predictedAwayScore: value ? 0 : draft.value.predictedAwayScore,
    }
  },
})

const validationMessage = computed(() =>
  validatePredictionInput({
    predictedHomeScore: draft.value.predictedHomeScore,
    predictedAwayScore: draft.value.predictedAwayScore,
    firstScorerPlayerId: draft.value.firstScorerPlayerId,
    noScorer: draft.value.noScorer,
  }),
)

watch(
  validationMessage,
  (message) => {
    emit('validity', message)
  },
  { immediate: true },
)
</script>

<template>
  <section class="bulk-prediction-editor panel">
    <div class="editor-header">
      <div>
        <span class="form-kicker">Typ meczu</span>
        <h3>Twój typ</h3>
      </div>
      <p>Możesz zmieniać typ do pierwszego gwizdka.</p>
    </div>

    <div class="score-grid">
      <ScoreStepper
        v-model="homeScore"
        label="Gospodarze"
        :team-name="displayTeamName(homeTeam)"
        :flag-src="homeFlag.src"
        :flag-emoji="homeFlag.emoji"
      />
      <div class="score-divider" aria-hidden="true">VS</div>
      <ScoreStepper
        v-model="awayScore"
        label="Goście"
        :team-name="displayTeamName(awayTeam)"
        :flag-src="awayFlag.src"
        :flag-emoji="awayFlag.emoji"
      />
    </div>

    <div class="scorer-section">
      <PlayerSelect v-model="firstScorerPlayerId" :players="props.players" :teams="props.teams" :disabled="noScorer" />
      <NoScorerToggle v-model="noScorer" />
    </div>

    <p v-if="validationMessage" class="validation-message">{{ validationMessage }}</p>
  </section>
</template>

<style scoped>
.bulk-prediction-editor {
  display: grid;
  gap: 18px;
  padding: 16px;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--app-line);
  padding-bottom: 14px;
}

.editor-header h3,
.editor-header p,
.validation-message {
  margin: 0;
}

.form-kicker {
  display: block;
  margin-bottom: 3px;
  color: var(--app-primary);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}

.editor-header h3 {
  font-size: 24px;
  line-height: 1;
}

.editor-header p,
.validation-message {
  max-width: 360px;
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 750;
  line-height: 1.35;
  text-align: right;
}

.score-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}

.score-divider {
  display: inline-flex;
  width: 42px;
  height: 42px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent),
    #13231b;
  color: white;
  font-size: 12px;
  font-weight: 950;
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.24);
}

.scorer-section {
  display: flex;
  align-items: end;
  gap: 10px;
}

.scorer-section > :first-child {
  flex: 1 1 auto;
  min-width: 0;
}

.validation-message {
  max-width: none;
  color: var(--app-danger);
  text-align: left;
}

@media (max-width: 640px) {
  .editor-header {
    display: grid;
    gap: 8px;
  }

  .editor-header p {
    max-width: none;
    text-align: left;
  }

  .score-grid {
    grid-template-columns: 1fr;
  }

  .score-divider {
    justify-self: center;
    margin-block: -2px;
  }

  .scorer-section {
    display: grid;
    align-items: stretch;
  }
}
</style>
