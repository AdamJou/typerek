<script setup lang="ts">
import { isMatchPredictionOpen, isPredictionLocked, isStagePredictionOpen } from '~/utils/scoring'

const route = useRoute()
const {
  currentUserId,
  deletePrediction,
  errorMessage,
  hasLeague,
  hasLoaded,
  isLoading,
  league,
  matchEvents,
  matches,
  players,
  predictions,
  stages,
  teams,
  upsertLocalPrediction,
} = useTyperekData()
const { getMatchTeams, getPlayer, getPlayersForMatch } = useTeamLookup(teams, players)
const match = computed(() => matches.find((candidate) => candidate.id === route.params.id))
const currentMatchEvents = computed(() => (match.value ? matchEvents.filter((event) => event.matchId === match.value?.id) : []))
const matchTeams = computed(() => (match.value ? getMatchTeams(match.value) : null))
const matchPlayers = computed(() => (match.value ? getPlayersForMatch(match.value) : []))
const stage = computed(() => stages.find((candidate) => candidate.id === match.value?.stageId))
const savedMessage = shallowRef('')
const existingPrediction = computed(() =>
  predictions.value.find((prediction) => prediction.matchId === match.value?.id && prediction.userId === currentUserId.value),
)
const hasBothTeams = computed(() => Boolean(matchTeams.value?.homeTeam && matchTeams.value?.awayTeam))
const canPredict = computed(() => hasBothTeams.value && hasLeague.value && Boolean(currentUserId.value))
const stageOpen = computed(() => (match.value ? isStagePredictionOpen(match.value.stageId, stages, matches) : false))
const canSubmitPrediction = computed(() => Boolean(match.value && canPredict.value && isMatchPredictionOpen(match.value, stages, matches)))
const canShowPending = computed(() => {
  if (!match.value) {
    return false
  }

  return canSubmitPrediction.value && !existingPrediction.value
})
const lockedLabel = computed(() => {
  if (!match.value || existingPrediction.value || match.value.status !== 'scheduled' || isPredictionLocked(match.value)) {
    return null
  }

  if (!stageOpen.value) {
    return 'Czeka na poprzednią kolejkę'
  }

  return null
})
const predictionUnavailableMessage = computed(() => {
  if (!match.value) {
    return ''
  }

  if (!canPredict.value) {
    return 'Typowanie będzie dostępne po dołączeniu do ligi i przypisaniu obu drużyn do meczu.'
  }

  if (!stageOpen.value) {
    return 'Ta kolejka nie jest jeszcze aktywna. Będzie można typować po zakończeniu poprzedniej kolejki.'
  }

  if (match.value.status !== 'scheduled' || isPredictionLocked(match.value)) {
    return 'Typowanie tego meczu jest już zablokowane.'
  }

  return ''
})
const activeUserId = computed(() => currentUserId.value ?? '')
const isEditing = shallowRef(false)
const predictionTeams = computed(() =>
  matchTeams.value?.homeTeam && matchTeams.value.awayTeam ? [matchTeams.value.homeTeam, matchTeams.value.awayTeam] : [],
)

async function removePrediction() {
  if (match.value && canSubmitPrediction.value) {
    await deletePrediction(match.value.id)
    savedMessage.value = ''
    isEditing.value = false
  }
}

async function savePrediction(prediction: Parameters<typeof upsertLocalPrediction>[0]) {
  if (!canSubmitPrediction.value) {
    return
  }

  await upsertLocalPrediction(prediction)
  savedMessage.value = 'Typ zapisany.'
  isEditing.value = false
}
</script>

<template>
  <section v-if="isLoading && !hasLoaded" class="missing panel">
    <BackLink to="/matches" label="Wróć do meczów" />
    <h1>Pobieram mecz...</h1>
  </section>

  <section v-else-if="errorMessage" class="missing panel">
    <BackLink to="/matches" label="Wróć do meczów" />
    <h1>Nie udało się pobrać danych</h1>
    <p>{{ errorMessage }}</p>
    <NuxtLink class="button-secondary" to="/matches">Wróć do listy</NuxtLink>
  </section>

  <section v-else-if="match && stage" class="match-detail">
    <BackLink to="/matches" label="Wróć do meczów" />

    <MatchCard
      v-if="!isEditing"
      :match="match"
      :match-events="currentMatchEvents"
      :home-team="matchTeams?.homeTeam"
      :away-team="matchTeams?.awayTeam"
      :stage="stage"
      :prediction="existingPrediction"
      :first-scorer="getPlayer(existingPrediction?.firstScorerPlayerId ?? null)"
      :pending="canShowPending"
      :locked-label="lockedLabel"
    />

    <p v-if="savedMessage" class="save-toast" role="status">{{ savedMessage }}</p>

    <button v-if="canSubmitPrediction && existingPrediction && !isEditing" class="button-primary edit-btn" @click="isEditing = true">
      Edytuj typ
    </button>

    <PredictionForm
      v-if="canSubmitPrediction && (!existingPrediction || isEditing)"
      :match="match"
      :league-id="league.id"
      :user-id="activeUserId"
      :players="matchPlayers"
      :teams="predictionTeams"
      :existing-prediction="existingPrediction"
      @save="savePrediction"
      @remove="removePrediction"
    />

    <p v-else-if="predictionUnavailableMessage" class="missing panel">
      {{ predictionUnavailableMessage }}
    </p>
  </section>

  <section v-else class="missing panel">
    <BackLink to="/matches" label="Wróć do meczów" />
    <h1>Nie znaleziono meczu</h1>
    <NuxtLink class="button-secondary" to="/matches">Wróć do listy</NuxtLink>
  </section>
</template>

<style scoped>
.match-detail {
  display: grid;
  gap: 16px;
}

.missing {
  display: grid;
  gap: 14px;
  padding: 18px;
}

.missing h1,
.missing p {
  margin: 0;
}

.missing h1 {
  font-size: 24px;
}

.missing p {
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 800;
}

.edit-btn {
  width: 100%;
}

.save-toast {
  margin: 0;
  border: 1px solid #bcd9c2;
  border-radius: 8px;
  background: #edf8ef;
  padding: 12px 14px;
  color: var(--app-primary-dark);
  font-size: 14px;
  font-weight: 900;
}
</style>
