<script setup lang="ts">
import type { MatchPrediction } from '~/types/domain'
import { displayTeamName, formatPlayerDisplayName } from '~/utils/footballUi'
import { aggregateRanking, canRevealMatchPredictions, isMatchPredictionOpen, isPredictionLocked, isStagePredictionOpen, shouldUseGeneralRankingTieBreakers } from '~/utils/scoring'

const route = useRoute()
const detailBackLink = useMatchDetailReturnLink()
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
  members,
  players,
  predictionPresence,
  predictions,
  rankingBreakdowns,
  stages,
  teams,
  upsertLocalPrediction,
} = useTyperekData()
const { getMatchTeams, getPlayer, getPlayersForMatch } = useTeamLookup(teams, players)
const { predictionMembersFor } = usePredictionParticipants(members, predictionPresence, predictions)
const currentMember = computed(() => members.find((member) => member.userId === currentUserId.value))
const match = computed(() => matches.find((candidate) => candidate.id === route.params.id))
const currentMatchEvents = computed(() => (match.value ? matchEvents.filter((event) => event.matchId === match.value?.id) : []))
const matchTeams = computed(() => (match.value ? getMatchTeams(match.value) : null))
const matchPlayers = computed(() => (match.value ? getPlayersForMatch(match.value) : []))
const stage = computed(() => stages.find((candidate) => candidate.id === match.value?.stageId))
const savedMessage = shallowRef('')
const now = shallowRef(Date.now())
const revealedMatchPredictions = shallowRef<MatchPrediction[]>([])
const revealedMatchPredictionsLoading = shallowRef(false)
const revealedMatchPredictionsError = shallowRef('')
let revealedMatchPredictionsRequestId = 0
let unlockTimer: ReturnType<typeof setTimeout> | null = null
const existingPrediction = computed(() =>
  predictions.value.find((prediction) => prediction.matchId === match.value?.id && prediction.userId === currentUserId.value),
)
const currentMatchPredictions = computed(() =>
  predictions.value.filter((prediction) => prediction.matchId === match.value?.id),
)
const availableMatchPredictions = computed(() => {
  const byUserId = new Map<string, MatchPrediction>()

  for (const prediction of currentMatchPredictions.value) {
    byUserId.set(prediction.userId, prediction)
  }

  for (const prediction of revealedMatchPredictions.value) {
    byUserId.set(prediction.userId, prediction)
  }

  return [...byUserId.values()]
})
const detailPredictionMembers = computed(() => {
  if (!match.value) {
    return []
  }

  const result = [...predictionMembersFor(match.value.id)]
  const member = currentMember.value

  if (existingPrediction.value && member && !result.some((candidate) => candidate.userId === member.userId)) {
    result.push(member)
  }

  return result
})
const availablePredictionByUserId = computed(() => new Map(availableMatchPredictions.value.map((prediction) => [prediction.userId, prediction])))
const canRevealCurrentMatchPredictions = computed(() => (match.value ? canRevealMatchPredictions(match.value, new Date(now.value)) : false))
const stagePositionByUserId = computed(() => {
  if (!match.value) {
    return new Map<string, number>()
  }

  return new Map(
    aggregateRanking(rankingBreakdowns.value, members, match.value.stageId, {
      useGeneralTieBreakers: shouldUseGeneralRankingTieBreakers(stage.value),
    }).map((row) => [row.userId, row.position]),
  )
})
const predictionSummaryRows = computed(() => {
  if (!canRevealCurrentMatchPredictions.value) {
    return []
  }

  return detailPredictionMembers.value.flatMap((member) => {
    const prediction = availablePredictionByUserId.value.get(member.userId)

    if (!prediction) {
      return []
    }

    return [
      {
        member,
        prediction,
        scorerName: scorerNameForPrediction(prediction),
        predictedAdvancedTeamName: predictedAdvancedTeamNameFor(prediction),
        predictedAdvancedTeamSide: predictedAdvancedTeamSideFor(prediction),
        stagePosition: stagePositionByUserId.value.get(member.userId) ?? null,
      },
    ]
  })
})
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

function scorerNameForPrediction(prediction: MatchPrediction) {
  if (prediction.noScorer) {
    return 'Brak strzelca'
  }

  const player = getPlayer(prediction.firstScorerPlayerId)

  return player ? formatPlayerDisplayName(player.name) : 'Strzelec wybrany'
}

function predictedAdvancedTeamNameFor(prediction: MatchPrediction) {
  if (!match.value || prediction.predictedHomeScore !== prediction.predictedAwayScore) {
    return null
  }

  if (prediction.predictedAdvancedTeamId === match.value.homeTeamId) {
    return displayTeamName(matchTeams.value?.homeTeam, match.value.homePlaceholder ?? 'Do ustalenia')
  }

  if (prediction.predictedAdvancedTeamId === match.value.awayTeamId) {
    return displayTeamName(matchTeams.value?.awayTeam, match.value.awayPlaceholder ?? 'Do ustalenia')
  }

  return null
}

function predictedAdvancedTeamSideFor(prediction: MatchPrediction): 'home' | 'away' | null {
  if (!match.value || prediction.predictedHomeScore !== prediction.predictedAwayScore) {
    return null
  }

  if (prediction.predictedAdvancedTeamId === match.value.homeTeamId) {
    return 'home'
  }

  if (prediction.predictedAdvancedTeamId === match.value.awayTeamId) {
    return 'away'
  }

  return null
}

