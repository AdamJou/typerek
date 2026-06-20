<script setup lang="ts">
import { Check, ChevronDown, RotateCcw, Search, Star, X } from 'lucide-vue-next'
import type {
  LeagueMember,
  Match,
  MatchEvent,
  MatchPrediction,
  Player,
  RankingRow,
  ScoreBreakdown,
  Team,
  TournamentStage,
} from '~/types/domain'
import type { PlayerNameParts } from '~/utils/footballUi'
import { displayTeamName, formatPlayerNameParts, getTeamFlag, predictionScoreLabel } from '~/utils/footballUi'
import { defaultScoringRules } from '~/utils/scoring'

type PredictionResultState = 'exact' | 'outcome' | 'miss' | 'empty'
type ScorerState = 'hit' | 'miss' | 'empty'

interface ResultGoalRow {
  event: MatchEvent
  name: PlayerNameParts
  isOwnGoal: boolean
  isFirst: boolean
}

interface ResultPlayerRow {
  member: LeagueMember
  prediction: MatchPrediction | null
  breakdown: ScoreBreakdown | null
  scoreState: PredictionResultState
  scorerState: ScorerState
  scorerName: PlayerNameParts | null
  scorerFirstBonus: boolean
}

interface ResultMatchRow {
  match: Match
  homeTeam: Team | undefined
  awayTeam: Team | undefined
  homeGoalEvents: ResultGoalRow[]
  awayGoalEvents: ResultGoalRow[]
  playerRows: ResultPlayerRow[]
}

interface ResultStageGroup {
  stage: TournamentStage
  matches: ResultMatchRow[]
}

interface FilterOption {
  value: string
  label: string
}

const props = defineProps<{
  matches: readonly Match[]
  stages: readonly TournamentStage[]
  teams: readonly Team[]
  members: readonly LeagueMember[]
  players: readonly Player[]
  predictions: readonly MatchPrediction[]
  scoreBreakdowns: readonly ScoreBreakdown[]
  matchEvents: readonly MatchEvent[]
  ranking: readonly RankingRow[]
  defaultStageId?: string
  hideHeading?: boolean
}>()

const activeStageId = shallowRef('')
const activeRoundLabel = shallowRef('')
const activeTeamId = shallowRef('')
const searchQuery = shallowRef('')
const expandedMatchIds = shallowRef<Set<string>>(new Set())

const teamsById = computed(() => new Map(props.teams.map((team) => [team.id, team])))
const playersById = computed(() => new Map(props.players.map((player) => [player.id, player])))
const rankingOrderByUserId = computed(() => new Map(props.ranking.map((row, index) => [row.userId, index])))
const orderedStages = computed(() => [...props.stages].sort((left, right) => left.sortOrder - right.sortOrder))
const resolvedDefaultStageId = computed(() => {
  if (props.defaultStageId && props.stages.some((stage) => stage.id === props.defaultStageId)) {
    return props.defaultStageId
  }

  return orderedStages.value[0]?.id ?? ''
})
const orderedMembers = computed(() =>
  [...props.members].sort((left, right) => {
    const leftOrder = rankingOrderByUserId.value.get(left.userId) ?? Number.MAX_SAFE_INTEGER
    const rightOrder = rankingOrderByUserId.value.get(right.userId) ?? Number.MAX_SAFE_INTEGER

    return leftOrder - rightOrder || left.displayName.localeCompare(right.displayName, 'pl')
  }),
)
const confirmedMatches = computed(() =>
  props.matches
    .filter((match) => isConfirmedResult(match))
    .sort((left, right) => {
      const timeDelta = matchSortTime(right) - matchSortTime(left)

      if (timeDelta !== 0) {
        return timeDelta
      }

      return (right.matchNumber ?? 0) - (left.matchNumber ?? 0)
    }),
)
const resultGroups = computed<ResultStageGroup[]>(() =>
  [...props.stages]
    .sort((left, right) => right.sortOrder - left.sortOrder)
    .map((stage) => ({
      stage,
      matches: confirmedMatches.value.filter((match) => match.stageId === stage.id).map((match) => buildMatchRow(match)),
    }))
    .filter((group) => group.matches.length > 0),
)
const hasResults = computed(() => resultGroups.value.length > 0)
const stageOptions = computed<FilterOption[]>(() =>
  orderedStages.value.map((stage) => ({
    value: stage.id,
    label: stage.name,
  })),
)
const roundOptions = computed<FilterOption[]>(() => {
  const seen = new Set<string>()
  const sourceGroups = activeStageId.value ? resultGroups.value.filter((group) => group.stage.id === activeStageId.value) : resultGroups.value

  return sourceGroups
    .flatMap((group) => group.matches.map((row) => roundFilterLabel(row.match, group.stage)))
    .filter((label) => {
      if (seen.has(label)) {
        return false
      }

      seen.add(label)
      return true
    })
    .map((label) => ({ value: label, label }))
})
const teamOptions = computed<FilterOption[]>(() => {
  const teamIds = new Set<string>()

  confirmedMatches.value.forEach((match) => {
    if (match.homeTeamId) {
      teamIds.add(match.homeTeamId)
    }

    if (match.awayTeamId) {
      teamIds.add(match.awayTeamId)
    }
  })

  return [...teamIds]
    .map((teamId) => teamsById.value.get(teamId))
    .filter((team): team is Team => Boolean(team))
    .sort((left, right) => displayTeamName(left).localeCompare(displayTeamName(right), 'pl'))
    .map((team) => ({ value: team.id, label: displayTeamName(team) }))
})
const filteredResultGroups = computed<ResultStageGroup[]>(() =>
  resultGroups.value
    .map((group) => ({
      stage: group.stage,
      matches: group.matches.filter((row) => matchPassesFilters(row, group.stage)),
    }))
    .filter((group) => group.matches.length > 0),
)
const filteredMatchRows = computed(() => filteredResultGroups.value.flatMap((group) => group.matches))
const filteredMatchIds = computed(() => filteredMatchRows.value.map((row) => row.match.id))
const hasFilteredResults = computed(() => filteredMatchRows.value.length > 0)
const hasActiveFilters = computed(() =>
  Boolean(
    activeStageId.value !== resolvedDefaultStageId.value ||
      activeRoundLabel.value ||
      activeTeamId.value ||
      searchQuery.value.trim(),
  ),
)
const resultStats = computed(() => {
  const rows = filteredMatchRows.value
  const playerRows = rows.flatMap((row) => row.playerRows)
  const predictedRows = playerRows.filter((row) => row.prediction)
  const averagePoints =
    predictedRows.length > 0
      ? predictedRows.reduce((sum, row) => sum + totalPoints(row), 0) / predictedRows.length
      : 0
  const playerTotals = new Map<string, { displayName: string; points: number }>()

  playerRows.forEach((row) => {
    const current = playerTotals.get(row.member.userId) ?? { displayName: row.member.displayName, points: 0 }
    current.points += totalPoints(row)
    playerTotals.set(row.member.userId, current)
  })

  const bestPlayer = [...playerTotals.values()].sort((left, right) => right.points - left.points || left.displayName.localeCompare(right.displayName, 'pl'))[0]

  return {
    matches: rows.length,
    averagePoints,
    bestPlayer,
  }
})

