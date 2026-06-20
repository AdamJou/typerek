import type { Match, MatchEvent, MatchPrediction, RankingRow, ScoreBreakdown, ScoringRules, TournamentStage } from '~/types/domain'

export const defaultScoringRules: ScoringRules = {
  resultPoints: 2,
  exactScoreBonus: 5,
  firstScorerPoints: 1,
  firstScorerBonusPoints: 2,
}

const generalTieBreakerStageCodes: readonly TournamentStage['code'][] = [
  'group_round_2',
  'group_round_3',
  'round_of_32',
  'round_of_16',
  'quarter_finals',
  'semi_finals',
  'third_place',
  'final',
]

interface AggregateRankingOptions {
  useGeneralTieBreakers?: boolean
}

type RankingStats = Pick<
  RankingRow,
  'totalPoints' | 'outcomePoints' | 'exactScorePoints' | 'firstScorerPoints' | 'bonusPoints'
>

function resultSign(home: number, away: number) {
  if (home > away) {
    return 'H'
  }

  if (home < away) {
    return 'A'
  }

  return 'D'
}

export function isPredictionLocked(match: Pick<Match, 'startsAtUtc'>, now = new Date()) {
  return now.getTime() >= new Date(match.startsAtUtc).getTime()
}

export function canRevealMatchPredictions(
  match: Pick<Match, 'startsAtUtc' | 'status' | 'resultConfirmedAt'>,
  now = new Date(),
) {
  return Boolean(match.resultConfirmedAt) || match.status === 'confirmed' || isPredictionLocked(match, now)
}

export function stageStartsAt(stageId: string, matches: readonly Pick<Match, 'stageId' | 'startsAtUtc'>[]) {
  const timestamps = matches
    .filter((match) => match.stageId === stageId)
    .map((match) => new Date(match.startsAtUtc).getTime())
    .filter(Number.isFinite)

  if (timestamps.length === 0) {
    return null
  }

  return new Date(Math.min(...timestamps))
}

export function stageEndsAt(stageId: string, matches: readonly Pick<Match, 'stageId' | 'startsAtUtc'>[]) {
  const timestamps = matches
    .filter((match) => match.stageId === stageId)
    .map((match) => new Date(match.startsAtUtc).getTime())
    .filter(Number.isFinite)

  if (timestamps.length === 0) {
    return null
  }

  return new Date(Math.max(...timestamps))
}

export function currentPredictionStageId(
  stages: readonly Pick<Match, 'stageId'>[] | readonly { id: string }[],
  matches: readonly Pick<Match, 'stageId' | 'startsAtUtc'>[],
  now = new Date(),
) {
  const orderedStages = stages
    .map((stage) => {
      const stageId = 'id' in stage ? stage.id : stage.stageId

      return {
        id: stageId,
        startsAt: stageStartsAt(stageId, matches),
        endsAt: stageEndsAt(stageId, matches),
      }
    })
    .filter((stage): stage is { id: string; startsAt: Date; endsAt: Date } => stage.startsAt !== null && stage.endsAt !== null)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())

  if (orderedStages.length === 0) {
    return null
  }

  return orderedStages.find((stage) => now.getTime() < stage.endsAt.getTime())?.id ?? orderedStages[orderedStages.length - 1]!.id
}

export function shouldUseGeneralRankingTieBreakers(stage: Pick<TournamentStage, 'code'> | null | undefined) {
  return Boolean(stage && generalTieBreakerStageCodes.includes(stage.code))
}

export function isStagePredictionOpen(
  stageId: string,
  stages: readonly Pick<Match, 'stageId'>[] | readonly { id: string }[],
  matches: readonly Pick<Match, 'stageId' | 'startsAtUtc'>[],
  now = new Date(),
) {
  return currentPredictionStageId(stages, matches, now) === stageId
}

export function isMatchPredictionOpen(
  match: Pick<Match, 'stageId' | 'startsAtUtc' | 'status'>,
  stages: readonly Pick<Match, 'stageId'>[] | readonly { id: string }[],
  matches: readonly Pick<Match, 'stageId' | 'startsAtUtc'>[],
  now = new Date(),
) {
  return match.status === 'scheduled' && isStagePredictionOpen(match.stageId, stages, matches, now) && !isPredictionLocked(match, now)
}

