import { describe, expect, it } from 'vitest'
import type { Match, MatchPrediction } from '~/types/domain'
import { defaultScoringRules, isPredictionLocked, scoreMatchPrediction, validatePredictionInput } from '~/utils/scoring'

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

describe('prediction guards', () => {
  it('locks predictions at kickoff time', () => {
    expect(isPredictionLocked(baseMatch, new Date('2026-06-11T18:59:59Z'))).toBe(false)
    expect(isPredictionLocked(baseMatch, new Date('2026-06-11T19:00:00Z'))).toBe(true)
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
