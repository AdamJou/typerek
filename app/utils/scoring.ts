import type { Match, MatchEvent, MatchPrediction, ScoreBreakdown, ScoringRules } from '~/types/domain'

export const defaultScoringRules: ScoringRules = {
  resultPoints: 2,
  exactScoreBonus: 5,
  firstScorerPoints: 1,
  firstScorerBonusPoints: 2,
}

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
  const normalGoalScorerIds = new Set(
    matchEvents
      .filter((event) => event.matchId === match.id && event.eventType === 'goal' && !isOwnGoal(event))
      .map((event) => event.playerId)
      .filter((playerId): playerId is string => Boolean(playerId)),
  )
  const firstNormalScorerId =
    matchEvents
      .filter((event) => event.matchId === match.id && event.eventType === 'goal' && !isOwnGoal(event) && event.playerId)
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

export function aggregateRanking(
  breakdowns: readonly ScoreBreakdown[],
  members: readonly { userId: string; displayName: string }[],
  stageId?: string,
) {
  return members
    .map((member) => {
      const userBreakdowns = breakdowns.filter((row) => row.userId === member.userId)
      const stageBreakdowns = stageId ? userBreakdowns.filter((row) => row.stageId === stageId) : userBreakdowns
      const visibleBreakdowns = stageId ? stageBreakdowns : userBreakdowns
      const visibleTotalPoints = visibleBreakdowns.reduce((sum, row) => sum + row.totalPoints, 0)

      return {
        userId: member.userId,
        displayName: member.displayName,
        totalPoints: visibleTotalPoints,
        stagePoints: stageBreakdowns.reduce((sum, row) => sum + row.totalPoints, 0),
        outcomePoints: visibleBreakdowns.reduce((sum, row) => sum + row.outcomePoints, 0),
        exactScorePoints: visibleBreakdowns.reduce((sum, row) => sum + row.exactScorePoints, 0),
        firstScorerPoints: visibleBreakdowns.reduce((sum, row) => sum + row.firstScorerPoints, 0),
        bonusPoints: visibleBreakdowns.reduce((sum, row) => sum + row.bonusPoints, 0),
      }
    })
    .sort((a, b) => b.totalPoints - a.totalPoints || a.displayName.localeCompare(b.displayName, 'pl'))
}
