<script setup lang="ts">
import { Save } from 'lucide-vue-next'
import type { Match, TournamentStage } from '~/types/domain'
import type { BulkPredictionDraft } from '~/components/Predictions/BulkPredictionEditor.vue'
import type { MatchesListMode } from '~/composables/useMatchesListState'
import { compareMatchesChronologically, isMatchToday, isUpcomingMatch } from '~/utils/footballUi'
import { currentPredictionStageId, isMatchPredictionOpen, isPredictionLocked, isStagePredictionOpen } from '~/utils/scoring'

type MatchViewMode = MatchesListMode

const { currentUserId, errorMessage, hasLeague, hasLoaded, isLoading, league, matchEvents, matches, members, players, predictionPresence, predictions, stages, teams, upsertPrediction } =
  useTyperekData()
const { getMatchTeams, getPlayer, getPlayersForMatch } = useTeamLookup(teams, players)
const { predictionMembersFor } = usePredictionParticipants(members, predictionPresence, predictions)
const currentMember = computed(() => members.find((member) => member.userId === currentUserId.value))

const activeMode = shallowRef<MatchViewMode>('upcoming')
const activeStageId = shallowRef('')
const { saveMatchesListState } = useMatchesListState(activeMode, activeStageId, hasLoaded)
const showUpcomingPending = shallowRef(true)
const showUpcomingPredicted = shallowRef(true)
const bulkDrafts = reactive<Record<string, BulkPredictionDraft>>({})
const bulkValidationMessages = reactive<Record<string, string | null>>({})
const bulkSavedMessage = shallowRef('')
const bulkErrorMessage = shallowRef('')
const isSavingBulk = shallowRef(false)

const currentStageId = computed(() => currentPredictionStageId(stages, matches) ?? stages[0]?.id ?? '')
const stageTabs = computed(() => {
  if (activeMode.value === 'all') {
    return stages
  }

  return stages.filter((stage) => stage.id === currentStageId.value)
})
const sortedMatches = computed(() => [...matches].sort(compareMatchesChronologically))
const upcomingMatches = computed(() => sortedMatches.value.filter((match) => isUpcomingMatch(match)))
const upcomingPendingMatches = computed(() => upcomingMatches.value.filter((match) => needsPrediction(match)))
const upcomingPredictedMatches = computed(() => upcomingMatches.value.filter((match) => ownPredictionFor(match.id)))
const upcomingUnavailableMatches = computed(() =>
  upcomingMatches.value.filter((match) => !needsPrediction(match) && !ownPredictionFor(match.id)),
)
const upcomingSections = computed(() =>
  [
    { id: 'pending', label: 'Do otypowania', countLabel: `${upcomingPendingMatches.value.length} do typu`, matches: upcomingPendingMatches.value },
    { id: 'predicted', label: 'Otypowane', countLabel: `${upcomingPredictedMatches.value.length} otypowane`, matches: upcomingPredictedMatches.value },
    { id: 'unavailable', label: 'Niedostępne', countLabel: `${upcomingUnavailableMatches.value.length} poza typowaniem`, matches: upcomingUnavailableMatches.value },
  ].filter((section) => section.id !== 'unavailable' || section.matches.length > 0),
)
const hasUpcomingStatusFilter = computed(() => showUpcomingPending.value || showUpcomingPredicted.value)
const visibleUpcomingSections = computed(() =>
  upcomingSections.value.filter((section) => {
    if (section.id === 'pending') {
      return showUpcomingPending.value
    }

    if (section.id === 'predicted') {
      return showUpcomingPredicted.value
    }

    return showUpcomingPending.value && showUpcomingPredicted.value
  }),
)
const pendingMatches = computed(() => sortedMatches.value.filter((match) => needsPrediction(match)))
const bulkMatches = computed(() =>
  sortedMatches.value.filter((match) => match.stageId === currentStageId.value && needsPrediction(match)),
)
const modeMatches = computed(() => (activeMode.value === 'pending' || activeMode.value === 'bulk' ? pendingMatches.value : sortedMatches.value))
const visibleMatches = computed(() =>
  activeStageId.value ? modeMatches.value.filter((match) => match.stageId === activeStageId.value) : modeMatches.value,
)
const matchGroups = computed(() =>
  stages
    .map((stage) => ({
      stage,
      matches: visibleMatches.value.filter((match) => match.stageId === stage.id),
      pendingCount: visibleMatches.value.filter((match) => match.stageId === stage.id && needsPrediction(match)).length,
      predictedCount: visibleMatches.value.filter((match) => match.stageId === stage.id && ownPredictionFor(match.id)).length,
    }))
    .filter((group) => group.matches.length > 0),
)
const modeTabs = computed(() => [
  { id: 'upcoming' as const, label: 'Najbliższe', count: upcomingMatches.value.length },
  { id: 'pending' as const, label: 'Do typowania', count: pendingMatches.value.length },
  { id: 'all' as const, label: 'Wszystkie', count: matches.length },
  { id: 'bulk' as const, label: 'Typuj całą kolejkę', count: bulkMatches.value.length },
])
const canShowBulkMode = computed(() => bulkMatches.value.length > 0)
const canSaveBulk = computed(
  () =>
    bulkMatches.value.length > 0 &&
    bulkMatches.value.every((match) => {
      const draft = bulkDrafts[match.id]

      return Boolean(draft) && !bulkValidationMessages[match.id]
    }),
)

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