watch(
  filteredMatchIds,
  (matchIds) => {
    const current = [...expandedMatchIds.value].filter((matchId) => matchIds.includes(matchId))

    if (current.length > 0) {
      expandedMatchIds.value = new Set(current)
      return
    }

    expandedMatchIds.value = matchIds[0] ? new Set([matchIds[0]]) : new Set()
  },
  { immediate: true },
)

const hasInitializedDefaultStage = shallowRef(false)
const previousDefaultStageId = shallowRef('')

watch(
  [resolvedDefaultStageId, stageOptions],
  ([defaultStageId, options]) => {
    const validStageIds = new Set(options.map((option) => option.value))
    const shouldUseDefault =
      !hasInitializedDefaultStage.value ||
      activeStageId.value === previousDefaultStageId.value ||
      Boolean(activeStageId.value && !validStageIds.has(activeStageId.value))

    if (shouldUseDefault) {
      activeStageId.value = validStageIds.has(defaultStageId) ? defaultStageId : ''
    }

    hasInitializedDefaultStage.value = true
    previousDefaultStageId.value = defaultStageId
  },
  { immediate: true },
)

watch(activeStageId, () => {
  if (activeRoundLabel.value && !roundOptions.value.some((option) => option.value === activeRoundLabel.value)) {
    activeRoundLabel.value = ''
  }
})

function buildMatchRow(match: Match): ResultMatchRow {
  const goalEvents = goalEventsForMatch(match.id)
  const firstNormalGoalEventId = goalEvents.find((event) => !isOwnGoal(event) && event.playerId)?.id ?? null
  const goalRows = goalEvents.map((event) => buildGoalRow(event, firstNormalGoalEventId))
  const playerRows = orderedMembers.value
    .map((member) => buildPlayerRow(member, match, goalEvents))
    .sort((left, right) => {
      const pointDelta = totalPoints(right) - totalPoints(left)

      if (pointDelta !== 0) {
        return pointDelta
      }

      const leftOrder = rankingOrderByUserId.value.get(left.member.userId) ?? Number.MAX_SAFE_INTEGER
      const rightOrder = rankingOrderByUserId.value.get(right.member.userId) ?? Number.MAX_SAFE_INTEGER

      return leftOrder - rightOrder || left.member.displayName.localeCompare(right.member.displayName, 'pl')
    })

  return {
    match,
    homeTeam: teamFor(match.homeTeamId),
    awayTeam: teamFor(match.awayTeamId),
    homeGoalEvents: goalRows.filter((goal) => goal.event.teamId === match.homeTeamId),
    awayGoalEvents: goalRows.filter((goal) => goal.event.teamId === match.awayTeamId),
    playerRows,
  }
}

function buildPlayerRow(member: LeagueMember, match: Match, goalEvents: readonly MatchEvent[]): ResultPlayerRow {
  const prediction = predictionFor(member.userId, match.id)
  const breakdown = breakdownFor(member.userId, match.id)
  const firstNormalScorerId = firstNormalScorerIdFor(match, goalEvents)

  return {
    member,
    prediction,
    breakdown,
    scoreState: prediction ? predictionResultState(match, prediction) : 'empty',
    scorerState: prediction ? predictionScorerState(match, prediction, goalEvents) : 'empty',
    scorerName: scorerNameParts(prediction),
    scorerFirstBonus: Boolean(
      prediction &&
        !prediction.noScorer &&
        prediction.firstScorerPlayerId &&
        firstNormalScorerId &&
        prediction.firstScorerPlayerId === firstNormalScorerId,
    ),
  }
}

function isConfirmedResult(match: Match) {
  return (
    (match.status === 'confirmed' || Boolean(match.resultConfirmedAt)) &&
    match.homeScore90 !== null &&
    match.awayScore90 !== null
  )
}

function matchSortTime(match: Match) {
  const timestamp = new Date(match.startsAtUtc).getTime()

  return Number.isFinite(timestamp) ? timestamp : 0
}

function teamFor(teamId: string | null) {
  return teamId ? teamsById.value.get(teamId) : undefined
}

function predictionFor(userId: string, matchId: string) {
  return props.predictions.find((prediction) => prediction.userId === userId && prediction.matchId === matchId) ?? null
}

function breakdownFor(userId: string, matchId: string) {
  return (
    props.scoreBreakdowns.find(
      (breakdown) => breakdown.userId === userId && breakdown.sourceType === 'match' && breakdown.sourceId === matchId,
    ) ?? null
  )
}

