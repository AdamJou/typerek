<script setup lang="ts">
import { ChevronDown, ListChecks, MessageSquareText, UserRound } from 'lucide-vue-next'
import type { BonusPrediction, MatchPrediction } from '~/types/domain'
import { compareMatchesChronologically } from '~/utils/footballUi'
import { isBonusLocked } from '~/utils/bonus'
import { canRevealMatchPredictions } from '~/utils/scoring'

const route = useRoute()
const {
  bonusQuestions,
  errorMessage,
  hasLoaded,
  isLoading,
  league,
  matchEvents,
  matches,
  members,
  players,
  predictions,
  ranking,
  stages,
  teams,
} = useTyperekData()
const { getMatchTeams, getPlayer } = useTeamLookup(teams, players)

const participantId = computed(() => String(route.params.userId ?? ''))
const participant = computed(() => members.find((member) => member.userId === participantId.value) ?? null)
const participantRankingRow = computed(() => ranking.value.find((row) => row.userId === participantId.value) ?? null)
const participantPosition = computed(() => participantRankingRow.value?.position ?? null)
const activeView = computed<'predictions' | 'answers'>(() => (route.query.view === 'answers' ? 'answers' : 'predictions'))
const activeStageId = shallowRef('all')
const revealedPredictions = shallowRef<MatchPrediction[]>([])
const revealedBonusPredictions = shallowRef<BonusPrediction[]>([])
const predictionsLoading = shallowRef(false)
const bonusLoading = shallowRef(false)
const predictionsError = shallowRef('')
const bonusError = shallowRef('')
const now = shallowRef(new Date())
let predictionsRequestId = 0
let bonusRequestId = 0
let visibilityTimer: ReturnType<typeof setInterval> | null = null

const participantPredictionByMatchId = computed(() => {
  const byMatchId = new Map<string, MatchPrediction>()

  for (const prediction of [...predictions.value, ...revealedPredictions.value]) {
    if (prediction.userId === participantId.value) {
      byMatchId.set(prediction.matchId, prediction)
    }
  }

  return byMatchId
})

const orderedStages = computed(() => [...stages].sort((left, right) => left.sortOrder - right.sortOrder))
const participantMatchRows = computed(() =>
  matches
    .filter((match) => canRevealMatchPredictions(match, now.value))
    .sort((left, right) => compareMatchesChronologically(right, left))
    .flatMap((match) => {
      const stage = stageFor(match.stageId)

      if (!stage) {
        return []
      }

      const matchTeams = getMatchTeams(match)

      return [{
        prediction: participantPredictionByMatchId.value.get(match.id),
        match,
        stage,
        matchEvents: matchEventsFor(match.id),
        homeTeam: matchTeams.homeTeam,
        awayTeam: matchTeams.awayTeam,
        firstScorer: getPlayer(participantPredictionByMatchId.value.get(match.id)?.firstScorerPlayerId ?? null),
      }]
    }),
)
const filteredParticipantMatchRows = computed(() =>
  activeStageId.value === 'all'
    ? participantMatchRows.value
    : participantMatchRows.value.filter((row) => row.match.stageId === activeStageId.value),
)
const predictionPlaceholderLabel = computed(() => {
  if (predictionsLoading.value) {
    return 'Pobieram typ...'
  }

  if (predictionsError.value) {
    return 'Typ niedostępny'
  }

  return 'Brak typu'
})

const revealedBonusQuestions = computed(() =>
  bonusQuestions.filter((question) => isBonusLocked(question.deadlineAt, now.value)),
)

const revealedMatchIds = computed(() =>
  matches.filter((match) => canRevealMatchPredictions(match, now.value)).map((match) => match.id),
)
const revealedMatchIdsKey = computed(() => revealedMatchIds.value.join(','))
const revealedBonusQuestionIdsKey = computed(() =>
  revealedBonusQuestions.value.map((question) => question.id).join(','),
)

function matchFor(matchId: string) {
  return matches.find((match) => match.id === matchId)
}

function stageFor(stageId: string) {
  return stages.find((stage) => stage.id === stageId)
}

function matchEventsFor(matchId: string) {
  return matchEvents.filter((event) => event.matchId === matchId)
}

