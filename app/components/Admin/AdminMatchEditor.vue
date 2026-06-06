<script setup lang="ts">
import { Loader2, Save } from 'lucide-vue-next'
import type { Match, MatchEvent, MatchScorerInput, Player, Team } from '~/types/domain'
import { displayTeamName, getTeamFlag } from '~/utils/footballUi'

const props = defineProps<{
  match: Match
  matchEvents: readonly MatchEvent[]
  homeTeam: Team
  awayTeam: Team
  players: readonly Player[]
}>()

const emit = defineEmits<{
  saved: [match: Match]
}>()

const { setMatchResult } = useTyperekData()
const homeScore = shallowRef(props.match.homeScore90 ?? 0)
const awayScore = shallowRef(props.match.awayScore90 ?? 0)
const noScorerConfirmed = shallowRef(props.match.noScorerConfirmed)
const goalScorers = ref<MatchScorerInput[]>([])
const isSaving = shallowRef(false)
const errorMessage = shallowRef('')
const successMessage = shallowRef('')

const homeTeamName = computed(() => displayTeamName(props.homeTeam))
const awayTeamName = computed(() => displayTeamName(props.awayTeam))
const homeFlag = computed(() => getTeamFlag(props.homeTeam))
const awayFlag = computed(() => getTeamFlag(props.awayTeam))
const totalGoals = computed(() => homeScore.value + awayScore.value)
const isScoreless = computed(() => totalGoals.value === 0)
const validationMessage = computed(() => {
  if (homeScore.value < 0 || awayScore.value < 0) {
    return 'Wynik nie może być ujemny.'
  }

  if (isScoreless.value) {
    return noScorerConfirmed.value ? '' : 'Dla wyniku 0:0 zaznacz Brak strzelca.'
  }

  if (goalScorers.value.length !== totalGoals.value) {
    return 'Liczba strzelców musi zgadzać się z wynikiem.'
  }

  if (goalScorers.value.some((goal) => !goal.playerId)) {
    return 'Uzupełnij strzelca przy każdym golu.'
  }

  const homeGoals = goalScorers.value.filter((goal) => goal.teamId === props.homeTeam.id).length
  const awayGoals = goalScorers.value.filter((goal) => goal.teamId === props.awayTeam.id).length

  if (homeGoals !== homeScore.value || awayGoals !== awayScore.value) {
    return 'Podział goli musi zgadzać się z wynikiem gospodarzy i gości.'
  }

  return ''
})

watch(
  () => [props.match, props.matchEvents] as const,
  ([match]) => {
    homeScore.value = match.homeScore90 ?? 0
    awayScore.value = match.awayScore90 ?? 0
    noScorerConfirmed.value = match.noScorerConfirmed || ((match.homeScore90 ?? 0) === 0 && (match.awayScore90 ?? 0) === 0)
    goalScorers.value = goalScorersFromEvents()
  },
  { immediate: true },
)

watch([homeScore, awayScore], () => {
  if (isScoreless.value) {
    noScorerConfirmed.value = true
    goalScorers.value = []
    return
  }

  noScorerConfirmed.value = false
})

function goalScorersFromEvents() {
  const goalEvents = [...props.matchEvents]
    .filter((event) => event.eventType === 'goal')
    .sort((a, b) => a.minute - b.minute || a.createdAt.localeCompare(b.createdAt))
  const manualEvents = goalEvents.filter((event) => event.provider === 'manual')
  const sourceEvents = manualEvents.length ? manualEvents : goalEvents

  if (sourceEvents.length > 0) {
    return sourceEvents.map((event, index) => ({
      teamId: event.teamId ?? props.homeTeam.id,
      playerId: event.playerId,
      minute: index + 1,
      ownGoal: event.detail === 'manual_own_goal' || event.detail === 'own_goal',
    }))
  }

  if (props.match.firstScorerPlayerId && totalGoals.value > 0) {
    const firstScorer = props.players.find((player) => player.id === props.match.firstScorerPlayerId)
    const teamId = firstScorer?.teamId === props.awayTeam.id ? props.awayTeam.id : props.homeTeam.id

    return [
      {
        teamId,
        playerId: props.match.firstScorerPlayerId,
        minute: 1,
        ownGoal: false,
      },
    ]
  }

  return []
}

async function submitResult() {
  errorMessage.value = ''
  successMessage.value = ''

  if (validationMessage.value) {
    errorMessage.value = validationMessage.value
    return
  }

  isSaving.value = true

  try {
    const savedMatch = await setMatchResult({
      matchId: props.match.id,
      homeScore90: homeScore.value,
      awayScore90: awayScore.value,
      firstScorerPlayerId: isScoreless.value ? null : goalScorers.value.find((goal) => !goal.ownGoal)?.playerId ?? null,
      noScorerConfirmed: isScoreless.value && noScorerConfirmed.value,
      scorers: isScoreless.value ? [] : goalScorers.value,
      reason: null,
    })

    successMessage.value = 'Wynik i strzelcy zapisani. Punkty przeliczone.'
    emit('saved', savedMatch)
  } catch (error) {
    errorMessage.value = matchResultErrorMessage(error)
  } finally {
    isSaving.value = false
  }
}