function goalEventsForMatch(matchId: string) {
  const events = props.matchEvents
    .filter((event) => event.matchId === matchId && event.eventType === 'goal')
    .sort((left, right) => left.minute - right.minute || left.createdAt.localeCompare(right.createdAt))
  const hasManualOverride = props.matchEvents.some((event) => event.matchId === matchId && event.provider === 'manual')

  return hasManualOverride ? events.filter((event) => event.provider === 'manual') : events
}

function predictionResultState(match: Match, prediction: MatchPrediction): PredictionResultState {
  if (match.homeScore90 === null || match.awayScore90 === null) {
    return 'empty'
  }

  if (prediction.predictedHomeScore === match.homeScore90 && prediction.predictedAwayScore === match.awayScore90) {
    return 'exact'
  }

  return resultSign(prediction.predictedHomeScore, prediction.predictedAwayScore) === resultSign(match.homeScore90, match.awayScore90)
    ? 'outcome'
    : 'miss'
}

function predictionScorerState(match: Match, prediction: MatchPrediction, goalEvents: readonly MatchEvent[]): ScorerState {
  if (match.homeScore90 === null || match.awayScore90 === null) {
    return 'empty'
  }

  const wasGoalless = match.homeScore90 === 0 && match.awayScore90 === 0

  if (prediction.noScorer) {
    return wasGoalless ? 'hit' : 'miss'
  }

  if (!prediction.firstScorerPlayerId) {
    return 'miss'
  }

  const scorerIds = normalGoalScorerIds(goalEvents)

  if (scorerIds.size > 0) {
    return scorerIds.has(prediction.firstScorerPlayerId) ? 'hit' : 'miss'
  }

  return prediction.firstScorerPlayerId === match.firstScorerPlayerId ? 'hit' : 'miss'
}

function scorerNameParts(prediction: MatchPrediction | null): PlayerNameParts | null {
  if (!prediction) {
    return null
  }

  if (prediction.noScorer) {
    return { givenInitial: '', surname: 'Brak strzelca' }
  }

  const playerName = playersById.value.get(prediction.firstScorerPlayerId ?? '')?.name

  return playerName ? formatPlayerNameParts(playerName) : { givenInitial: '', surname: 'Strzelec wybrany' }
}

function resultSign(homeScore: number, awayScore: number) {
  if (homeScore > awayScore) {
    return 'home'
  }

  if (homeScore < awayScore) {
    return 'away'
  }

  return 'draw'
}

function matchTitle(match: Match, homeTeam: Team | undefined, awayTeam: Team | undefined) {
  return `${displayTeamName(homeTeam, match.homePlaceholder ?? 'Do ustalenia')} - ${displayTeamName(awayTeam, match.awayPlaceholder ?? 'Do ustalenia')}`
}

function matchScore(match: Match) {
  return `${match.homeScore90}:${match.awayScore90}`
}

function isOwnGoal(event: MatchEvent) {
  return event.detail === 'manual_own_goal' || event.detail === 'own_goal'
}

function buildGoalRow(event: MatchEvent, firstNormalGoalEventId: string | null): ResultGoalRow {
  const ownGoal = isOwnGoal(event)

  return {
    event,
    name: goalScorerNameParts(event, ownGoal),
    isOwnGoal: ownGoal,
    isFirst: event.id === firstNormalGoalEventId,
  }
}

function goalScorerNameParts(event: MatchEvent, ownGoal: boolean): PlayerNameParts {
  const playerName = event.playerName ?? playersById.value.get(event.playerId ?? '')?.name

  return playerName
    ? formatPlayerNameParts(playerName, ownGoal ? '(sam.)' : undefined)
    : { givenInitial: '', surname: 'Nieznany strzelec', suffix: ownGoal ? '(sam.)' : undefined }
}

function normalGoalScorerIds(goalEvents: readonly MatchEvent[]) {
  return new Set(
    goalEvents
      .filter((event) => !isOwnGoal(event))
      .map((event) => event.playerId)
      .filter((playerId): playerId is string => Boolean(playerId)),
  )
}

function firstNormalScorerIdFor(match: Match, goalEvents: readonly MatchEvent[]) {
  return goalEvents.find((event) => !isOwnGoal(event) && event.playerId)?.playerId ?? match.firstScorerPlayerId
}

function outcomePoints(row: ResultPlayerRow) {
  return row.scoreState === 'exact' || row.scoreState === 'outcome' ? defaultScoringRules.resultPoints : 0
}

function exactScorePoints(row: ResultPlayerRow) {
  return row.scoreState === 'exact' ? defaultScoringRules.exactScoreBonus : 0
}

function scorerPoints(row: ResultPlayerRow) {
  return row.scorerState === 'hit' ? defaultScoringRules.firstScorerPoints : 0
}

function firstScorerBonusPoints(row: ResultPlayerRow) {
  return row.scorerFirstBonus ? defaultScoringRules.firstScorerBonusPoints : 0
}

function totalScorerPoints(row: ResultPlayerRow) {
  return scorerPoints(row) + firstScorerBonusPoints(row)
}

function totalPoints(row: ResultPlayerRow) {
  return outcomePoints(row) + exactScorePoints(row) + totalScorerPoints(row)
}

function scoreLabel(row: ResultPlayerRow) {
  return row.prediction ? predictionScoreLabel(row.prediction) : 'Brak typu'
}

function matchCountLabel(count: number) {
  if (count === 1) {
    return '1 mecz'
  }

  if (count >= 2 && count <= 4) {
    return `${count} mecze`
  }

  return `${count} meczów`
}

function roundFilterLabel(match: Match, stage: TournamentStage) {
  if (match.roundName?.trim()) {
    return match.roundName.trim()
  }

  if (match.groupCode?.trim()) {
    return `Grupa ${match.groupCode.trim()}`
  }

  return stage.shortName
}

function matchBadgeLabel(match: Match, stage: TournamentStage) {
  return match.roundName?.trim() || (match.groupCode?.trim() ? `Grupa ${match.groupCode.trim()}` : stage.shortName)
}