function needsPrediction(match: Match) {
  const teamsForMatch = getMatchTeams(match)

  return (
    Boolean(hasLeague.value && currentUserId.value && teamsForMatch.homeTeam && teamsForMatch.awayTeam) &&
    isMatchPredictionOpen(match, stages, matches) &&
    !ownPredictionFor(match.id)
  )
}

function needsAttention(match: Match) {
  return isMatchToday(match) && needsPrediction(match)
}

function selectMode(mode: MatchViewMode) {
  bulkSavedMessage.value = ''
  bulkErrorMessage.value = ''
  activeMode.value = mode

  if (mode === 'pending' || mode === 'bulk') {
    activeStageId.value = currentStageId.value
  } else if (mode === 'upcoming') {
    activeStageId.value ||= currentStageId.value
  } else if (!activeStageId.value) {
    activeStageId.value = currentStageId.value
  }
}

function groupLabel(stage: TournamentStage) {
  return stage.name || stage.shortName
}

function matchesCountLabel(count: number) {
  if (count === 1) {
    return '1 mecz'
  }

  if (count > 1 && count < 5) {
    return `${count} mecze`
  }

  return `${count} meczów`
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
  saveMatchesListState(matchId)
}

function defaultBulkDraft(): BulkPredictionDraft {
  return {
    predictedHomeScore: 0,
    predictedAwayScore: 0,
    firstScorerPlayerId: null,
    noScorer: false,
  }
}

function predictionTeamsFor(match: Match) {
  const { homeTeam, awayTeam } = getMatchTeams(match)

  return homeTeam && awayTeam ? [homeTeam, awayTeam] : []
}

function setBulkValidation(matchId: string, message: string | null) {
  bulkValidationMessages[matchId] = message
}

async function saveBulkPredictions() {
  if (!canSaveBulk.value || !currentUserId.value || !league.id) {
    return
  }

  isSavingBulk.value = true
  bulkSavedMessage.value = ''
  bulkErrorMessage.value = ''

  try {
    await Promise.all(
      bulkMatches.value.map((match) =>
        upsertPrediction({
          matchId: match.id,
          predictedHomeScore: bulkDrafts[match.id]!.predictedHomeScore,
          predictedAwayScore: bulkDrafts[match.id]!.predictedAwayScore,
          firstScorerPlayerId: bulkDrafts[match.id]!.noScorer ? null : bulkDrafts[match.id]!.firstScorerPlayerId,
          noScorer: bulkDrafts[match.id]!.noScorer,
        }),
      ),
    )

    bulkSavedMessage.value = `Zapisano ${bulkMatches.value.length} typów z kolejki.`
    activeMode.value = 'pending'
  } catch (error) {
    bulkErrorMessage.value = error instanceof Error ? error.message : 'Nie udało się zapisać typów dla całej kolejki.'
  } finally {
    isSavingBulk.value = false
  }
}

watch(
  bulkMatches,
  (nextMatches) => {
    const nextIds = new Set(nextMatches.map((match) => match.id))

    nextMatches.forEach((match) => {
      bulkDrafts[match.id] ??= defaultBulkDraft()
      bulkValidationMessages[match.id] ??= null
    })

    Object.keys(bulkDrafts).forEach((matchId) => {
      if (!nextIds.has(matchId)) {
        delete bulkDrafts[matchId]
      }
    })

    Object.keys(bulkValidationMessages).forEach((matchId) => {
      if (!nextIds.has(matchId)) {
        delete bulkValidationMessages[matchId]
      }
    })

    if (activeMode.value === 'bulk' && nextMatches.length === 0) {
      activeMode.value = 'pending'
    }
  },
  { immediate: true },
)