async function loadPredictions() {
  const requestId = ++predictionsRequestId

  if (!hasLoaded.value || !league.id || !participant.value) {
    revealedPredictions.value = []
    predictionsLoading.value = false
    predictionsError.value = ''
    return
  }

  const repository = useTyperekRepository()

  if (!repository) {
    predictionsError.value = 'Brak połączenia z bazą danych.'
    predictionsLoading.value = false
    return
  }

  revealedPredictions.value = []
  predictionsLoading.value = true
  predictionsError.value = ''

  try {
    const result = await repository.listRevealedMatchPredictions(
      league.id,
      participantId.value,
      revealedMatchIds.value,
    )

    if (requestId === predictionsRequestId) {
      revealedPredictions.value = result
    }
  } catch {
    if (requestId === predictionsRequestId) {
      predictionsError.value = 'Nie udało się pobrać typów uczestnika.'
    }
  } finally {
    if (requestId === predictionsRequestId) {
      predictionsLoading.value = false
    }
  }
}

async function loadBonusAnswers() {
  const requestId = ++bonusRequestId

  if (activeView.value !== 'answers' || !hasLoaded.value || !participant.value) {
    revealedBonusPredictions.value = []
    bonusLoading.value = false
    bonusError.value = ''
    return
  }

  const repository = useTyperekRepository()

  if (!repository) {
    bonusError.value = 'Brak połączenia z bazą danych.'
    bonusLoading.value = false
    return
  }

  revealedBonusPredictions.value = []
  bonusLoading.value = true
  bonusError.value = ''

  try {
    const result = await repository.listRevealedBonusPredictions(
      revealedBonusQuestions.value.map((question) => question.id),
      participantId.value,
    )

    if (requestId === bonusRequestId) {
      revealedBonusPredictions.value = result
    }
  } catch {
    if (requestId === bonusRequestId) {
      bonusError.value = 'Nie udało się pobrać odpowiedzi uczestnika.'
    }
  } finally {
    if (requestId === bonusRequestId) {
      bonusLoading.value = false
    }
  }
}

watch([participantId, () => league.id, hasLoaded, revealedMatchIdsKey], loadPredictions, { immediate: true })
watch([activeView, participantId, hasLoaded, revealedBonusQuestionIdsKey], loadBonusAnswers, { immediate: true })

if (import.meta.client) {
  visibilityTimer = setInterval(() => {
    now.value = new Date()
  }, 30_000)
}

onBeforeUnmount(() => {
  if (visibilityTimer) {
    clearInterval(visibilityTimer)
  }
})
</script>

<template>
  <section class="participant-page">
    <BackLink to="/rankings" label="Wróć do rankingu" />

    <p v-if="isLoading && !hasLoaded" class="state-panel panel">Pobieram uczestnika...</p>
    <p v-else-if="errorMessage" class="state-panel panel">{{ errorMessage }}</p>

    <template v-else-if="participant">
      <header class="participant-hero">
        <div class="participant-hero-main">
          <div class="participant-icon" aria-hidden="true">
            <UserRound :size="28" />
          </div>
          <div class="participant-hero-copy">
            <span>Uczestnik ligi</span>
            <h1>{{ participant.displayName }}</h1>
            <p>Publiczne typy są widoczne dopiero po rozpoczęciu meczu.</p>
          </div>
        </div>

        <div class="participant-rank">
          <span>Pozycja w lidze</span>
          <strong>#{{ participantPosition ?? '-' }}</strong>
          <small>{{ participantRankingRow?.totalPoints ?? 0 }} pkt</small>
        </div>
      </header>

      <nav class="participant-tabs" aria-label="Dane uczestnika">
        <NuxtLink
          class="tab-button"
          :class="{ active: activeView === 'predictions' }"
          :to="`/participants/${participant.userId}`"
        >
          <ListChecks :size="18" aria-hidden="true" />
          Typy meczów
        </NuxtLink>
        <NuxtLink
          class="tab-button"
          :class="{ active: activeView === 'answers' }"
          :to="{ path: `/participants/${participant.userId}`, query: { view: 'answers' } }"
        >
          <MessageSquareText :size="18" aria-hidden="true" />
          Odpowiedzi na pytania
        </NuxtLink>
      </nav>

      <section v-if="activeView === 'predictions'" class="prediction-section">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Historia typów</span>
            <h2>Najnowsze mecze</h2>
          </div>
          <label class="stage-filter">
            <span>Faza</span>
            <span class="select-shell">
              <select v-model="activeStageId">
                <option value="all">Wszystkie fazy</option>
                <option v-for="stage in orderedStages" :key="stage.id" :value="stage.id">
                  {{ stage.name }}
                </option>
              </select>
              <ChevronDown :size="16" aria-hidden="true" />
            </span>
          </label>
        </div>

        <p v-if="predictionsLoading" class="state-panel panel">Pobieram typy uczestnika...</p>
        <p v-else-if="predictionsError" class="state-panel panel">{{ predictionsError }}</p>

        <p v-if="!filteredParticipantMatchRows.length" class="state-panel panel">
          Brak rozpoczętych meczów w wybranej fazie.
        </p>

        <div v-else class="match-list">
          <MatchCard
            v-for="row in filteredParticipantMatchRows"
            :key="row.match.id"
            :match="row.match"
            :match-events="row.matchEvents"
            :home-team="row.homeTeam"
            :away-team="row.awayTeam"
            :stage="row.stage"
            :prediction="row.prediction"
            :players="players"
            :first-scorer="row.firstScorer"
            prediction-label="Typ gracza"
            :prediction-placeholder="predictionPlaceholderLabel"
          />
        </div>
      </section>

      <ParticipantBonusAnswers
        v-else
        :participant-name="participant.displayName"
        :questions="revealedBonusQuestions"
        :predictions="revealedBonusPredictions"
        :teams="teams"
        :players="players"
        :stages="stages"
        :loading="bonusLoading"
        :error-message="bonusError"
      />
    </template>

    <section v-else-if="hasLoaded" class="missing panel">
      <h1>Nie znaleziono uczestnika</h1>
      <p>Ten gracz nie należy do Twojej ligi.</p>
      <NuxtLink class="button-secondary" to="/rankings">Wróć do rankingu</NuxtLink>
    </section>
  </section>