function formatKickoff(startsAtUtc: string) {
  const date = new Date(startsAtUtc)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'Europe/Warsaw',
    weekday: 'short',
  }).format(date)
}

function matchMeta(row: ResultMatchRow) {
  return [formatKickoff(row.match.startsAtUtc), row.match.venue].filter(Boolean).join(' · ')
}

function minuteLabel(goal: ResultGoalRow) {
  return `${goal.event.minute}${goal.event.extraMinute ? `+${goal.event.extraMinute}` : ''}#`
}

function playerNameText(name: PlayerNameParts | null) {
  if (!name) {
    return ''
  }

  return [name.givenInitial, name.surname, name.suffix].filter(Boolean).join(' ')
}

function firstGoal(row: ResultMatchRow) {
  return [...row.homeGoalEvents, ...row.awayGoalEvents].find((goal) => goal.isFirst) ?? null
}

function firstGoalName(row: ResultMatchRow) {
  const goal = firstGoal(row)

  if (goal) {
    return goal.name
  }

  return null
}

function firstGoalFallback(row: ResultMatchRow) {
  if (row.match.noScorerConfirmed) {
    return 'Brak strzelca'
  }

  return 'Nie podano'
}

function hasGoalRows(row: ResultMatchRow) {
  return row.homeGoalEvents.length > 0 || row.awayGoalEvents.length > 0 || row.match.noScorerConfirmed
}

function bestPointsForMatch(row: ResultMatchRow) {
  return Math.max(0, ...row.playerRows.map((playerRow) => totalPoints(playerRow)))
}

function isBestPlayerRow(matchRow: ResultMatchRow, playerRow: ResultPlayerRow) {
  const bestPoints = bestPointsForMatch(matchRow)

  return bestPoints > 0 && totalPoints(playerRow) === bestPoints
}

function isMatchExpanded(matchId: string) {
  return expandedMatchIds.value.has(matchId)
}

function toggleMatch(matchId: string) {
  const next = new Set(expandedMatchIds.value)

  if (next.has(matchId)) {
    next.delete(matchId)
  } else {
    next.add(matchId)
  }

  expandedMatchIds.value = next
}

function clearFilters() {
  activeStageId.value = resolvedDefaultStageId.value
  activeRoundLabel.value = ''
  activeTeamId.value = ''
  searchQuery.value = ''
}

function matchPassesFilters(row: ResultMatchRow, stage: TournamentStage) {
  if (activeStageId.value && stage.id !== activeStageId.value) {
    return false
  }

  if (activeRoundLabel.value && roundFilterLabel(row.match, stage) !== activeRoundLabel.value) {
    return false
  }

  if (activeTeamId.value && row.match.homeTeamId !== activeTeamId.value && row.match.awayTeamId !== activeTeamId.value) {
    return false
  }

  const query = normalizeSearch(searchQuery.value)

  return !query || searchableMatchText(row, stage).includes(query)
}

function searchableMatchText(row: ResultMatchRow, stage: TournamentStage) {
  const predictedScorerNames = row.playerRows
    .map((playerRow) => {
      if (!playerRow.prediction?.firstScorerPlayerId) {
        return playerNameText(playerRow.scorerName)
      }

      return playersById.value.get(playerRow.prediction.firstScorerPlayerId)?.name ?? playerNameText(playerRow.scorerName)
    })
    .filter(Boolean)

  return normalizeSearch(
    [
      row.match.matchNumber ? `mecz ${row.match.matchNumber}` : '',
      matchTitle(row.match, row.homeTeam, row.awayTeam),
      matchScore(row.match),
      roundFilterLabel(row.match, stage),
      stage.name,
      stage.shortName,
      row.match.venue ?? '',
      displayTeamName(row.homeTeam, row.match.homePlaceholder ?? ''),
      displayTeamName(row.awayTeam, row.match.awayPlaceholder ?? ''),
      ...row.homeGoalEvents.map((goal) => `${playerNameText(goal.name)} ${goal.event.playerName ?? ''}`),
      ...row.awayGoalEvents.map((goal) => `${playerNameText(goal.name)} ${goal.event.playerName ?? ''}`),
      ...row.playerRows.map((playerRow) => `${playerRow.member.displayName} ${scoreLabel(playerRow)}`),
      ...predictedScorerNames,
    ].join(' '),
  )
}

function normalizeSearch(value: string) {
  return value
    .toLocaleLowerCase('pl')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
}
</script>