function matchResultErrorMessage(error: unknown) {
  const message = extractErrorMessage(error)

  if (message.includes('admin_required')) {
    return 'Tylko admin może zapisać wynik meczu.'
  }

  if (message.includes('not_authenticated')) {
    return 'Zaloguj się ponownie, żeby zapisać wynik.'
  }

  if (message.includes('goal_player_team_mismatch')) {
    return 'Strzelec gola musi byc z druzyny, ktorej gol zostal przypisany.'
  }

  if (message.includes('own_goal_player_team_mismatch')) {
    return 'Przy samoboju wybierz zawodnika z druzyny przeciwnej.'
  }

  if (message.includes('first_scorer_not_in_match') || message.includes('invalid_goal_scorer')) {
    return 'Wybrany strzelec nie należy do drużyn z tego meczu.'
  }

  if (message.includes('no_scorer_requires_zero_zero')) {
    return 'Brak strzelca można zapisać tylko przy wyniku 0:0.'
  }

  if (message.includes('goal_count_mismatch') || message.includes('goal_team_count_mismatch')) {
    return 'Lista goli nie zgadza się z wynikiem meczu.'
  }

  if (message.includes('invalid_score')) {
    return 'Wynik musi być liczbą dodatnią albo zerem.'
  }

  if (message.includes('match_not_found')) {
    return 'Nie znaleziono tego meczu.'
  }

  if (message.includes('supabase_admin_not_configured')) {
    return 'Brakuje konfiguracji Supabase URL albo publicznego klucza.'
  }

  if (message.includes('match_result_migration_missing')) {
    return 'Brakuje migracji 0004 z funkcja set_match_result_with_events w Supabase.'
  }

  return message
}

function extractErrorMessage(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return 'Nie udalo sie zapisac wyniku.'
  }

  if ('data' in error && typeof error.data === 'object' && error.data !== null && 'statusMessage' in error.data) {
    return String(error.data.statusMessage)
  }

  if ('statusMessage' in error) {
    return String(error.statusMessage)
  }

  if ('message' in error) {
    return String(error.message)
  }

  return 'Nie udalo sie zapisac wyniku.'
}
</script>

<template>
  <section class="match-editor panel">
    <div class="match-editor-title">
      <div class="match-editor-heading-copy">
        <span v-if="props.match.matchNumber" class="match-number">Mecz {{ props.match.matchNumber }}</span>
        <h2>{{ homeTeamName }} - {{ awayTeamName }}</h2>
      </div>
      <MatchStatusBadge :status="props.match.status" />
    </div>

    <div class="match-editor-grid">
      <ScoreStepper
        v-model="homeScore"
        label="Gospodarze"
        :team-name="homeTeamName"
        :flag-src="homeFlag.src"
        :flag-emoji="homeFlag.emoji"
      />
      <ScoreStepper
        v-model="awayScore"
        label="Goście"
        :team-name="awayTeamName"
        :flag-src="awayFlag.src"
        :flag-emoji="awayFlag.emoji"
      />
    </div>

    <div class="scorer-section">
      <div class="field-heading">
        <span>Strzelcy i kolejność goli</span>
        <small v-if="props.players.length">{{ props.players.length }} zawodników do wyboru</small>
      </div>

      <NoScorerToggle v-if="isScoreless" v-model="noScorerConfirmed" />
      <AdminGoalScorersEditor
        v-else
        v-model="goalScorers"
        :home-team="props.homeTeam"
        :away-team="props.awayTeam"
        :players="props.players"
        :home-score="homeScore"
        :away-score="awayScore"
      />
    </div>

    <p v-if="errorMessage" class="feedback feedback-error" role="alert">{{ errorMessage }}</p>
    <p v-else-if="successMessage" class="feedback feedback-success" role="status">{{ successMessage }}</p>

    <button class="button-primary save-button" type="button" :disabled="isSaving" @click="submitResult">
      <Loader2 v-if="isSaving" :size="18" class="spinner" aria-hidden="true" />
      <Save v-else :size="18" aria-hidden="true" />
      {{ isSaving ? 'Zapisuję' : 'Zapisz wynik i strzelców' }}
    </button>
  </section>
</template>

<style scoped>
.match-editor {
  display: grid;
  gap: 16px;
  padding: 16px;
}

.match-editor-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.match-editor-heading-copy {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.match-number,
.field-heading small {
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}

.match-editor-heading-copy h2 {
  margin: 0;
  font-size: 18px;
  line-height: 1.15;
}

.match-editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.scorer-section {
  display: grid;
  gap: 8px;
}

.field-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--app-ink);
  font-size: 13px;
  font-weight: 950;
}

.field-heading small {
  text-transform: none;
}

.feedback {
  margin: 0;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 850;
  line-height: 1.35;
}

.feedback-error {
  background: #f9e7e4;
  color: var(--app-danger);
}

.feedback-success {
  background: #e7f4eb;
  color: var(--app-primary-dark);
}

.save-button {
  justify-content: center;
}

.save-button:disabled {
  cursor: wait;
  opacity: 0.72;
}

.spinner {
  animation: spin 900ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 520px) {
  .match-editor-grid {
    grid-template-columns: 1fr;
  }

  .match-editor-title,
  .field-heading {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