function schedulePredictionUnlock() {
  if (!match.value) {
    return
  }

  const delay = new Date(match.value.startsAtUtc).getTime() - Date.now()

  if (delay <= 0) {
    now.value = Date.now()
    return
  }

  unlockTimer = setTimeout(() => {
    now.value = Date.now()
    schedulePredictionUnlock()
  }, Math.min(delay + 100, 2_147_483_647))
}

async function loadRevealedMatchPredictions() {
  if (!match.value || !league.id || !canRevealCurrentMatchPredictions.value || detailPredictionMembers.value.length === 0) {
    return
  }

  const hasMissingPredictions = detailPredictionMembers.value.some((member) => !availablePredictionByUserId.value.has(member.userId))

  if (!hasMissingPredictions) {
    return
  }

  const requestId = ++revealedMatchPredictionsRequestId

  revealedMatchPredictionsLoading.value = true
  revealedMatchPredictionsError.value = ''

  try {
    const repository = useTyperekRepository()

    if (!repository) {
      throw new Error('Brak połączenia z bazą danych.')
    }

    const matchId = match.value.id
    const fetchedPredictions = await repository.listRevealedMatchPredictionsForMatch(league.id, matchId)

    if (requestId !== revealedMatchPredictionsRequestId || match.value?.id !== matchId) {
      return
    }

    revealedMatchPredictions.value = fetchedPredictions
  } catch {
    if (requestId !== revealedMatchPredictionsRequestId) {
      return
    }

    revealedMatchPredictionsError.value = 'Nie udało się pobrać typów graczy.'
  } finally {
    if (requestId === revealedMatchPredictionsRequestId) {
      revealedMatchPredictionsLoading.value = false
    }
  }
}

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

watch(
  [
    canRevealCurrentMatchPredictions,
    () => match.value?.id ?? '',
    () => league.id,
    () => currentMatchPredictions.value.length,
    () => detailPredictionMembers.value.map((member) => member.userId).join('|'),
  ],
  () => {
    void loadRevealedMatchPredictions()
  },
)

watch(
  () => match.value?.id ?? '',
  () => {
    revealedMatchPredictionsRequestId += 1
    revealedMatchPredictions.value = []
    revealedMatchPredictionsError.value = ''
    revealedMatchPredictionsLoading.value = false

    if (unlockTimer) {
      clearTimeout(unlockTimer)
      unlockTimer = null
    }

    schedulePredictionUnlock()
    void loadRevealedMatchPredictions()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  revealedMatchPredictionsRequestId += 1

  if (unlockTimer) {
    clearTimeout(unlockTimer)
  }
})
</script>

<template>
  <section v-if="isLoading && !hasLoaded" class="missing panel">
    <BackLink :to="detailBackLink.to" :label="detailBackLink.label" />
    <h1>Pobieram mecz...</h1>
  </section>

  <section v-else-if="errorMessage" class="missing panel">
    <BackLink :to="detailBackLink.to" :label="detailBackLink.label" />
    <h1>Nie udało się pobrać danych</h1>
    <p>{{ errorMessage }}</p>
    <NuxtLink class="button-secondary" :to="detailBackLink.to">{{ detailBackLink.label }}</NuxtLink>
  </section>

  <section v-else-if="match && stage" class="match-detail">
    <BackLink :to="detailBackLink.to" :label="detailBackLink.label" />

    <MatchCard
      v-if="!isEditing"
      :match="match"
      :match-events="currentMatchEvents"
      :home-team="matchTeams?.homeTeam"
      :away-team="matchTeams?.awayTeam"
      :stage="stage"
      :prediction="existingPrediction"
      :match-predictions="availableMatchPredictions"
      :current-member="currentMember"
      :players="players"
      :first-scorer="getPlayer(existingPrediction?.firstScorerPlayerId ?? null)"
      :pending="canShowPending"
      :locked-label="lockedLabel"
      :predicted-members="detailPredictionMembers"
    />

    <PredictionSummaryTable
      v-if="canRevealCurrentMatchPredictions && (predictionSummaryRows.length || revealedMatchPredictionsLoading)"
      :rows="predictionSummaryRows"
      :loading="revealedMatchPredictionsLoading"
    />

    <p v-else-if="canRevealCurrentMatchPredictions && revealedMatchPredictionsError" class="prediction-summary-error">
      {{ revealedMatchPredictionsError }}
    </p>

    <p v-if="savedMessage" class="save-toast" role="status">{{ savedMessage }}</p>

    <button v-if="canSubmitPrediction && existingPrediction && !isEditing" class="button-primary edit-btn" @click="isEditing = true">
      Edytuj typ
    </button>

    <PredictionForm
      v-if="canSubmitPrediction && (!existingPrediction || isEditing)"
      :match="match"
      :stage="stage"
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
    <BackLink :to="detailBackLink.to" :label="detailBackLink.label" />
    <h1>Nie znaleziono meczu</h1>
    <NuxtLink class="button-secondary" :to="detailBackLink.to">{{ detailBackLink.label }}</NuxtLink>
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

.prediction-summary-error {
  margin: 0;
  border: 1px solid #e6b8b0;
  border-radius: 8px;
  background: #fff1ef;
  padding: 12px 14px;
  color: var(--app-danger);
  font-size: 13px;
  font-weight: 850;
}
</style>