<template>
  <section class="results-section section-block">
    <div v-if="!props.hideHeading" class="section-heading">
      <div>
        <h2>Wyniki</h2>
        <p>Potwierdzone rezultaty, typy graczy i rozpiska punktów.</p>
      </div>
      <span v-if="hasResults" class="results-count">{{ matchCountLabel(confirmedMatches.length) }}</span>
    </div>

    <p v-if="!hasResults" class="empty-results panel">Wyniki pojawią się po wpisaniu rezultatów przez admina.</p>

    <div v-else class="results-content">
      <div class="results-stats">
        <div class="stat-card">
          <span>Mecze</span>
          <strong>{{ resultStats.matches }}</strong>
        </div>
        <div class="stat-card">
          <span>Śr. pkt</span>
          <strong>{{ resultStats.averagePoints.toFixed(1) }}</strong>
        </div>
        <div class="stat-card stat-card-wide">
          <span>Najlepszy w filtrze</span>
          <strong v-if="resultStats.bestPlayer">{{ resultStats.bestPlayer.displayName }} · {{ resultStats.bestPlayer.points }} pkt</strong>
          <strong v-else>Brak</strong>
        </div>
      </div>

      <form class="results-toolbar" @submit.prevent>
        <label class="filter-field">
          <span>Faza</span>
          <span class="select-shell">
            <select v-model="activeStageId">
              <option value="">Wszystkie fazy</option>
              <option v-for="option in stageOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
            <ChevronDown :size="16" aria-hidden="true" />
          </span>
        </label>

        <label class="filter-field">
          <span>Kolejka</span>
          <span class="select-shell">
            <select v-model="activeRoundLabel">
              <option value="">Wszystkie kolejki</option>
              <option v-for="option in roundOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
            <ChevronDown :size="16" aria-hidden="true" />
          </span>
        </label>

        <label class="filter-field">
          <span>Drużyna</span>
          <span class="select-shell">
            <select v-model="activeTeamId">
              <option value="">Wszystkie drużyny</option>
              <option v-for="option in teamOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
            <ChevronDown :size="16" aria-hidden="true" />
          </span>
        </label>

        <label class="search-field">
          <Search :size="17" aria-hidden="true" />
          <input v-model.trim="searchQuery" type="search" placeholder="Szukaj meczu" />
        </label>

        <button class="clear-button" type="button" :disabled="!hasActiveFilters" @click="clearFilters">
          <RotateCcw :size="15" aria-hidden="true" />
          Wyczyść
        </button>
      </form>

      <p v-if="!hasFilteredResults" class="empty-results panel">Brak wyników dla wybranych filtrów.</p>

      <div v-else class="result-stage-list">
        <section v-for="group in filteredResultGroups" :key="group.stage.id" class="result-stage">
          <div class="stage-heading">
            <div>
              <span>{{ group.stage.shortName }}</span>
              <h3>{{ group.stage.name }}</h3>
            </div>
            <strong>{{ matchCountLabel(group.matches.length) }}</strong>
          </div>

          <article v-for="row in group.matches" :key="row.match.id" class="result-match panel">
            <header class="match-card-head">
              <div class="match-title-block">
                <span>{{ row.match.matchNumber ? `Mecz ${row.match.matchNumber}` : group.stage.shortName }}</span>
                <h4>{{ matchTitle(row.match, row.homeTeam, row.awayTeam) }}</h4>
                <p v-if="matchMeta(row)">{{ matchMeta(row) }}</p>
              </div>

              <span class="match-badge">{{ matchBadgeLabel(row.match, group.stage) }}</span>
            </header>

            <div class="scoreboard" :aria-label="`${matchTitle(row.match, row.homeTeam, row.awayTeam)} ${matchScore(row.match)}`">
              <div class="score-team">
                <img v-if="getTeamFlag(row.homeTeam).src" :src="getTeamFlag(row.homeTeam).src || ''" alt="" loading="lazy" decoding="async" />
                <span v-else class="flag-emoji">{{ getTeamFlag(row.homeTeam).emoji }}</span>
                <strong>{{ displayTeamName(row.homeTeam, row.match.homePlaceholder ?? 'TBD') }}</strong>
              </div>

              <strong class="score-pill">{{ row.match.homeScore90 }} : {{ row.match.awayScore90 }}</strong>

              <div class="score-team score-team-away">
                <img v-if="getTeamFlag(row.awayTeam).src" :src="getTeamFlag(row.awayTeam).src || ''" alt="" loading="lazy" decoding="async" />
                <span v-else class="flag-emoji">{{ getTeamFlag(row.awayTeam).emoji }}</span>
                <strong>{{ displayTeamName(row.awayTeam, row.match.awayPlaceholder ?? 'TBD') }}</strong>
              </div>
            </div>

            <div class="first-scorer-summary">
              <Star :size="15" aria-hidden="true" />
              <span>Pierwszy gol</span>
              <span v-if="firstGoalName(row)" class="player-name first-scorer-name">
                <span v-if="firstGoalName(row)?.givenInitial" class="player-given">{{ firstGoalName(row)?.givenInitial }}</span>
                <strong class="player-surname">{{ firstGoalName(row)?.surname }}</strong>
                <span v-if="firstGoalName(row)?.suffix" class="player-suffix">{{ firstGoalName(row)?.suffix }}</span>
              </span>
              <strong v-else>{{ firstGoalFallback(row) }}</strong>
            </div>

            <section class="goals-panel">
              <div class="panel-title">
                <h5>Bramki</h5>
              </div>

              <p v-if="!hasGoalRows(row)" class="empty-inline">Brak danych o strzelcach.</p>
              <p v-else-if="row.match.noScorerConfirmed && row.homeGoalEvents.length === 0 && row.awayGoalEvents.length === 0" class="empty-inline">
                Brak strzelca.
              </p>

              <div v-else class="goal-columns">
                <div class="goal-team">
                  <span>{{ displayTeamName(row.homeTeam, row.match.homePlaceholder ?? 'TBD') }}</span>
                  <ul v-if="row.homeGoalEvents.length" class="goal-list">
                    <li v-for="goal in row.homeGoalEvents" :key="goal.event.id" class="goal-item" :class="{ 'is-first': goal.isFirst }">
                      <small>{{ minuteLabel(goal) }}</small>
                      <span class="player-name">
                        <span v-if="goal.name.givenInitial" class="player-given">{{ goal.name.givenInitial }}</span>
                        <strong class="player-surname">{{ goal.name.surname }}</strong>
                        <span v-if="goal.name.suffix" class="player-suffix">{{ goal.name.suffix }}</span>
                      </span>
                      <em v-if="goal.isFirst" class="first-goal-badge">
                        <Star :size="11" aria-hidden="true" />
                        pierwszy
                      </em>
                      <em v-if="goal.isOwnGoal" class="own-goal-badge">sam.</em>
                    </li>
                  </ul>
                  <p v-else class="empty-scorer-team">Brak bramek</p>
                </div>

                <div class="goal-team">
                  <span>{{ displayTeamName(row.awayTeam, row.match.awayPlaceholder ?? 'TBD') }}</span>
                  <ul v-if="row.awayGoalEvents.length" class="goal-list">
                    <li v-for="goal in row.awayGoalEvents" :key="goal.event.id" class="goal-item" :class="{ 'is-first': goal.isFirst }">
                      <small>{{ minuteLabel(goal) }}</small>
                      <span class="player-name">
                        <span v-if="goal.name.givenInitial" class="player-given">{{ goal.name.givenInitial }}</span>
                        <strong class="player-surname">{{ goal.name.surname }}</strong>
                        <span v-if="goal.name.suffix" class="player-suffix">{{ goal.name.suffix }}</span>
                      </span>
                      <em v-if="goal.isFirst" class="first-goal-badge">
                        <Star :size="11" aria-hidden="true" />
                        pierwszy
                      </em>
                      <em v-if="goal.isOwnGoal" class="own-goal-badge">sam.</em>
                    </li>
                  </ul>
                  <p v-else class="empty-scorer-team">Brak bramek</p>
                </div>
              </div>
            </section>

            <button class="collapse-button" type="button" :aria-expanded="isMatchExpanded(row.match.id)" @click="toggleMatch(row.match.id)">
              <span>{{ isMatchExpanded(row.match.id) ? 'Ukryj typy' : `Pokaż typy graczy (${row.playerRows.length})` }}</span>
              <ChevronDown :size="17" aria-hidden="true" :class="{ 'is-open': isMatchExpanded(row.match.id) }" />
            </button>

            <div v-show="isMatchExpanded(row.match.id)" class="predictions-panel">
              <p v-if="row.playerRows.length === 0" class="empty-inline">Brak typów graczy dla tego meczu.</p>

              <div v-else class="desktop-table-wrap" aria-label="Typy graczy i punktacja">
                <table class="results-table">
                  <thead>
                    <tr>
                      <th>Gracz</th>
                      <th>Typ</th>
                      <th>Strzelec</th>
                      <th>Wynik</th>
                      <th>Dokł.</th>
                      <th>Strz.</th>
                      <th>Suma</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="playerRow in row.playerRows" :key="playerRow.member.userId" :class="{ 'is-best-row': isBestPlayerRow(row, playerRow) }">
                      <td>
                        <strong class="member-name">{{ playerRow.member.displayName }}</strong>
                      </td>
                      <td>
                        <span class="score-chip" :class="`is-${playerRow.scoreState}`">{{ scoreLabel(playerRow) }}</span>
                      </td>
                      <td>
                        <span class="scorer-chip" :class="`is-${playerRow.scorerState}`">
                          <Check v-if="playerRow.scorerState === 'hit'" :size="14" aria-hidden="true" />
                          <X v-else-if="playerRow.scorerState === 'miss'" :size="14" aria-hidden="true" />
                          <span v-if="playerRow.scorerName" class="player-name">
                            <span v-if="playerRow.scorerName.givenInitial" class="player-given">{{ playerRow.scorerName.givenInitial }}</span>
                            <strong class="player-surname">{{ playerRow.scorerName.surname }}</strong>
                          </span>
                          <span v-else>Brak typu</span>
                          <span v-if="playerRow.scorerFirstBonus" class="bonus-mini">
                            <Star :size="11" aria-hidden="true" />
                            bonus
                          </span>
                        </span>
                      </td>
                      <td>{{ outcomePoints(playerRow) }}</td>
                      <td>{{ exactScorePoints(playerRow) }}</td>
                      <td>{{ totalScorerPoints(playerRow) }}</td>
                      <td>
                        <strong class="total-points">{{ totalPoints(playerRow) }}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="mobile-result-list">
                <article
                  v-for="playerRow in row.playerRows"
                  :key="playerRow.member.userId"
                  class="mobile-player-row"
                  :class="{ 'is-best-row': isBestPlayerRow(row, playerRow) }"
                >
                  <div class="mobile-row-head">
                    <strong>{{ playerRow.member.displayName }}</strong>
                    <span>{{ totalPoints(playerRow) }} pkt</span>
                  </div>

                  <div class="mobile-row-body">
                    <span class="score-chip" :class="`is-${playerRow.scoreState}`">{{ scoreLabel(playerRow) }}</span>
                    <span class="scorer-chip" :class="`is-${playerRow.scorerState}`">
                      <Check v-if="playerRow.scorerState === 'hit'" :size="14" aria-hidden="true" />
                      <X v-else-if="playerRow.scorerState === 'miss'" :size="14" aria-hidden="true" />
                      <span v-if="playerRow.scorerName" class="player-name">
                        <span v-if="playerRow.scorerName.givenInitial" class="player-given">{{ playerRow.scorerName.givenInitial }}</span>
                        <strong class="player-surname">{{ playerRow.scorerName.surname }}</strong>
                      </span>
                      <span v-else>Brak typu</span>
                      <span v-if="playerRow.scorerFirstBonus" class="bonus-mini">
                        <Star :size="11" aria-hidden="true" />
                        bonus
                      </span>
                    </span>
                  </div>

                  <div class="mobile-points">
                    <span>W/D/L {{ outcomePoints(playerRow) }}</span>
                    <span>Dokł. {{ exactScorePoints(playerRow) }}</span>
                    <span>Strz. {{ totalScorerPoints(playerRow) }}</span>
                  </div>
                </article>
              </div>
            </div>
          </article>
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped>
.results-section,
.results-content,
.result-stage-list,
.result-stage {
  display: grid;
  gap: 18px;
}