watch(
  currentStageId,
  (stageId) => {
    if (!stageId) {
      return
    }

    if (!activeStageId.value && activeMode.value !== 'all') {
      activeStageId.value = stageId
    } else if ((activeMode.value === 'pending' || activeMode.value === 'bulk') && activeStageId.value !== stageId) {
      activeStageId.value = stageId
    }
  },
  { immediate: true },
)
</script>

<template>
  <section class="matches-page">
    <BackLink to="/league" label="Wróć do ligi" />

    <div class="page-heading">
      <h1>Mecze</h1>
      <p>Terminarz MŚ 2026 według rund. Najpierw pokazujemy mecze, które czekają na Twój typ.</p>
    </div>

    <p v-if="isLoading && !hasLoaded" class="state-panel panel">Pobieram mecze...</p>
    <p v-else-if="errorMessage" class="state-panel panel">{{ errorMessage }}</p>

    <div v-if="hasLoaded" class="match-toolbar">
      <div class="mode-tabs" role="tablist" aria-label="Widok meczów">
        <button
          v-for="tab in modeTabs"
          v-show="tab.id !== 'bulk' || canShowBulkMode"
          :key="tab.id"
          class="mode-tab"
          :class="{ 'is-active': activeMode === tab.id }"
          type="button"
          role="tab"
          :aria-selected="activeMode === tab.id"
          @click="selectMode(tab.id)"
        >
          <span>{{ tab.label }}</span>
          <strong>{{ tab.count }}</strong>
        </button>
      </div>

      <StageTabs
        v-if="stageTabs.length && (activeMode === 'pending' || activeMode === 'all')"
        :stages="stageTabs"
        :active-stage-id="activeStageId"
        :all-label="activeMode === 'all' ? 'Wszystkie rundy' : undefined"
        @select="activeStageId = $event"
      />
    </div>

    <section v-if="hasLoaded && activeMode === 'upcoming'" class="upcoming-mode">
      <div class="upcoming-summary panel">
        <div>
          <span>Najbliższe mecze</span>
          <h2>Dzisiaj i jutro</h2>
          <p>Nierozpoczęte mecze z najbliższego okna, rozdzielone według Twoich typów.</p>
        </div>
        <div class="upcoming-summary-counts" aria-label="Podsumowanie najbliższych meczów">
          <strong>{{ upcomingPendingMatches.length }} do typu</strong>
          <span>{{ upcomingPredictedMatches.length }} otypowane</span>
        </div>
      </div>

      <div v-if="upcomingMatches.length > 0" class="upcoming-filters panel" aria-label="Filtry najbliższych meczów">
        <span>Pokazuj</span>
        <label class="upcoming-filter" :class="{ 'is-active': showUpcomingPending }">
          <input v-model="showUpcomingPending" type="checkbox">
          <span>Do otypowania</span>
          <strong>{{ upcomingPendingMatches.length }}</strong>
        </label>
        <label class="upcoming-filter" :class="{ 'is-active': showUpcomingPredicted }">
          <input v-model="showUpcomingPredicted" type="checkbox">
          <span>Otypowane</span>
          <strong>{{ upcomingPredictedMatches.length }}</strong>
        </label>
      </div>

      <p v-if="upcomingMatches.length === 0" class="state-panel panel">Brak nierozpoczętych meczów na dziś i jutro.</p>

      <p v-else-if="!hasUpcomingStatusFilter" class="state-panel panel">Wybierz co najmniej jeden filtr najbliższych meczów.</p>

      <div v-else class="upcoming-sections">
        <section v-for="section in visibleUpcomingSections" :key="section.id" class="upcoming-section">
          <div class="match-group-heading">
            <div>
              <span>Najbliższe</span>
              <h2>{{ section.label }}</h2>
            </div>
            <div class="match-group-counts">
              <strong>{{ section.countLabel }}</strong>
            </div>
          </div>

          <p v-if="section.matches.length === 0" class="state-panel panel">
            {{ section.id === 'pending' ? 'Nie masz meczów do otypowania w tym oknie.' : 'Nie masz jeszcze otypowanych meczów w tym oknie.' }}
          </p>

          <div v-else class="match-list">
            <MatchCard
              v-for="match in section.matches"
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
      </div>
    </section>

    <section v-if="hasLoaded && activeMode === 'bulk'" class="bulk-mode">
      <div class="bulk-hero panel">
        <div>
          <span>Typowanie zbiorcze</span>
          <h2>Typuj całą kolejkę na raz</h2>
          <p>Uwzględniamy tylko mecze z aktywnej kolejki, które nadal czekają na Twój typ.</p>
        </div>
        <strong>{{ bulkMatches.length }} meczów</strong>
      </div>

      <p v-if="bulkSavedMessage" class="save-toast" role="status">{{ bulkSavedMessage }}</p>
      <p v-if="bulkErrorMessage" class="error-toast" role="alert">{{ bulkErrorMessage }}</p>

      <p v-if="bulkMatches.length === 0" class="state-panel panel">Nie masz teraz nieotypowanych meczów w aktywnej kolejce.</p>

      <div v-else class="bulk-match-list">
        <article v-for="match in bulkMatches" :key="match.id" class="bulk-match-item">
          <MatchCard
            :match="match"
            :match-events="matchEventsFor(match.id)"
            :home-team="getMatchTeams(match).homeTeam"
            :away-team="getMatchTeams(match).awayTeam"
            :stage="stageFor(match.stageId)!"
            :current-member="currentMember"
            :match-predictions="predictionsFor(match.id)"
            :players="players"
            :pending="true"
            :locked-label="lockedLabel(match)"
            :predicted-members="predictionMembersFor(match.id)"
          />

          <BulkPredictionEditor
            :draft="bulkDrafts[match.id] ?? defaultBulkDraft()"
            :match="match"
            :players="getPlayersForMatch(match)"
            :teams="predictionTeamsFor(match)"
            @update:draft="bulkDrafts[match.id] = $event"
            @validity="setBulkValidation(match.id, $event)"
          />
        </article>
      </div>

      <div v-if="bulkMatches.length" class="bulk-submit-bar panel">
        <div>
          <strong>Zapisz typy dla całej kolejki</strong>
          <p>Mecze już otypowane są pominięte automatycznie.</p>
        </div>
        <button class="button-primary bulk-save-button" type="button" :disabled="!canSaveBulk || isSavingBulk" @click="saveBulkPredictions">
          <Save :size="18" aria-hidden="true" />
          {{ isSavingBulk ? 'Zapisuję...' : `Zapisz ${bulkMatches.length} typów` }}
        </button>
      </div>
    </section>

    <p v-if="hasLoaded && activeMode !== 'bulk' && activeMode !== 'upcoming' && visibleMatches.length === 0" class="state-panel panel">
      {{
        activeMode === 'pending'
          ? 'Nie masz teraz meczów do typowania w aktywnej kolejce.'
          : 'Brak meczów w wybranej rundzie.'
      }}
    </p>

    <div v-else-if="hasLoaded && activeMode !== 'bulk' && activeMode !== 'upcoming'" class="match-groups">
      <section v-for="group in matchGroups" :key="group.stage.id" class="match-group">
        <div class="match-group-heading">
          <div>
            <span>{{ group.stage.shortName }}</span>
            <h2>{{ groupLabel(group.stage) }}</h2>
          </div>
          <div class="match-group-counts" aria-label="Podsumowanie rundy">
            <span>{{ matchesCountLabel(group.matches.length) }}</span>
            <strong v-if="group.pendingCount">{{ group.pendingCount }} do typu</strong>
            <strong v-else-if="group.predictedCount">{{ group.predictedCount }} otypowane</strong>
          </div>
        </div>

        <div class="match-list">
          <MatchCard
            v-for="match in group.matches"
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
    </div>
  </section>
