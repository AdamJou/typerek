import { describe, expect, it } from 'vitest'
import type { Match, MatchEvent, MatchPrediction, ScoreBreakdown } from '~/types/domain'
import {
  aggregateRanking,
  canRevealMatchPredictions,
  defaultScoringRules,
  isPredictionLocked,
  resolveRankingBreakdowns,
  scoreMatchPrediction,
  validatePredictionInput,
} from '~/utils/scoring'

const baseMatch: Match = {
  id: 'match-1',
  tournamentId: 'tournament-1',
  stageId: 'stage-1',
  homeTeamId: 'team-home',
  awayTeamId: 'team-away',
  startsAtUtc: '2026-06-11T19:00:00Z',
  status: 'confirmed',
  homeScore90: 2,
  awayScore90: 1,
  firstScorerPlayerId: 'player-home-1',
  noScorerConfirmed: false,
  resultConfirmedAt: '2026-06-11T21:00:00Z',
}

function prediction(overrides: Partial<MatchPrediction> = {}): MatchPrediction {
  return {
    id: 'prediction-1',
    leagueId: 'league-1',
    userId: 'user-1',
    matchId: 'match-1',
    predictedHomeScore: 2,
    predictedAwayScore: 1,
    firstScorerPlayerId: 'player-home-1',
    noScorer: false,
    updatedAt: '2026-06-10T12:00:00Z',
    ...overrides,
  }
}

describe('scoreMatchPrediction', () => {
  it('awards 10 points for exact score and first scorer', () => {
    const score = scoreMatchPrediction(baseMatch, prediction(), defaultScoringRules)

    expect(score.outcomePoints).toBe(2)
    expect(score.exactScorePoints).toBe(5)
    expect(score.firstScorerPoints).toBe(1)
    expect(score.bonusPoints).toBe(2)
    expect(score.totalPoints).toBe(10)
  })

  it('awards only result points when W/D/L is correct', () => {
    const score = scoreMatchPrediction(baseMatch, prediction({ predictedHomeScore: 3, predictedAwayScore: 0, firstScorerPlayerId: 'player-away-1' }))

    expect(score.outcomePoints).toBe(2)
    expect(score.exactScorePoints).toBe(0)
    expect(score.firstScorerPoints).toBe(0)
    expect(score.bonusPoints).toBe(0)
    expect(score.totalPoints).toBe(2)
  })

  it('awards no scorer bonus only for real 0:0', () => {
    const goallessMatch: Match = {
      ...baseMatch,
      homeScore90: 0,
      awayScore90: 0,
      firstScorerPlayerId: null,
      noScorerConfirmed: true,
    }

    const score = scoreMatchPrediction(
      goallessMatch,
      prediction({ predictedHomeScore: 0, predictedAwayScore: 0, firstScorerPlayerId: null, noScorer: true }),
    )

    expect(score.outcomePoints).toBe(2)
    expect(score.exactScorePoints).toBe(5)
    expect(score.firstScorerPoints).toBe(1)
    expect(score.bonusPoints).toBe(0)
    expect(score.totalPoints).toBe(8)
  })
})