export function validatePredictionInput(prediction: Pick<MatchPrediction, 'predictedHomeScore' | 'predictedAwayScore' | 'firstScorerPlayerId' | 'noScorer'>) {
  if (prediction.predictedHomeScore < 0 || prediction.predictedAwayScore < 0) {
    return 'Wynik nie może być ujemny.'
  }

  if (prediction.noScorer && (prediction.predictedHomeScore !== 0 || prediction.predictedAwayScore !== 0)) {
    return 'Opcja braku strzelca jest dozwolona tylko przy typie 0:0.'
  }

  if (!prediction.noScorer && !prediction.firstScorerPlayerId) {
    return 'Wybierz pierwszego strzelca albo opcję braku strzelca.'
  }

  return null
}

export function scoreMatchPrediction(
  match: Match,
  prediction: MatchPrediction,
  rules: ScoringRules = defaultScoringRules,
  matchEvents: readonly MatchEvent[] = [],
): ScoreBreakdown {
  if (match.homeScore90 === null || match.awayScore90 === null || !match.resultConfirmedAt) {
    return {
      leagueId: prediction.leagueId,
      userId: prediction.userId,
      sourceType: 'match',
      sourceId: match.id,
      stageId: match.stageId,
      outcomePoints: 0,
      exactScorePoints: 0,
      firstScorerPoints: 0,
      bonusPoints: 0,
      totalPoints: 0,
    }
  }

  const predictedResult = resultSign(prediction.predictedHomeScore, prediction.predictedAwayScore)
  const actualResult = resultSign(match.homeScore90, match.awayScore90)
  const outcomePoints = predictedResult === actualResult ? rules.resultPoints : 0
  const exactScorePoints =
    prediction.predictedHomeScore === match.homeScore90 && prediction.predictedAwayScore === match.awayScore90
      ? rules.exactScoreBonus
      : 0

  const wasGoalless = match.homeScore90 === 0 && match.awayScore90 === 0
  const effectiveMatchEvents = matchEvents.some((event) => event.matchId === match.id && event.provider === 'manual')
    ? matchEvents.filter((event) => event.matchId === match.id && event.provider === 'manual')
    : matchEvents.filter((event) => event.matchId === match.id)
  const normalGoalScorerIds = new Set(
    effectiveMatchEvents
      .filter((event) => event.eventType === 'goal' && !isOwnGoal(event))
      .map((event) => event.playerId)
      .filter((playerId): playerId is string => Boolean(playerId)),
  )
  const firstNormalScorerId =
    effectiveMatchEvents
      .filter((event) => event.eventType === 'goal' && !isOwnGoal(event) && event.playerId)
      .sort((left, right) => left.minute - right.minute || left.createdAt.localeCompare(right.createdAt))[0]?.playerId ?? match.firstScorerPlayerId
  const firstScorerPoints =
    (prediction.noScorer && wasGoalless) ||
    (!prediction.noScorer &&
      prediction.firstScorerPlayerId !== null &&
      (normalGoalScorerIds.size > 0
        ? normalGoalScorerIds.has(prediction.firstScorerPlayerId)
        : prediction.firstScorerPlayerId === match.firstScorerPlayerId))
      ? rules.firstScorerPoints
      : 0
  const bonusPoints =
    !prediction.noScorer &&
    prediction.firstScorerPlayerId !== null &&
    firstNormalScorerId !== null &&
    prediction.firstScorerPlayerId === firstNormalScorerId
      ? rules.firstScorerBonusPoints
      : 0

  return {
    leagueId: prediction.leagueId,
    userId: prediction.userId,
    sourceType: 'match',
    sourceId: match.id,
    stageId: match.stageId,
    outcomePoints,
    exactScorePoints,
    firstScorerPoints,
    bonusPoints,
    totalPoints: outcomePoints + exactScorePoints + firstScorerPoints + bonusPoints,
  }
}

function isOwnGoal(event: MatchEvent) {
  return event.detail === 'manual_own_goal' || event.detail === 'own_goal'
}

