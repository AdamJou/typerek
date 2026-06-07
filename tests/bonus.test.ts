import { describe, expect, it } from 'vitest'
import type { BonusQuestion } from '~/types/domain'
import {
  defaultAnswerForQuestion,
  normalizeBonusNumericValue,
  resolveBonusQuestion,
} from '~/utils/bonus'

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