describe('aggregateRanking', () => {
  it('combines the scorer point and first-goal bonus in the scorer column', () => {
    const breakdowns: ScoreBreakdown[] = [
      {
        leagueId: 'league-1',
        userId: 'jurson',
        sourceType: 'match',
        sourceId: 'match-1',
        stageId: 'stage-1',
        outcomePoints: 2,
        exactScorePoints: 0,
        firstScorerPoints: 1,
        bonusPoints: 2,
        totalPoints: 5,
      },
      {
        leagueId: 'league-1',
        userId: 'jurson',
        sourceType: 'bonus',
        sourceId: 'question-1',
        stageId: null,
        outcomePoints: 0,
        exactScorePoints: 0,
        firstScorerPoints: 0,
        bonusPoints: 4,
        totalPoints: 4,
      },
    ]

    const [row] = aggregateRanking(breakdowns, [{ userId: 'jurson', displayName: 'Jurson' }])

    expect(row?.firstScorerPoints).toBe(3)
    expect(row?.bonusPoints).toBe(4)
    expect(row?.totalPoints).toBe(9)
  })

  it('keeps legacy match breakdowns with all scorer points in one field correct', () => {
    const breakdowns: ScoreBreakdown[] = [
      {
        leagueId: 'league-1',
        userId: 'jurson',
        sourceType: 'match',
        sourceId: 'match-1',
        stageId: 'stage-1',
        outcomePoints: 2,
        exactScorePoints: 0,
        firstScorerPoints: 3,
        bonusPoints: 0,
        totalPoints: 5,
      },
    ]

    const [row] = aggregateRanking(breakdowns, [{ userId: 'jurson', displayName: 'Jurson' }])

    expect(row?.firstScorerPoints).toBe(3)
    expect(row?.totalPoints).toBe(5)
  })

  it('assigns the same general position to players tied on points', () => {
    const breakdowns: ScoreBreakdown[] = [
      scoreBreakdown('adam', 'stage-1', 8),
      scoreBreakdown('beta', 'stage-1', 8),
      scoreBreakdown('charlie', 'stage-1', 5),
    ]

    const ranking = aggregateRanking(breakdowns, [
      { userId: 'adam', displayName: 'Adam' },
      { userId: 'beta', displayName: 'Beta' },
      { userId: 'charlie', displayName: 'Charlie' },
    ])

    expect(ranking.map((row) => [row.userId, row.position])).toEqual([
      ['adam', 1],
      ['beta', 1],
      ['charlie', 3],
    ])
  })

  it('orders point ties by exact scores, outcomes, then scorers', () => {
    const breakdowns: ScoreBreakdown[] = [
      scoreBreakdown('adam', 'stage-1', 10, { exactScorePoints: 0, outcomePoints: 8, firstScorerPoints: 2 }),
      scoreBreakdown('beta', 'stage-1', 10, { exactScorePoints: 5, outcomePoints: 2, firstScorerPoints: 3 }),
      scoreBreakdown('charlie', 'stage-1', 10, { exactScorePoints: 5, outcomePoints: 4, firstScorerPoints: 1 }),
      scoreBreakdown('delta', 'stage-1', 10, { exactScorePoints: 5, outcomePoints: 4, firstScorerPoints: 1 }),
      scoreBreakdown('edek', 'stage-1', 9, { exactScorePoints: 5, outcomePoints: 4, firstScorerPoints: 0 }),
      {
        ...scoreBreakdown('edek', 'bonus', 1, { outcomePoints: 0, bonusPoints: 1 }),
        sourceType: 'bonus',
        sourceId: 'edek-bonus',
        stageId: null,
      },
    ]

    const ranking = aggregateRanking(breakdowns, [
      { userId: 'adam', displayName: 'Adam' },
      { userId: 'beta', displayName: 'Beta' },
      { userId: 'charlie', displayName: 'Charlie' },
      { userId: 'delta', displayName: 'Delta' },
      { userId: 'edek', displayName: 'Edek' },
    ])

    expect(ranking.map((row) => [row.userId, row.position])).toEqual([
      ['charlie', 1],
      ['delta', 1],
      ['edek', 3],
      ['beta', 4],
      ['adam', 5],
    ])
  })

  it('uses stage scoring categories as the live-stage tie-breakers', () => {
    const breakdowns: ScoreBreakdown[] = [
      scoreBreakdown('adam', 'stage-1', 5, { exactScorePoints: 5, outcomePoints: 0, firstScorerPoints: 0 }),
      scoreBreakdown('adam', 'stage-previous', 2),
      scoreBreakdown('beta', 'stage-1', 5, { exactScorePoints: 0, outcomePoints: 5, firstScorerPoints: 0 }),
      scoreBreakdown('beta', 'stage-previous', 7),
      scoreBreakdown('charlie', 'stage-1', 5, { exactScorePoints: 0, outcomePoints: 3, firstScorerPoints: 2 }),
      scoreBreakdown('charlie', 'stage-previous', 7),
      scoreBreakdown('delta', 'stage-1', 3),
    ]

    const ranking = aggregateRanking(
      breakdowns,
      [
        { userId: 'adam', displayName: 'Adam' },
        { userId: 'beta', displayName: 'Beta' },
        { userId: 'charlie', displayName: 'Charlie' },
        { userId: 'delta', displayName: 'Delta' },
      ],
      'stage-1',
    )

    expect(ranking.map((row) => [row.userId, row.position])).toEqual([
      ['adam', 1],
      ['beta', 2],
      ['charlie', 3],
      ['delta', 4],
    ])
  })
})

