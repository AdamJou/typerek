import { describe, expect, it } from 'vitest'
import { compareMatchesChronologically } from '~/utils/footballUi'

describe('compareMatchesChronologically', () => {
  it('sorts matches by kickoff before match number', () => {
    const matches = [
      { startsAtUtc: '2026-06-16T01:00:00Z', matchNumber: 38 },
      { startsAtUtc: '2026-06-15T16:00:00Z', matchNumber: 43 },
      { startsAtUtc: '2026-06-15T19:00:00Z', matchNumber: 37 },
    ]

    expect(matches.sort(compareMatchesChronologically).map((match) => match.matchNumber)).toEqual([43, 37, 38])
  })

  it('uses match number when kickoff times are equal', () => {
    const matches = [
      { startsAtUtc: '2026-06-16T01:00:00Z', matchNumber: 44 },
      { startsAtUtc: '2026-06-16T01:00:00Z', matchNumber: 38 },
    ]

    expect(matches.sort(compareMatchesChronologically).map((match) => match.matchNumber)).toEqual([38, 44])
  })
})