.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.section-heading div {
  display: grid;
  gap: 4px;
}

.section-heading h2,
.section-heading p {
  margin: 0;
}

.section-heading h2 {
  font-size: 22px;
}

.section-heading p {
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 800;
}

.results-count,
.stage-heading strong {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  border-radius: 7px;
  background: #eef4ef;
  padding: 0 10px;
  color: var(--app-primary-dark);
  font-size: 12px;
  font-weight: 950;
}

.empty-results {
  margin: 0;
  padding: 14px;
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 850;
}

.results-stats {
  display: grid;
  grid-template-columns: minmax(120px, 0.7fr) minmax(120px, 0.7fr) minmax(240px, 1.6fr);
  gap: 10px;
}

.stat-card {
  display: grid;
  min-height: 74px;
  align-content: center;
  gap: 6px;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: #fbfdf9;
  padding: 12px;
}

.stat-card span {
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}

.stat-card strong {
  min-width: 0;
  overflow: hidden;
  color: var(--app-ink);
  font-size: 20px;
  font-weight: 950;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.results-toolbar {
  position: sticky;
  z-index: 5;
  top: 10px;
  display: grid;
  grid-template-columns: minmax(160px, 0.95fr) minmax(160px, 0.95fr) minmax(160px, 0.95fr) minmax(180px, 1.05fr) auto;
  gap: 10px;
  border: 1px solid #d7e7da;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.94);
  padding: 10px;
  box-shadow: 0 14px 36px rgba(18, 35, 27, 0.08);
  backdrop-filter: blur(12px);
}

.filter-field,
.search-field,
.clear-button {
  min-width: 0;
}

.filter-field {
  display: grid;
  gap: 5px;
}

.filter-field > span:first-child {
  color: var(--app-muted);
  font-size: 10px;
  font-weight: 950;
  text-transform: uppercase;
}

.search-field input {
  width: 100%;
  min-width: 0;
  height: 40px;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: white;
  color: var(--app-ink);
  font: inherit;
  font-size: 13px;
  font-weight: 850;
}

.select-shell {
  position: relative;
  display: flex;
  height: 40px;
  min-width: 0;
  align-items: center;
  overflow: hidden;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: linear-gradient(180deg, #ffffff, #f8fbf7);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
  color: var(--app-ink);
}

.select-shell:focus-within {
  border-color: var(--app-primary);
  box-shadow: 0 0 0 3px rgba(19, 125, 78, 0.12);
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
  line-height: 1;
  padding: 0 34px 0 12px;
}

.select-shell svg {
  position: absolute;
  right: 10px;
  color: var(--app-primary-dark);
  pointer-events: none;
}

.search-field {
  display: flex;
  min-height: 40px;
  align-self: end;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: white;
  padding: 0 10px;
  color: var(--app-muted);
}

.search-field input {
  height: auto;
  border: 0;
  outline: 0;
  padding: 0;
  font-size: 12px;
  font-weight: 800;
}

.clear-button {
  display: inline-flex;
  min-height: 40px;
  align-self: end;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}

.clear-button {
  border: 1px solid var(--app-primary);
  background: var(--app-primary);
  padding: 0 11px;
  color: white;
  cursor: pointer;
}

.clear-button:disabled {
  border-color: var(--app-line);
  background: #edf0ec;
  color: var(--app-muted);
  cursor: not-allowed;
}

.stage-heading,
.match-card-head,
.scoreboard,
.score-team,
.scorer-chip,
.collapse-button {
  display: flex;
  align-items: center;
}

.stage-heading {
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--app-line);
  padding-bottom: 10px;
}

.stage-heading div,
.match-title-block {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.stage-heading span,
.match-title-block span,
.goal-team > span {
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}

.stage-heading h3,
.match-title-block h4,
.match-title-block p {
  margin: 0;
}

.stage-heading h3 {
  font-size: 20px;
}

.result-match {
  display: grid;
  gap: 14px;
  border-color: #d6e7da;
  padding: 16px;
  box-shadow: 0 12px 28px rgba(18, 35, 27, 0.06);
}

.match-card-head {
  justify-content: space-between;
  gap: 12px;
}

.match-title-block h4 {
  font-size: 18px;
  line-height: 1.2;
}

.match-title-block p {
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 760;
}

.match-badge {
  display: inline-flex;
  flex: 0 0 auto;
  min-height: 32px;
  align-items: center;
  border-radius: 8px;
  background: #eef4ef;
  padding: 0 10px;
  color: var(--app-primary-dark);
  font-size: 12px;
  font-weight: 950;
}

.scoreboard {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  border-radius: 10px;
  background: linear-gradient(180deg, #fbfdf9, #f5faf6);
  padding: 12px;
}

.score-team {
  min-width: 0;
  gap: 9px;
}

.score-team img,
.flag-emoji {
  flex: 0 0 auto;
  width: 38px;
  height: 28px;
  border-radius: 5px;
  object-fit: cover;
}

.flag-emoji {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.score-team strong {
  min-width: 0;
  color: var(--app-ink);
  font-size: 17px;
  font-weight: 950;
  line-height: 1.16;
}

.score-team-away {
  flex-direction: row-reverse;
  justify-content: flex-start;
  text-align: right;
}

.score-pill {
  display: inline-flex;
  min-width: 82px;
  height: 52px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: #13231b;
  color: white;
  font-size: 24px;
  font-weight: 950;
  line-height: 1;
}

.first-scorer-summary {
  display: inline-flex;
  width: fit-content;
  max-width: 100%;
  min-height: 34px;
  align-items: center;
  gap: 7px;
  overflow: hidden;
  border: 1px solid #e8ca78;
  border-radius: 8px;
  background: #fff6dd;
  padding: 0 10px;
  color: #765813;
  font-size: 13px;
  font-weight: 800;
}

.first-scorer-summary span {
  color: #765813;
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}

.first-scorer-summary strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.goals-panel,
.predictions-panel {
  display: grid;
  gap: 10px;
}

.panel-title h5 {
  margin: 0;
  font-size: 15px;
  font-weight: 950;
}

.goal-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.goal-team {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 8px;
  border: 1px solid var(--app-line);
  border-radius: 9px;
  background: #fbfdf9;
  padding: 10px;
}

.goal-list {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.goal-item {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
  border-radius: 8px;
  padding: 5px 7px;
  color: var(--app-ink);
  font-size: 13px;
  line-height: 1.2;
}

.goal-item.is-first {
  background: #fff2cf;
  box-shadow: inset 0 0 0 1px #e8ca78;
}

.goal-item small {
  flex: 0 0 auto;
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 950;
}

.player-name {
  display: inline-flex;
  min-width: 0;
  align-items: baseline;
  gap: 4px;
  overflow: hidden;
}

.player-given,
.player-surname,
.player-suffix {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-given {
  color: inherit;
  font-weight: 600;
}

.player-surname {
  color: inherit;
  font-weight: 950;
}

.player-suffix {
  flex: 0 0 auto;
  color: var(--app-muted);
  font-weight: 650;
}

.first-goal-badge,
.own-goal-badge,
.bonus-mini {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  border-radius: 999px;
  padding: 2px 6px;
  font-size: 10px;
  font-style: normal;
  font-weight: 950;
  text-transform: uppercase;
}

.first-goal-badge,
.bonus-mini {
  background: #fff2cf;
  color: #765813;
}

.own-goal-badge {
  background: #edf0ec;
  color: var(--app-muted);
}

.empty-inline,
.empty-scorer-team {
  margin: 0;
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 850;
}

.collapse-button {
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 42px;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: #f7faf6;
  padding: 0 12px;
  color: var(--app-primary-dark);
  cursor: pointer;
  font-size: 13px;
  font-weight: 950;
}

.collapse-button svg {
  transition: transform 160ms ease;
}

.collapse-button svg.is-open {
  transform: rotate(180deg);
}

.desktop-table-wrap {
  overflow: hidden;
  border: 1px solid var(--app-line);
  border-radius: 9px;
  background: white;
}

.results-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}

.results-table th,
.results-table td {
  border-bottom: 1px solid var(--app-line);
  padding: 11px 10px;
  text-align: left;
  vertical-align: middle;
}

.results-table th {
  color: var(--app-muted);
  font-size: 10px;
  font-weight: 950;
  text-transform: uppercase;
}

.results-table td {
  overflow: hidden;
  font-size: 13px;
  font-weight: 820;
  text-overflow: ellipsis;
}

.results-table th:nth-child(1),
.results-table td:nth-child(1) {
  width: 18%;
}

.results-table th:nth-child(2),
.results-table td:nth-child(2) {
  width: 10%;
}

.results-table th:nth-child(3),
.results-table td:nth-child(3) {
  width: 28%;
}

.results-table th:nth-child(n + 4),
.results-table td:nth-child(n + 4) {
  width: 8%;
  text-align: center;
}

.results-table tbody tr:last-child td {
  border-bottom: 0;
}

.results-table tbody tr.is-best-row {
  background: #fbf6e8;
}

.member-name {
  min-width: 0;
  overflow: hidden;
  font-weight: 950;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score-chip,
.scorer-chip {
  width: fit-content;
  max-width: 100%;
  min-height: 28px;
  overflow: hidden;
  border-radius: 7px;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.score-chip.is-exact {
  background: #e7f4eb;
  color: var(--app-primary-dark);
}

.score-chip.is-outcome {
  background: #fff2cf;
  color: #765813;
}

.score-chip.is-miss {
  background: #f9e7e4;
  color: var(--app-danger);
}

.score-chip.is-empty,
.scorer-chip.is-empty {
  background: #edf0ec;
  color: var(--app-muted);
}

.scorer-chip {
  gap: 6px;
  min-width: 0;
  background: #f4f7f2;
  color: var(--app-ink);
}

.scorer-chip .player-name {
  flex: 1 1 auto;
}

.scorer-chip.is-hit {
  background: #e7f4eb;
  color: var(--app-primary-dark);
}

.scorer-chip.is-miss {
  background: #f9e7e4;
  color: var(--app-danger);
}

.scorer-chip svg {
  flex: 0 0 auto;
}

.total-points {
  display: inline-flex;
  min-width: 34px;
  min-height: 30px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #13231b;
  color: white;
  font-weight: 950;
}

.mobile-result-list {
  display: none;
}

@media (max-width: 980px) {
  .results-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .results-toolbar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .search-field {
    grid-column: 1 / -1;
  }
}

@media (max-width: 760px) {
  .section-heading,
  .stage-heading,
  .match-card-head {
    align-items: stretch;
    flex-direction: column;
  }

  .results-stats,
  .results-toolbar {
    grid-template-columns: 1fr;
  }

  .results-toolbar {
    position: static;
  }

  .stat-card-wide {
    min-height: 66px;
  }

  .scoreboard {
    grid-template-columns: 1fr;
    justify-items: center;
    text-align: center;
  }

  .score-team,
  .score-team-away {
    flex-direction: column;
    justify-content: center;
    text-align: center;
  }

  .score-team strong {
    font-size: 16px;
  }

  .score-pill {
    min-width: 96px;
    height: 56px;
    font-size: 25px;
  }

  .first-scorer-summary {
    width: 100%;
  }

  .goal-columns {
    grid-template-columns: 1fr;
  }

  .desktop-table-wrap {
    display: none;
  }

  .mobile-result-list {
    display: grid;
    gap: 8px;
  }

  .mobile-player-row {
    display: grid;
    gap: 8px;
    border: 1px solid var(--app-line);
    border-radius: 9px;
    background: #fbfdf9;
    padding: 10px;
  }

  .mobile-player-row.is-best-row {
    border-color: #e8ca78;
    background: #fffaf0;
  }

  .mobile-row-head,
  .mobile-row-body,
  .mobile-points {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 8px;
  }

  .mobile-row-head {
    justify-content: space-between;
  }

  .mobile-row-head strong {
    min-width: 0;
    overflow: hidden;
    font-size: 14px;
    font-weight: 950;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-row-head span {
    flex: 0 0 auto;
    border-radius: 8px;
    background: #13231b;
    padding: 5px 8px;
    color: white;
    font-size: 13px;
    font-weight: 950;
  }

  .mobile-row-body,
  .mobile-points {
    flex-wrap: wrap;
  }

  .mobile-points span {
    display: inline-flex;
    min-height: 24px;
    align-items: center;
    justify-content: center;
    border-radius: 7px;
    background: #eef4ef;
    padding: 0 7px;
    color: var(--app-muted);
    font-size: 11px;
    font-weight: 900;
  }
}
</style>
