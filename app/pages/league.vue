<script setup lang="ts">
import { BarChart3, CalendarClock, CalendarDays, CircleAlert, CircleHelp, Clock3, Medal, TicketCheck, Users, ChevronRight } from 'lucide-vue-next'
import type { Match } from '~/types/domain'
import { isMatchToday, isUpcomingMatchToday, isUpcomingMatchWithinHours } from '~/utils/footballUi'
import { filledBonusCount, isBonusAnswerFilled, isBonusLocked, resolveBonusGlobalLockAt, resolveBonusQuestion } from '~/utils/bonus'
import { defaultScoringRules, isMatchPredictionOpen, isPredictionLocked, isStagePredictionOpen } from '~/utils/scoring'

const { bonusPredictions, bonusQuestions, currentStageRanking, currentUserId, errorMessage, hasLeague, hasLoaded, isLoading, league, matchEvents, matches, members, players, predictionPresence, predictions, stages, teams, tournament } =
  useTyperekData()
const { getMatchTeams, getPlayer } = useTeamLookup(teams, players)
const { predictionMembersFor } = usePredictionParticipants(members, predictionPresence, predictions)
const currentMember = computed(() => members.find((member) => member.userId === currentUserId.value))
const { saveLeagueMatchReturnState } = useLeagueMatchReturnState(hasLoaded)
const { showUpcomingTodayOnly } = useUpcomingMatchesPreferences()
const now = shallowRef(new Date())
const advancementRulesOpen = shallowRef(false)

const scoringItems = [
  { points: String(defaultScoringRules.exactScoreBonus), label: 'dokładny wynik' },
  { points: String(defaultScoringRules.resultPoints), label: 'rezultat W/D/L' },
  { points: String(defaultScoringRules.firstScorerPoints), label: 'strzelec gola' },
  { points: String(defaultScoringRules.firstScorerBonusPoints), label: 'bonus za pierwszą bramkę' },
  { points: '1/2', label: 'awans w fazie pucharowej', hasDetails: true },
]

const nextMatches = computed(() =>
  [...matches]
    .filter((match) => (showUpcomingTodayOnly.value ? isUpcomingMatchToday(match, now.value) : isUpcomingMatchWithinHours(match, 24, now.value)))
    .sort((a, b) => new Date(a.startsAtUtc).getTime() - new Date(b.startsAtUtc).getTime())
)
const nextMatchesPendingCount = computed(() => nextMatches.value.filter((match) => needsPrediction(match)).length)
const nextMatchesWindowLabel = computed(() => (showUpcomingTodayOnly.value ? 'dziś' : '24h'))
const nextMatchesEmptyMessage = computed(() =>
  showUpcomingTodayOnly.value ? 'Brak nierozpoczętych meczów na dziś.' : 'Brak nierozpoczętych meczów w ciągu 24 godzin.',
)

const playedMatchesCount = computed(
  () =>
    matches.filter(
      (match) =>
        (match.status === 'confirmed' || Boolean(match.resultConfirmedAt)) &&
        match.homeScore90 !== null &&
        match.awayScore90 !== null,
    ).length,
)

const latestResultConfirmedAt = computed(() => {
  const timestamps = matches
    .map((match) => match.resultConfirmedAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite)

  if (timestamps.length === 0) {
    return null
  }

  return new Date(Math.max(...timestamps))
})

const latestResultUpdateLabel = computed(() => {
  if (!latestResultConfirmedAt.value) {
    return 'Brak potwierdzonych wyników'
  }

  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
  }).format(latestResultConfirmedAt.value)
})

const resolvedBonusQuestions = computed(() => bonusQuestions.map((question) => resolveBonusQuestion(question)))
const bonusPredictionByQuestionId = computed(() => {
  const map = new Map<string, (typeof bonusPredictions.value)[number]>()

  for (const prediction of bonusPredictions.value) {
    if (prediction.userId === currentUserId.value) {
      map.set(prediction.questionId, prediction)
    }
  }

  return map
})

const bonusAnsweredCount = computed(() =>
  filledBonusCount(
    resolvedBonusQuestions.value,
    resolvedBonusQuestions.value.map((question) => ({
      id: question.id,
      questionId: question.id,
      userId: currentUserId.value ?? '',
      answerJson: bonusPredictionByQuestionId.value.get(question.id)?.answerJson ?? null,
      updatedAt: '',
    })),
  ),
)