</template>

<style scoped>
.matches-page,
.page-heading,
.match-toolbar,
.upcoming-mode,
.upcoming-sections,
.upcoming-section,
.bulk-mode,
.bulk-match-list,
.bulk-match-item,
.match-groups,
.match-group,
.match-list {
  display: grid;
  gap: 16px;
}

.page-heading h1,
.page-heading p,
.upcoming-summary h2,
.upcoming-summary p,
.match-group-heading h2 {
  margin: 0;
}

.page-heading h1 {
  font-size: clamp(32px, 8vw, 48px);
  line-height: 1;
}

.page-heading p {
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.45;
}

.state-panel {
  margin: 0;
  padding: 14px;
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 800;
}

.upcoming-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
}

.upcoming-summary div:first-child {
  display: grid;
  gap: 5px;
}

.upcoming-summary span:first-child {
  color: var(--app-primary);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}

.upcoming-summary h2 {
  font-size: 24px;
  line-height: 1.05;
}

.upcoming-summary p {
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 750;
  line-height: 1.35;
}

.upcoming-summary-counts {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  min-width: 180px;
}

.upcoming-summary-counts span,
.upcoming-summary-counts strong {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  border-radius: 7px;
  padding: 0 10px;
  background: #f3f6f1;
  color: var(--app-primary-dark);
  font-size: 12px;
  font-weight: 950;
  white-space: nowrap;
}