</template>

<style scoped>
.participant-page,
.prediction-section,
.match-list {
  display: grid;
  gap: 16px;
}

.participant-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(12, 107, 70, 0.96), rgba(20, 33, 27, 0.96));
  padding: 22px;
  color: white;
}

.participant-hero-main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 16px;
}

.participant-icon {
  display: inline-flex;
  flex: 0 0 54px;
  width: 54px;
  height: 54px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
}

.participant-hero-copy {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.participant-hero span,
.eyebrow {
  color: rgba(255, 255, 255, 0.72);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}

.participant-hero h1,
.participant-hero p,
.section-heading h2,
.missing h1,
.missing p {
  margin: 0;
}

.participant-hero h1 {
  font-size: clamp(30px, 7vw, 46px);
  line-height: 1;
}

.participant-hero p {
  color: rgba(255, 255, 255, 0.78);
  font-size: 14px;
  font-weight: 700;
}

.participant-rank {
  display: grid;
  min-width: 116px;
  justify-items: end;
  gap: 3px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  padding: 12px 14px;
}

.participant-rank strong {
  font-size: 30px;
  line-height: 1;
}

.participant-rank small {
  color: rgba(255, 255, 255, 0.76);
  font-size: 12px;
  font-weight: 850;
}

.participant-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.tab-button {
  display: inline-flex;
  min-height: 46px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: white;
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 900;
}

.tab-button.active,
.tab-button:hover,
.tab-button:focus-visible {
  border-color: var(--app-primary);
  background: #edf5ef;
  color: var(--app-primary-dark);
}

.section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
}

.section-heading > div {
  display: grid;
  gap: 4px;
}

.section-heading .eyebrow {
  color: var(--app-muted);
}

.section-heading h2 {
  font-size: 26px;
}

.stage-filter {
  display: grid;
  min-width: 260px;
  gap: 6px;
}

.stage-filter > span:first-child {
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}

.select-shell {
  position: relative;
  display: flex;
  height: 42px;
  min-width: 0;
  align-items: center;
  overflow: hidden;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: linear-gradient(180deg, #ffffff, #f8fbf7);
  color: var(--app-ink);
}

.select-shell:focus-within {
  border-color: var(--app-primary);
  box-shadow: 0 0 0 3px rgba(12, 107, 70, 0.12);
}

.select-shell select {
  width: 100%;
  min-width: 0;
  height: 100%;
  appearance: none;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--app-ink);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 900;
  padding: 0 34px 0 12px;
}

.select-shell svg {
  position: absolute;
  right: 10px;
  color: var(--app-primary-dark);
  pointer-events: none;
}

.state-panel {
  margin: 0;
  padding: 14px;
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 800;
}

.missing {
  display: grid;
  gap: 12px;
  padding: 18px;
}

.missing p {
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 700;
}

@media (min-width: 820px) {
  .match-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 620px) {
  .participant-hero,
  .section-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .participant-rank {
    justify-items: start;
  }

  .participant-tabs {
    grid-template-columns: 1fr;
  }

  .stage-filter {
    min-width: 0;
  }
}
</style>
