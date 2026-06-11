import { describe, expect, it } from 'vitest'
import type { BonusPrediction, BonusQuestion, LeagueMember, Team } from '~/types/domain'
import {
  defaultAnswerForQuestion,
  normalizeBonusNumericValue,
  resolveBonusQuestion,
} from '~/utils/bonus'
import { bonusAnswersExportFilename, buildBonusAnswersExport } from '~/utils/bonusExport'

function numericQuestion(): BonusQuestion {
  return {
    id: 'question-1',
    leagueId: 'league-1',
    slug: 'custom-numeric-question',
    title: 'Ile goli?',
    points: 10,
    deadlineAt: '2026-06-11T19:00:00Z',
    lockAt: null,
    kind: 'numeric',
    sourceKind: 'manual_fact',
    configJson: { maxValue: 20 },
    correctOptionId: null,
  }
}

describe('bonus numeric answers', () => {
  it('keeps an empty numeric input unanswered instead of converting it to zero', () => {
    expect(normalizeBonusNumericValue('', 20)).toBeNull()
  })

  it('normalizes entered values without losing the selected number', () => {
    expect(normalizeBonusNumericValue('7', 20)).toBe(7)
    expect(normalizeBonusNumericValue('25', 20)).toBe(20)
  })

  it('does not prefill a new numeric question with zero', () => {
    expect(defaultAnswerForQuestion(resolveBonusQuestion(numericQuestion()), [])).toBeNull()
  })
})

describe('bonus answers TXT export', () => {
  it('exports every participant with readable team rankings and missing answers', () => {
    const questions: BonusQuestion[] = [
      {
        ...numericQuestion(),
        id: 'winner-question',
        title: 'Kto wygra mundial?',
        kind: 'team_single',
        sourceKind: 'teams',
        displayOrder: 1,
      },
      {
        ...numericQuestion(),
        id: 'top-four-question',
        title: 'Podaj Top 4',
        kind: 'ranked_top4',
        sourceKind: 'teams',
        displayOrder: 2,
      },
    ]
    const members: Array<Pick<LeagueMember, 'userId' | 'displayName'>> = [
      { userId: 'beta', displayName: 'Beta' },
      { userId: 'adam', displayName: 'Adam' },
    ]
    const teams: Team[] = [
      team('mexico', 'Meksyk'),
      team('spain', 'Hiszpania'),
      team('brazil', 'Brazylia'),
      team('argentina', 'Argentyna'),
    ]
    const predictions: BonusPrediction[] = [
      prediction('adam', 'winner-question', { teamId: 'mexico' }),
      prediction('adam', 'top-four-question', {
        orderedTeamIds: ['spain', 'brazil', 'argentina', 'mexico'],
      }),
    ]

    const text = buildBonusAnswersExport({
      leagueName: 'Liga Znajomych',
      generatedAt: '2026-06-11T20:00:00Z',
      members,
      questions,
      predictions,
      options: [],
      teams,
      players: [],
      stages: [],
    })

    expect(text.indexOf('UCZESTNIK: Adam')).toBeLessThan(text.indexOf('UCZESTNIK: Beta'))
    expect(text).toContain('Odpowiedź: Meksyk')
    expect(text).toContain('1. Hiszpania')
    expect(text).toContain('4. Meksyk')
    expect(text).toContain('UCZESTNIK: Beta')
    expect(text).toContain('Odpowiedzi: 0/2')
    expect(text).toContain('Odpowiedź: Brak odpowiedzi')
  })

  it('creates an ASCII TXT filename', () => {
    expect(bonusAnswersExportFilename('Liga Łódź', '2026-06-11T20:00:00Z')).toBe(
      'typerek-liga-lodz-odpowiedzi-2026-06-11.txt',
    )
  })
})

function team(id: string, name: string): Team {
  return {
    id,
    tournamentId: 'tournament-1',
    name,
    countryCode: null,
    flag: '',
  }
}

function prediction(
  userId: string,
  questionId: string,
  answerJson: Record<string, unknown>,
): BonusPrediction {
  return {
    id: `${userId}-${questionId}`,
    questionId,
    userId,
    answerJson,
    updatedAt: '2026-06-11T18:00:00Z',
  }
}