.upcoming-summary-counts strong {
  background: #fff2cf;
  color: #765813;
}

.upcoming-section {
  gap: 12px;
}

.upcoming-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px;
}

.upcoming-filters > span {
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 950;
  text-transform: uppercase;
}

.upcoming-filter {
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--app-line);
  border-radius: 7px;
  background: white;
  padding: 0 10px;
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    color 160ms ease;
}

.upcoming-filter input {
  width: 16px;
  height: 16px;
  accent-color: var(--app-primary);
}

.upcoming-filter strong {
  display: inline-flex;
  min-width: 24px;
  min-height: 22px;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  background: #eef4ef;
  color: var(--app-primary-dark);
  font-size: 12px;
}

.upcoming-filter.is-active {
  border-color: rgba(12, 107, 70, 0.4);
  background: #edf5ef;
  color: var(--app-primary-dark);
}

.bulk-hero,
.bulk-submit-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
}

.bulk-hero div,
.bulk-submit-bar div {
  display: grid;
  gap: 4px;
}

.bulk-hero h2,
.bulk-hero p,
.bulk-submit-bar p {
  margin: 0;
}

.bulk-hero span {
  color: var(--app-primary);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}

.bulk-hero h2 {
  font-size: 24px;
  line-height: 1.05;
}

.bulk-hero p,
.bulk-submit-bar p {
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 750;
}

.bulk-hero strong {
  display: inline-flex;
  min-width: 88px;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #eef4ef;
  color: var(--app-primary-dark);
  font-size: 14px;
  font-weight: 950;
}

.bulk-match-item {
  gap: 12px;
}

.bulk-submit-bar {
  position: sticky;
  bottom: 57px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 40px rgba(18, 35, 27, 0.12);
  backdrop-filter: blur(10px);
}

.bulk-submit-bar strong {
  font-size: 16px;
  font-weight: 950;
}

.bulk-save-button {
  min-width: 220px;
  min-height: 52px;
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

.error-toast {
  margin: 0;
  border: 1px solid #e6b8b0;
  border-radius: 8px;
  background: #fff1ef;
  padding: 12px 14px;
  color: var(--app-danger);
  font-size: 14px;
  font-weight: 900;
}

.mode-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.mode-tab {
  display: flex;
  min-width: max-content;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: white;
  padding: 0 12px;
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 900;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    color 160ms ease;
}

.mode-tab strong {
  display: inline-flex;
  min-width: 28px;
  min-height: 24px;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  background: #eef4ef;
  color: var(--app-primary-dark);
  font-size: 12px;
}

.mode-tab.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary);
  color: white;
}

.mode-tab.is-active strong {
  background: rgba(255, 255, 255, 0.18);
  color: white;
}

.match-group {
  gap: 12px;
}

.match-group-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 14px;
  border-bottom: 1px solid rgba(223, 230, 221, 0.8);
  padding-bottom: 10px;
}

.match-group-heading span {
  color: var(--app-primary);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}

.match-group-heading h2 {
  font-size: 20px;
  line-height: 1.1;
}

.match-group-counts {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 900;
}

.match-group-counts span,
.match-group-counts strong {
  display: inline-flex;
  min-height: 26px;
  align-items: center;
  border-radius: 7px;
  padding: 0 9px;
  background: #f3f6f1;
  white-space: nowrap;
}

.match-group-counts strong {
  background: #fff2cf;
  color: #765813;
}

@media (min-width: 820px) {
  .match-toolbar {
    gap: 12px;
  }

  .mode-tabs {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    width: min(720px, 100%);
  }

  .match-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .bulk-hero,
  .upcoming-summary,
  .bulk-submit-bar,
  .match-group-heading {
    display: grid;
    align-items: start;
  }

  .bulk-save-button {
    width: 100%;
    min-width: 0;
  }

  .match-group-counts {
    justify-content: flex-start;
  }

  .upcoming-summary-counts {
    justify-content: flex-start;
    min-width: 0;
  }
}
</style>