const bonusTotalCount = computed(() => resolvedBonusQuestions.value.length)
const bonusLockAt = computed(() => resolveBonusGlobalLockAt(matches, teams, tournament))
const bonusLocked = computed(() => isBonusLocked(bonusLockAt.value, now.value))
const bonusDirty = computed(() =>
  resolvedBonusQuestions.value.some((question) => !isBonusAnswerFilled(question, bonusPredictionByQuestionId.value.get(question.id)?.answerJson ?? null)),
)
const bonusRemainingLabel = computed(() => {
  if (!bonusLockAt.value || bonusLocked.value) {
    return ''
  }

  const diffMs = new Date(bonusLockAt.value).getTime() - now.value.getTime()

  if (diffMs <= 0) {
    return ''
  }

  const totalMinutes = Math.floor(diffMs / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) {
    return `${days} d ${hours} h`
  }

  if (hours > 0) {
    return `${hours} h ${minutes} min`
  }

  return `${minutes} min`
})

const bonusCardState = computed(() => {
  if (bonusTotalCount.value === 0) {
    return 'Brak pytań'
  }

  if (bonusLocked.value) {
    return 'Zamknięte'
  }

  if (bonusDirty.value) {
    return 'Wymaga akcji'
  }

  return 'Gotowe'
})

let timerHandle: ReturnType<typeof setInterval> | null = null

if (import.meta.client) {
  timerHandle = setInterval(() => {
    now.value = new Date()
  }, 1000 * 30)
}

onBeforeUnmount(() => {
  if (timerHandle) {
    clearInterval(timerHandle)
  }
})

function stageFor(matchStageId: string) {
  return stages.find((candidate) => candidate.id === matchStageId)
}

function ownPredictionFor(matchId: string) {
  return predictions.value.find((prediction) => prediction.matchId === matchId && prediction.userId === currentUserId.value)
}

function predictionsFor(matchId: string) {
  return predictions.value.filter((prediction) => prediction.matchId === matchId)
}

function matchEventsFor(matchId: string) {
  return matchEvents.filter((event) => event.matchId === matchId)
}

function needsAttention(match: Match) {
  return isMatchToday(match) && needsPrediction(match)
}

function needsPrediction(match: Match) {
  const teamsForMatch = getMatchTeams(match)

  return (
    Boolean(hasLeague.value && currentUserId.value && teamsForMatch.homeTeam && teamsForMatch.awayTeam) &&
    isMatchPredictionOpen(match, stages, matches) &&
    !ownPredictionFor(match.id)
  )
}

function lockedLabel(match: Match) {
  if (ownPredictionFor(match.id) || match.status !== 'scheduled' || isPredictionLocked(match)) {
    return null
  }

  if (!isStagePredictionOpen(match.stageId, stages, matches)) {
    return 'Czeka na poprzednią kolejkę'
  }

  return null
}

function actionLabelFor(match: Match) {
  if (!ownPredictionFor(match.id)) {
    return undefined
  }

  return isMatchPredictionOpen(match, stages, matches) ? 'Zmień typ' : 'Zobacz typ'
}

function saveReturnPoint(matchId: string) {
  saveLeagueMatchReturnState(matchId)
}

function bonusCardMessage() {
  if (bonusTotalCount.value === 0) {
    return 'Pytania bonusowe nie zostały jeszcze dodane do ligi.'
  }

  if (bonusLocked.value) {
    return ''
  }

  if (bonusDirty.value) {
    return 'Masz jeszcze nieuzupełnione pytania. Kliknij i dokończ typy.'
  }

  return ''
}
</script>

