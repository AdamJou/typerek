import { describe, expect, it } from 'vitest'
import { compareMatchesChronologically, isUpcomingMatch, isUpcomingMatchToday, isUpcomingMatchWithinHours } from '~/utils/footballUi'

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

describe('isUpcomingMatch', () => {
  const now = new Date(2026, 5, 24, 20, 0, 0)

  function kickoffAt(date: Date) {
    return date.toISOString()
  }

  it('includes scheduled matches from now through the end of tomorrow', () => {
    expect(
      isUpcomingMatch(
        {
          startsAtUtc: kickoffAt(new Date(2026, 5, 24, 20, 0, 0)),
          status: 'scheduled',
        },
        now,
      ),
    ).toBe(true)
    expect(
      isUpcomingMatch(
        {
          startsAtUtc: kickoffAt(new Date(2026, 5, 25, 23, 59, 59, 999)),
          status: 'scheduled',
        },
        now,
      ),
    ).toBe(true)
  })

  it('keeps already started unsettled matches visible until they are confirmed', () => {
    expect(
      isUpcomingMatch(
        {
          startsAtUtc: kickoffAt(new Date(2026, 5, 24, 19, 59, 59, 999)),
          status: 'scheduled',
        },
        now,
      ),
    ).toBe(true)
    expect(
      isUpcomingMatch(
        {
          startsAtUtc: kickoffAt(new Date(2026, 5, 24, 19, 59, 59, 999)),
          status: 'live',
        },
        now,
      ),
    ).toBe(true)
    expect(
      isUpcomingMatch(
        {
          startsAtUtc: kickoffAt(new Date(2026, 5, 24, 18, 0, 0)),
          status: 'finished',
        },
        now,
      ),
    ).toBe(true)
    expect(
      isUpcomingMatch(
        {
          startsAtUtc: kickoffAt(new Date(2026, 5, 24, 18, 0, 0)),
          status: 'confirmed',
        },
        now,
      ),
    ).toBe(false)
    expect(
      isUpcomingMatch(
        {
          startsAtUtc: kickoffAt(new Date(2026, 5, 24, 18, 0, 0)),
          status: 'finished',
          resultConfirmedAt: kickoffAt(new Date(2026, 5, 24, 20, 10, 0)),
        },
        now,
      ),
    ).toBe(false)
  })

  it('excludes matches after tomorrow and future non-scheduled matches', () => {
    expect(
      isUpcomingMatch(
        {
          startsAtUtc: kickoffAt(new Date(2026, 5, 26, 0, 0, 0)),
          status: 'scheduled',
        },
        now,
      ),
    ).toBe(false)
    expect(
      isUpcomingMatch(
        {
          startsAtUtc: kickoffAt(new Date(2026, 5, 24, 21, 0, 0)),
          status: 'live',
        },
        now,
      ),
    ).toBe(false)
  })
})

describe('isUpcomingMatchWithinHours', () => {
  const now = new Date('2026-06-24T18:00:00.000Z')

  it('includes scheduled matches from now through the selected hour threshold', () => {
    expect(
      isUpcomingMatchWithinHours(
        {
          startsAtUtc: '2026-06-24T18:00:00.000Z',
          status: 'scheduled',
        },
        24,
        now,
      ),
    ).toBe(true)
    expect(
      isUpcomingMatchWithinHours(
        {
          startsAtUtc: '2026-06-25T18:00:00.000Z',
          status: 'scheduled',
        },
        24,
        now,
      ),
    ).toBe(true)
  })

  it('excludes matches outside the selected hour threshold', () => {
    expect(
      isUpcomingMatchWithinHours(
        {
          startsAtUtc: '2026-06-25T18:00:00.001Z',
          status: 'scheduled',
        },
        24,
        now,
      ),
    ).toBe(false)
  })

  it('keeps already started unsettled matches visible outside the hour threshold', () => {
    expect(
      isUpcomingMatchWithinHours(
        {
          startsAtUtc: '2026-06-24T16:00:00.000Z',
          status: 'live',
        },
        24,
        now,
      ),
    ).toBe(true)
    expect(
      isUpcomingMatchWithinHours(
        {
          startsAtUtc: '2026-06-24T16:00:00.000Z',
          status: 'finished',
          resultConfirmedAt: '2026-06-24T18:10:00.000Z',
        },
        24,
        now,
      ),
    ).toBe(false)
  })
})

describe('isUpcomingMatchToday', () => {
  const now = new Date(2026, 5, 24, 20, 0, 0)

  function kickoffAt(date: Date) {
    return date.toISOString()
  }

  it('includes scheduled matches later today and already started unsettled matches', () => {
    expect(
      isUpcomingMatchToday(
        {
          startsAtUtc: kickoffAt(new Date(2026, 5, 24, 20, 0, 0)),
          status: 'scheduled',
        },
        now,
      ),
    ).toBe(true)

    expect(
      isUpcomingMatchToday(
        {
          startsAtUtc: kickoffAt(new Date(2026, 5, 24, 19, 59, 59, 999)),
          status: 'live',
        },
        now,
      ),
    ).toBe(true)

    expect(
      isUpcomingMatchToday(
        {
          startsAtUtc: kickoffAt(new Date(2026, 5, 23, 23, 30, 0)),
          status: 'finished',
        },
        now,
      ),
    ).toBe(true)

    expect(
      isUpcomingMatchToday(
        {
          startsAtUtc: kickoffAt(new Date(2026, 5, 25, 0, 0, 0)),
          status: 'scheduled',
        },
        now,
      ),
    ).toBe(false)
  })
})