export function resolveRankingBreakdowns(
  breakdowns: readonly ScoreBreakdown[],
  matches: readonly Match[],
  predictions: readonly MatchPrediction[],
  matchEvents: readonly MatchEvent[],
) {
  const bonusBreakdowns = breakdowns.filter((row) => row.sourceType === 'bonus')
  const matchesById = new Map(matches.map((match) => [match.id, match]))
  const eventsByMatchId = new Map<string, MatchEvent[]>()

  for (const event of matchEvents) {
    const current = eventsByMatchId.get(event.matchId) ?? []
    current.push(event)
    eventsByMatchId.set(event.matchId, current)
  }

  const matchBreakdowns = predictions.flatMap((prediction) => {
    const match = matchesById.get(prediction.matchId)

    if (!match?.resultConfirmedAt || match.homeScore90 === null || match.awayScore90 === null) {
      return []
    }

    return [
      scoreMatchPrediction(
        match,
        prediction,
        defaultScoringRules,
        eventsByMatchId.get(match.id) ?? [],
      ),
    ]
  })

  return [...matchBreakdowns, ...bonusBreakdowns]
}

export function aggregateRanking(
  breakdowns: readonly ScoreBreakdown[],
  members: readonly { userId: string; displayName: string }[],
  stageId?: string,
  options: AggregateRankingOptions = {},
) {
  const sortedRows = members
    .map((member) => {
      const userBreakdowns = breakdowns.filter((row) => row.userId === member.userId)
      const stageBreakdowns = stageId ? userBreakdowns.filter((row) => row.stageId === stageId) : userBreakdowns
      const visibleBreakdowns = stageId ? stageBreakdowns : userBreakdowns
      const visibleStats = aggregateRankingStats(visibleBreakdowns)
      const tieBreakerStats =
        stageId && options.useGeneralTieBreakers
          ? aggregateRankingStats(userBreakdowns)
          : visibleStats

      return {
        userId: member.userId,
        displayName: member.displayName,
        ...visibleStats,
        tieBreakerStats,
      }
    })
    .sort(
      (a, b) =>
        b.totalPoints - a.totalPoints ||
        b.tieBreakerStats.totalPoints - a.tieBreakerStats.totalPoints ||
        b.tieBreakerStats.exactScorePoints - a.tieBreakerStats.exactScorePoints ||
        b.tieBreakerStats.outcomePoints - a.tieBreakerStats.outcomePoints ||
        b.tieBreakerStats.firstScorerPoints - a.tieBreakerStats.firstScorerPoints ||
        a.displayName.localeCompare(b.displayName, 'pl'),
    )

  let previousPosition = 0

  return sortedRows.map((row, index) => {
    const previousRow = sortedRows[index - 1]
    const sharesPosition =
      previousRow !== undefined &&
      row.totalPoints === previousRow.totalPoints
    const position = sharesPosition ? previousPosition : index + 1

    previousPosition = position

    return {
      userId: row.userId,
      displayName: row.displayName,
      totalPoints: row.totalPoints,
      outcomePoints: row.outcomePoints,
      exactScorePoints: row.exactScorePoints,
      firstScorerPoints: row.firstScorerPoints,
      bonusPoints: row.bonusPoints,
      position,
    }
  })
}

function aggregateRankingStats(breakdowns: readonly ScoreBreakdown[]): RankingStats {
  const matchBreakdowns = breakdowns.filter((row) => row.sourceType === 'match')
  const bonusBreakdowns = breakdowns.filter((row) => row.sourceType === 'bonus')

  return {
    totalPoints: breakdowns.reduce((sum, row) => sum + row.totalPoints, 0),
    outcomePoints: breakdowns.reduce((sum, row) => sum + row.outcomePoints, 0),
    exactScorePoints: breakdowns.reduce((sum, row) => sum + row.exactScorePoints, 0),
    firstScorerPoints: matchBreakdowns.reduce(
      (sum, row) => sum + row.firstScorerPoints + row.bonusPoints,
      0,
    ),
    bonusPoints: bonusBreakdowns.reduce((sum, row) => sum + row.bonusPoints, 0),
  }
}