describe('resolveRankingBreakdowns', () => {
  it('awards Adam 1 scorer point and Jurson 3 when Jurson predicted the first scorer', () => {
    const match: Match = {
      ...baseMatch,
      homeScore90: 2,
      awayScore90: 0,
      firstScorerPlayerId: 'quinones',
    }
    const events: MatchEvent[] = [
      {
        id: 'goal-1',
        matchId: match.id,
        provider: 'manual',
        providerEventId: 'goal-1',
        eventType: 'goal',
        minute: 1,
        extraMinute: null,
        teamId: 'team-home',
        playerId: 'quinones',
        playerName: 'J. Quiñones',
        detail: 'manual_goal',
        createdAt: '2026-06-11T19:01:00Z',
      },
      {
        id: 'goal-2',
        matchId: match.id,
        provider: 'manual',
        providerEventId: 'goal-2',
        eventType: 'goal',
        minute: 2,
        extraMinute: null,
        teamId: 'team-home',
        playerId: 'jimenez',
        playerName: 'R. Jiménez',
        detail: 'manual_goal',
        createdAt: '2026-06-11T19:02:00Z',
      },
    ]
    const predictions = [
      prediction({
        id: 'adam-prediction',
        userId: 'adam',
        predictedHomeScore: 2,
        predictedAwayScore: 0,
        firstScorerPlayerId: 'jimenez',
      }),
      prediction({
        id: 'jurson-prediction',
        userId: 'jurson',
        predictedHomeScore: 2,
        predictedAwayScore: 1,
        firstScorerPlayerId: 'quinones',
      }),
    ]

    const ranking = aggregateRanking(
      resolveRankingBreakdowns([], [match], predictions, events),
      [
        { userId: 'adam', displayName: 'Adam' },
        { userId: 'jurson', displayName: 'Jurson' },
      ],
    )

    const adam = ranking.find((row) => row.userId === 'adam')
    const jurson = ranking.find((row) => row.userId === 'jurson')

    expect(adam?.firstScorerPoints).toBe(1)
    expect(adam?.totalPoints).toBe(8)
    expect(jurson?.firstScorerPoints).toBe(3)
    expect(jurson?.totalPoints).toBe(5)
  })
})

describe('prediction guards', () => {
  it('locks predictions at kickoff time', () => {
    expect(isPredictionLocked(baseMatch, new Date('2026-06-11T18:59:59Z'))).toBe(false)
    expect(isPredictionLocked(baseMatch, new Date('2026-06-11T19:00:00Z'))).toBe(true)
  })

  it('reveals player predictions only from kickoff', () => {
    const scheduledMatch = {
      ...baseMatch,
      status: 'scheduled' as const,
      resultConfirmedAt: null,
    }

    expect(canRevealMatchPredictions(scheduledMatch, new Date('2026-06-11T18:59:59Z'))).toBe(false)
    expect(canRevealMatchPredictions(scheduledMatch, new Date('2026-06-11T19:00:00Z'))).toBe(true)
  })

  it('reveals player predictions when an admin confirms a result early', () => {
    const confirmedMatch = {
      ...baseMatch,
      startsAtUtc: '2026-06-12T19:00:00Z',
    }

    expect(canRevealMatchPredictions(confirmedMatch, new Date('2026-06-11T19:00:00Z'))).toBe(true)
  })

  it('requires no scorer only with 0:0', () => {
    expect(
      validatePredictionInput({
        predictedHomeScore: 1,
        predictedAwayScore: 0,
        firstScorerPlayerId: null,
        noScorer: true,
      }),
    ).toBe('Opcja braku strzelca jest dozwolona tylko przy typie 0:0.')
  })
})

function scoreBreakdown(
  userId: string,
  stageId: string,
  totalPoints: number,
  overrides: Partial<Pick<ScoreBreakdown, 'outcomePoints' | 'exactScorePoints' | 'firstScorerPoints' | 'bonusPoints'>> = {},
): ScoreBreakdown {
  return {
    leagueId: 'league-1',
    userId,
    sourceType: 'match',
    sourceId: `${userId}-${stageId}`,
    stageId,
    outcomePoints: overrides.outcomePoints ?? totalPoints,
    exactScorePoints: overrides.exactScorePoints ?? 0,
    firstScorerPoints: overrides.firstScorerPoints ?? 0,
    bonusPoints: overrides.bonusPoints ?? 0,
    totalPoints,
  }
}