<template>
  <section class="league-page">
    <div class="league-hero">
      <div class="league-hero-copy">
        <div v-if="hasLeague" class="league-hero-topline">
          <div class="results-updated-chip">
            <CalendarClock :size="15" aria-hidden="true" />
            <span>Wyniki zaktualizowane: {{ latestResultUpdateLabel }}</span>
          </div>
        </div>

        <h1>{{ hasLeague ? league.name : 'Dołącz do ligi' }}</h1>

        <div v-if="hasLeague" class="hero-copy-stack">
          <p class="subheading">
            Prywatna liga MŚ 2026.
          </p>

        </div>

        <p v-else>
          Wpisz kod zaproszenia od organizatora, żeby odblokować typowanie i ranking znajomych.
        </p>

        <NuxtLink v-if="!hasLeague" class="league-join-link" to="/join">
          <TicketCheck :size="18" aria-hidden="true" />
          Dołącz do ligi
        </NuxtLink>
      </div>

      <div v-if="hasLeague" class="hero-rules">
        <div class="hero-rules-heading">
          <span>Zasady punktacji za 1 mecz</span>
        </div>

        <div class="scoring-summary" aria-label="Punktacja za jeden mecz">
          <article v-for="item in scoringItems" :key="item.label" class="scoring-item">
            <button
              v-if="item.hasDetails"
              class="scoring-help-button"
              type="button"
              aria-label="Wyjaśnij punktację za awans"
              aria-haspopup="dialog"
              @click="advancementRulesOpen = true"
            >
              <CircleHelp :size="18" aria-hidden="true" />
            </button>
            <strong>{{ item.points }}</strong>
            <span>{{ item.label }}</span>
          </article>
          <article class="scoring-item scoring-total">
            <strong>10/12</strong>
            <span>maks. grupa / faza pucharowa</span>
          </article>
        </div>
      </div>

      <div class="league-hero-side">
        <div class="league-hero-emblem" aria-hidden="true">
          <img class="league-hero-logo" src="/wc26.png" alt="" width="100" height="100">
        </div>
      </div>
    </div>

    <p v-if="isLoading && !hasLoaded" class="state-panel panel">Pobieram dane ligi...</p>
    <p v-else-if="errorMessage" class="state-panel panel">{{ errorMessage }}</p>

    <div v-if="hasLeague" class="summary-grid">
      <article v-if="hasLeague" class="summary-tile summary-tile-basic panel">
        <div class="summary-tile-icon" aria-hidden="true">
          <Users :size="22" />
        </div>
        <strong>{{ members.length }}</strong>
        <span>uczestników</span>
      </article>
      <article class="summary-tile summary-tile-basic panel">
        <div class="summary-tile-icon" aria-hidden="true">
          <CalendarDays :size="22" />
        </div>
        <strong>{{ playedMatchesCount }}/{{ matches.length }}</strong>
        <span>rozegrane mecze</span>
      </article>
      <article v-if="hasLeague" class="summary-tile summary-tile-basic panel">
        <div class="summary-tile-icon" aria-hidden="true">
          <Medal :size="22" />
        </div>
        <strong>{{ currentStageRanking[0]?.displayName ?? '-' }}</strong>
        <span>lider etapu</span>
      </article>
      <NuxtLink
        v-if="hasLeague"
        to="/statistics"
        class="summary-tile summary-tile-basic summary-tile-link panel"
      >
        <div class="summary-tile-icon" aria-hidden="true">
          <BarChart3 :size="22" />
        </div>
        <strong>Analizy ligi</strong>
        <span>statystyki typów</span>
      </NuxtLink>
      <NuxtLink
        v-if="hasLeague"
        to="/bonus"
        class="summary-tile summary-tile-bonus panel"
        :class="{ 'needs-action': !bonusLocked && bonusDirty, locked: bonusLocked }"
      >
        <div class="summary-tile-topline">
          <div class="summary-tile-icon" aria-hidden="true">
            <Clock3 v-if="!bonusLocked" :size="22" />
            <CircleAlert v-else :size="22" />
          </div>
          <strong>{{ bonusQuestions.length }}</strong>
        </div>
        <p class="summary-tile-copy">{{ bonusCardMessage() }}</p>
        <div class="summary-tile-meta">
          <strong>{{ bonusAnsweredCount }}/{{ bonusTotalCount }}</strong>
          <span v-if="bonusRemainingLabel" class="summary-tile-timer">{{ bonusRemainingLabel }}</span>
          <span v-else-if="bonusLocked" class="summary-tile-timer">Termin minął</span>
          <span v-else class="summary-tile-timer">Do terminu</span>
        </div>
        <span>pytania bonusowe</span>
      </NuxtLink>
    </div>

    <section v-if="false && hasLeague" class="section-block">
      <div class="section-heading">
        <h2>Pytania bonusowe</h2>
        <NuxtLink to="/bonus" class="cta-button">Otwórz</NuxtLink>
      </div>

      <NuxtLink
        to="/bonus"
        class="bonus-cta panel"
        :class="{ 'needs-action': !bonusLocked && bonusDirty, locked: bonusLocked }"
      >
        <div class="bonus-cta-icon" aria-hidden="true">
          <Clock3 v-if="!bonusLocked" :size="22" />
          <CircleAlert v-else :size="22" />
        </div>

        <div class="bonus-cta-copy">
          <strong>{{ bonusAnsweredCount }}/{{ bonusTotalCount }}</strong>
          <span>Pytania bonusowe</span>
          <p>{{ bonusCardMessage() }}</p>
        </div>

        <div class="bonus-cta-side">
          <strong>{{ bonusCardState }}</strong>
          <span v-if="bonusRemainingLabel">{{ bonusRemainingLabel }}</span>
          <span v-else-if="bonusLocked">Termin minął</span>
          <span v-else>Do terminu</span>
        </div>
      </NuxtLink>
    </section>

    <section v-if="hasLeague" class="section-block">
      <div class="section-heading">
        <div class="section-heading-title">
          <h2>Najbliższe mecze</h2>
          <span class="pending-matches-time">{{ nextMatchesWindowLabel }}</span>
          <span v-if="nextMatchesPendingCount > 0" class="pending-matches-badge">
            {{ nextMatchesPendingCount }} nieotypowanych
          </span>
        </div>
        <div class="section-heading-actions">
          <label class="dashboard-filter" :class="{ 'is-active': showUpcomingTodayOnly }">
            <input v-model="showUpcomingTodayOnly" type="checkbox">
            <span>Tylko dzisiaj</span>
          </label>
          <NuxtLink to="/matches" class="cta-button">Wszystkie
            <ChevronRight :size="16" aria-hidden="true" />
          </NuxtLink>
        </div>
      </div>

      <p v-if="nextMatches.length === 0" class="state-panel panel">{{ nextMatchesEmptyMessage }}</p>

      <div v-else class="match-list">
        <MatchCard
          v-for="match in nextMatches"
          :key="match.id"
          :data-match-id="match.id"
          :match="match"
          :match-events="matchEventsFor(match.id)"
          :home-team="getMatchTeams(match).homeTeam"
          :away-team="getMatchTeams(match).awayTeam"
          :stage="stageFor(match.stageId)!"
          :to="`/matches/${match.id}`"
          :prediction="ownPredictionFor(match.id)"
          :match-predictions="predictionsFor(match.id)"
          :current-member="currentMember"
          :players="players"
          :first-scorer="getPlayer(ownPredictionFor(match.id)?.firstScorerPlayerId ?? null)"
          :attention="needsAttention(match)"
          :pending="needsPrediction(match)"
          :locked-label="lockedLabel(match)"
          :predicted-members="predictionMembersFor(match.id)"
          :action-label-override="actionLabelFor(match)"
          @click.capture="saveReturnPoint(match.id)"
        />
      </div>
    </section>

    <section v-if="hasLeague" class="section-block">
      <div class="section-heading">
        <h2>Ranking</h2>
        <NuxtLink to="/rankings" class="cta-button">Szczegóły
             <ChevronRight :size="16" aria-hidden="true" />
        </NuxtLink>
      </div>
      <RankingPodium :rows="currentStageRanking" />
    </section>

    <ResultsPreview
      v-if="hasLeague"
      :matches="matches"
      :teams="teams"
      :players="players"
    />

    <AdvancementScoringModal v-if="advancementRulesOpen" @close="advancementRulesOpen = false" />
  </section>
