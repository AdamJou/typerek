<script setup lang="ts">
import { Save, Trash2 } from 'lucide-vue-next'
import type { Match, MatchPrediction, Player, Team, TournamentStage } from '~/types/domain'
import { displayTeamName, getTeamFlag } from '~/utils/footballUi'
import { isKnockoutStage, isPredictionLocked, validatePredictionInput } from '~/utils/scoring'

const props = defineProps<{
  match: Match
  stage: TournamentStage
  leagueId: string
  userId: string
  players: readonly Player[]
  teams: readonly Team[]
  existingPrediction?: MatchPrediction
}>()

const emit = defineEmits<{
  save: [prediction: MatchPrediction]
  remove: [predictionId: string]
}>()

const homeScore = shallowRef(props.existingPrediction?.predictedHomeScore ?? 0)
const awayScore = shallowRef(props.existingPrediction?.predictedAwayScore ?? 0)
const firstScorerPlayerId = shallowRef<string | null>(props.existingPrediction?.firstScorerPlayerId ?? null)
const noScorer = shallowRef(props.existingPrediction?.noScorer ?? false)
const predictedAdvancedTeamId = shallowRef<string | null>(props.existingPrediction?.predictedAdvancedTeamId ?? null)
const homeTeam = computed(() => props.teams.find((team) => team.id === props.match.homeTeamId))
const awayTeam = computed(() => props.teams.find((team) => team.id === props.match.awayTeamId))
const matchTeams = computed(() => [homeTeam.value, awayTeam.value].filter((team): team is Team => Boolean(team)))
const knockout = computed(() => isKnockoutStage(props.stage))
const predictedDraw = computed(() => homeScore.value === awayScore.value)
const impliedAdvancedTeamName = computed(() => {
  if (!knockout.value || predictedDraw.value) {
    return ''
  }

  return displayTeamName(homeScore.value > awayScore.value ? homeTeam.value : awayTeam.value)
})
const resolvedPredictedAdvancedTeamId = computed(() => {
  if (!knockout.value) {
    return null
  }

  if (predictedDraw.value) {
    return predictedAdvancedTeamId.value
  }

  return homeScore.value > awayScore.value ? props.match.homeTeamId : props.match.awayTeamId
})
const locked = computed(() => isPredictionLocked(props.match))
const homeFlag = computed(() => getTeamFlag(homeTeam.value))
const awayFlag = computed(() => getTeamFlag(awayTeam.value))
const validationMessage = computed(() =>
  validatePredictionInput({
    predictedHomeScore: homeScore.value,
    predictedAwayScore: awayScore.value,
    firstScorerPlayerId: firstScorerPlayerId.value,
    noScorer: noScorer.value,
    predictedAdvancedTeamId: resolvedPredictedAdvancedTeamId.value,
  }, {
    isKnockout: knockout.value,
    homeTeamId: props.match.homeTeamId,
    awayTeamId: props.match.awayTeamId,
  }),
)

watch(
  () => props.existingPrediction,
  (prediction) => {
    if (!prediction) {
      return
    }

    homeScore.value = prediction.predictedHomeScore
    awayScore.value = prediction.predictedAwayScore
    firstScorerPlayerId.value = prediction.firstScorerPlayerId
    noScorer.value = prediction.noScorer
    predictedAdvancedTeamId.value = prediction.predictedAdvancedTeamId
  },
)

watch(noScorer, (enabled) => {
  if (enabled) {
    firstScorerPlayerId.value = null
    homeScore.value = 0
    awayScore.value = 0
  }
})

function submitPrediction() {
  if (locked.value || validationMessage.value) {
    return
  }

  emit('save', {
    id: props.existingPrediction?.id ?? crypto.randomUUID(),
    leagueId: props.leagueId,
    userId: props.userId,
    matchId: props.match.id,
    predictedHomeScore: homeScore.value,
    predictedAwayScore: awayScore.value,
    firstScorerPlayerId: noScorer.value ? null : firstScorerPlayerId.value,
    noScorer: noScorer.value,
    predictedAdvancedTeamId: resolvedPredictedAdvancedTeamId.value,
    updatedAt: new Date().toISOString(),
  })
}

function removePrediction() {
  if (!props.existingPrediction || locked.value) {
    return
  }

  emit('remove', props.existingPrediction.id)
}
</script>

<template>
  <form class="prediction-form panel" @submit.prevent="submitPrediction">
    <div class="prediction-form-header">
      <div>
        <span class="form-kicker">Typ meczu</span>
        <h2>Twój typ</h2>
      </div>
      <p v-if="locked">Typowanie tego meczu jest już zablokowane.</p>
      <p v-else>Możesz zmieniać typ do pierwszego gwizdka.</p>
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

    <div v-if="knockout" class="knockout-notice">
      <p>Wynik i strzelcy liczą się do 90. minuty.</p>
      <p v-if="predictedDraw">Przy remisie wskaż drużynę, która awansuje dalej.</p>
      <p v-else>
        Twój typ wskazuje zwycięzcę: <strong>{{ impliedAdvancedTeamName }}</strong>. Automatycznie zakładamy, że ta drużyna awansuje dalej.
      </p>
    </div>

    <AdvancementPicker
      v-if="knockout && predictedDraw"
      v-model="predictedAdvancedTeamId"
      :teams="matchTeams"
      :disabled="locked"
    />

    <div class="scorer-section">
      <PlayerSelect v-model="firstScorerPlayerId" :players="props.players" :teams="props.teams" :disabled="noScorer" />
      <NoScorerToggle v-model="noScorer" />
    </div>

    <p v-if="validationMessage" class="validation-message">{{ validationMessage }}</p>

    <div class="prediction-actions">
      <button class="button-primary" type="submit" :disabled="locked || Boolean(validationMessage)">
        <Save :size="18" aria-hidden="true" />
        Zapisz typ
      </button>
      <button class="button-ghost" type="button" :disabled="locked || !props.existingPrediction" @click="removePrediction">
        <Trash2 :size="18" aria-hidden="true" />
        Usuń
      </button>
    </div>
  </form>
</template>

<style scoped>
.prediction-form {
  display: grid;
  gap: 18px;
  padding: 16px;
}

.prediction-form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--app-line);
  padding-bottom: 14px;
}

.prediction-form-header h2,
.prediction-form-header p,
.knockout-notice,
.validation-message {
  margin: 0;
}

.knockout-notice {
  display: grid;
  gap: 3px;
  border-left: 3px solid #d7b46a;
  border-radius: 0 7px 7px 0;
  background: #fff8e8;
  padding: 10px 12px;
  color: #665224;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.4;
}

.knockout-notice p {
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

.prediction-form-header h2 {
  font-size: 24px;
  line-height: 1;
}

.prediction-form-header p,
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

.prediction-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.prediction-actions button {
  min-height: 48px;
}

.prediction-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@media (max-width: 640px) {
  .prediction-form-header {
    display: grid;
    gap: 8px;
  }

  .prediction-form-header p {
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

  .prediction-actions {
    grid-template-columns: 1fr;
  }
}
</style>