</template>

<style scoped>
.league-page,
.section-block,
.match-list {
  display: grid;
  gap: 18px;
}

.league-hero {
  display: grid;
  gap: 18px;
  align-items: start;
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(12, 107, 70, 0.95), rgba(20, 33, 27, 0.95)),
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.08) 0 1px, transparent 1px 88px);
  color: white;
  overflow: hidden;
  padding: 24px;
}

.league-hero-copy,
.hero-copy-stack,
.hero-rules {
  display: grid;
  gap: 14px;
}

.league-hero-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  height: 100%;
}

.league-hero h1,
.league-hero p,
.section-heading h2 {
  margin: 0;
}

.league-hero-topline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.hero-kicker {
  color: rgba(255, 255, 255, 0.72);
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.league-hero h1 {
  max-width: 760px;
  font-size: clamp(36px, 10vw, 64px);
  line-height: 0.98;
}

.league-hero p {
  max-width: 620px;
  color: rgba(255, 255, 255, 0.78);
  font-size: 15px;
  font-weight: 700;
  line-height: 1.5;
}

.results-updated-chip {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  padding: 0 12px;
  color: rgba(255, 255, 255, 0.92);
  font-size: 12px;
  font-weight: 850;
}

.hero-rules {
  width: 100%;
  min-width: 0;
}

.hero-rules-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.hero-rules-heading span {
  color: rgba(255, 255, 255, 0.72);
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero-rules-heading strong {
  color: #fff2cf;
  font-size: 14px;
  font-weight: 950;
}

.scoring-summary {
  display: grid;
  grid-template-columns: repeat(6, minmax(132px, 1fr));
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-color: rgba(255, 255, 255, 0.28) transparent;
  scrollbar-width: thin;
}

.scoring-item {
  position: relative;
  display: grid;
  gap: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.1);
  padding: 12px;
  min-height: 104px;
  align-content: space-between;
}

.scoring-help-button {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.scoring-help-button:hover {
  background: rgba(255, 255, 255, 0.2);
}

.scoring-help-button:focus-visible {
  outline: 3px solid rgba(255, 242, 207, 0.38);
  outline-offset: 2px;
}

.scoring-item strong {
  color: white;
  font-size: 22px;
  font-weight: 950;
  line-height: 1;
}

.scoring-item span {
  color: rgba(255, 255, 255, 0.82);
  font-size: 12px;
  font-weight: 800;
  line-height: 1.25;
}

.scoring-item.scoring-total {
  background: rgba(255, 242, 207, 0.16);
  border-color: rgba(255, 242, 207, 0.3);
}

.scoring-item.scoring-total strong,
.scoring-item.scoring-total span {
  color: #fff2cf;
}

.league-join-link {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 7px;
  background: white;
  margin-top: auto;
  padding: 0 14px;
  color: var(--app-primary-dark);
  font-size: 14px;
  font-weight: 900;
}

.league-hero-side {
  display: flex;
  justify-content: flex-end;
}

.league-hero-emblem {
  display: grid;
  width: clamp(112px, 14vw, 148px);
  aspect-ratio: 1;
  place-items: center;
  border: 1px solid rgba(255, 226, 158, 0.28);
  border-radius: 18px;
  background: white;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 18px 38px rgba(4, 20, 13, 0.24);
}

.league-hero-logo {
  display: block;
  width: min(82%, 120px);
  height: auto;
  filter: drop-shadow(0 10px 14px rgba(0, 0, 0, 0.24));
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.summary-tile {
  display: grid;
  gap: 8px;
  min-height: 120px;
  padding: 14px;
}

.summary-tile-basic {
  grid-template-rows: 38px minmax(0, 1fr) auto;
  align-items: start;
}

.summary-tile-basic > strong {
  align-self: center;
}

.summary-tile-topline,
.summary-tile-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.summary-tile-topline {
  min-width: 0;
}

.summary-tile-icon {
  display: inline-flex;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  background: #eef6f0;
  color: var(--app-primary-dark);
  flex: 0 0 auto;
}

.summary-tile svg {
  color: var(--app-primary);
}

.summary-tile strong {
  min-width: 0;
  overflow: hidden;
  font-size: 22px;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-tile span {
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}

.summary-tile-copy {
  margin: 0;
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.45;
}

.summary-tile-bonus {
  color: inherit;
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.summary-tile-link {
  color: inherit;
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.summary-tile-link:hover,
.summary-tile-link:focus-visible {
  transform: translateY(-1px);
  border-color: rgba(12, 107, 70, 0.35);
}

.summary-tile-bonus:hover {
  transform: translateY(-1px);
}

.summary-tile-bonus.needs-action {
  border-color: rgba(255, 193, 7, 0.45);
  background: rgba(255, 193, 7, 0.08);
  animation: bonusBounce 2.4s ease-in-out infinite;
}

.summary-tile-bonus.locked {
  border-color: rgba(32, 43, 36, 0.14);
}

.summary-tile-meta strong {
  font-size: 14px;
  font-weight: 950;
  white-space: nowrap;
}

.summary-tile-timer {
  color: var(--app-primary-dark);
  font-size: 12px;
  font-weight: 900;
  text-transform: none;
  white-space: nowrap;
}

.bonus-cta {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 16px;
  color: inherit;
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.bonus-cta:hover {
  transform: translateY(-1px);
}

.bonus-cta.needs-action {
  border-color: rgba(255, 0, 0, 0.4);
  box-shadow: 0 0 0 1px rgba(255, 0, 0, 0.12);
  animation: bonusBounce 2.4s ease-in-out infinite;
}

.bonus-cta.locked {
  border-color: rgba(32, 43, 36, 0.14);
}

.bonus-cta-icon {
  display: inline-flex;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: #eef6f0;
  color: var(--app-primary-dark);
}

.bonus-cta-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.bonus-cta-copy strong {
  font-size: 28px;
  line-height: 1;
}

.bonus-cta-copy span {
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}

.bonus-cta-copy p,
.bonus-cta-side span {
  margin: 0;
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.45;
}

.bonus-cta-side {
  display: grid;
  justify-items: end;
  gap: 4px;
}

.bonus-cta-side strong {
  font-size: 14px;
  font-weight: 950;
}

@keyframes bonusBounce {
  0%,
  12%,
  24%,
  100% {
    transform: translateY(0);
    box-shadow: 0 0 0 0 rgba(255, 193, 7, 0.0);
  }
  6% {
    transform: translateY(-7px);
    box-shadow: 0 8px 16px rgba(20, 33, 27, 0.12);
  }
  18% {
    transform: translateY(-3px);
    box-shadow: 0 0 0 6px rgba(255, 193, 7, 0.08);
  }
}

@media (prefers-reduced-motion: reduce) {
  .summary-tile-bonus.needs-action,
  .bonus-cta.needs-action {
    animation: none;
  }
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.section-heading-title {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.section-heading-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.section-heading h2 {
  font-size: 22px;
}

.pending-matches-time {
  display: inline-flex;
  min-height: 24px;
  align-items: center;
  border-radius: 999px;
  background: white;
  padding: 2px 9px;
  color: var(--app-primary);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}

.pending-matches-badge {
  display: inline-flex;
  min-height: 24px;
  align-items: center;
  border-radius: 999px;
  background: #fff0ed;
  padding: 0 9px;
  color: var(--app-danger);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}

.dashboard-filter {
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  gap: 7px;
  border: 1px solid rgba(20, 33, 27, 0.14);
  border-radius: 7px;
  background: white;
  padding: 0 11px;
  color: var(--app-muted);
  cursor: pointer;
  font-size: 13px;
  font-weight: 900;
  white-space: nowrap;
}

.dashboard-filter input {
  width: 14px;
  height: 14px;
  accent-color: var(--app-primary);
}

.dashboard-filter.is-active {
  border-color: var(--app-primary);
  background: #edf7f2;
  color: var(--app-primary);
}

.section-heading a {
  color: var(--app-primary);
  font-size: 14px;
  font-weight: 900;
}

.state-panel {
  margin: 0;
  padding: 14px;
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 800;
}

.cta-button {
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--app-primary);
  border-radius: 7px;
  padding: 0 12px;
  color: var(--app-primary);
  font-size: 14px;
  font-weight: 900;
}

.cta-button:hover {
  background: var(--app-primary);
  color: white;
}

@media (min-width: 820px) {
  .league-hero {
    grid-template-columns: minmax(0, 1fr) auto;
    min-height: 340px;
    padding: 36px;
  }

  .hero-rules {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .league-hero-copy {
    grid-column: 1;
    grid-row: 1;
  }

  .league-hero-side {
    grid-column: 2;
    grid-row: 1;
  }

  .summary-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .match-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .section-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .section-heading-actions {
    width: 100%;
    justify-content: space-between;
  }

  .dashboard-filter {
    flex: 1 1 auto;
    justify-content: center;
  }

  .league-hero-topline,
  .hero-rules-heading {
    align-items: start;
    flex-direction: column;
  }

  .results-updated-chip {
    width: 100%;
    justify-content: center;
  }

  .summary-tile-meta {
    align-items: start;
    flex-direction: column;
  }

  .bonus-cta {
    grid-template-columns: 1fr;
  }

  .bonus-cta-side {
    justify-items: start;
  }
}
</style>
