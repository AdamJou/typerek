import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from '@vue/compiler-sfc'
import { describe, expect, it } from 'vitest'
import type {
  BonusQuestion,
  BonusStatisticsSnapshot,
  Player,
  Team,
  TournamentStage,
} from '~/types/domain'
import {
  normalizeBonusStatisticsSnapshot,
  resolveBonusStatisticsCards,
  statisticPercentage,
} from '~/utils/statistics'

describe('bonus statistics snapshot', () => {
  it('normalizes scorer and assist leader aggregates and drops malformed entries', () => {
    const snapshot = normalizeBonusStatisticsSnapshot({
      leagueId: 'league-1',
      generatedAt: '2026-06-11T20:00:00Z',
      memberCount: 14,
      statisticsJson: {
        version: 1,
        cards: [
          card('q05-top-scorer', 'Krol strzelcow', 'player', 12, [
            { key: 'player-1', count: 5 },
          ]),
          card('q06-top-assists', 'Krol asyst', 'player', 11, [
            { key: 'player-2', count: 4 },
          ]),
          { title: 'Brak sluga' },
        ],
      },
    })

    expect(snapshot.cards.map((item) => item.questionSlug)).toEqual([
      'q05-top-scorer',
      'q06-top-assists',
    ])
    expect(snapshot.cards[0]?.respondentCount).toBe(12)
    expect(snapshot.cards[1]?.options).toEqual([{
      key: 'player-2',
      count: 4,
      averagePosition: null,
    }])
  })

  it('keeps Top 4 average positions in the normalized snapshot', () => {
    const snapshot = normalizeBonusStatisticsSnapshot({
      leagueId: 'league-1',
      generatedAt: '2026-06-11T20:00:00Z',
      memberCount: 4,
      statisticsJson: {
        version: 2,
        cards: [{
          ...card('q24-top-four', 'Top 4', 'team', 4, [
            { key: 'france', count: 3, averagePosition: 1.67 },
          ]),
          section: 'featured',
        }],
      },
    })

    expect(snapshot.cards[0]?.options[0]?.averagePosition).toBe(1.67)
  })

  it('calculates percentages for attendance and handles no answers', () => {
    expect(statisticPercentage(12, 14)).toBe(86)
    expect(statisticPercentage(1, 3)).toBe(33)
    expect(statisticPercentage(0, 0)).toBe(0)
  })

  it('assigns a player national-team flag and sorts tied results by label', () => {
    const teams: Team[] = [
      team('france', 'France', 'fr'),
      team('spain', 'Spain', 'es'),
    ]
    const players: Player[] = [
      player('player-z', 'france', 'Zinedine TEST'),
      player('player-a', 'spain', 'Alvaro TEST'),
    ]
    const snapshot: BonusStatisticsSnapshot = {
      leagueId: 'league-1',
      generatedAt: '2026-06-11T20:00:00Z',
      memberCount: 3,
      version: 1,
      cards: [{
        questionSlug: 'q05-top-scorer',
        title: 'Krol strzelcow',
        entityType: 'player',
        metric: 'answer',
        section: 'awards',
        respondentCount: 2,
        options: [
          { key: 'player-z', count: 1 },
          { key: 'player-a', count: 1 },
        ],
      }],
    }

    const [resolved] = resolveBonusStatisticsCards(snapshot, [
      question('q05-top-scorer', 'player_single'),
    ], teams, players)

    expect(resolved?.options.map((option) => option.label)).toEqual(['A. TEST', 'Z. TEST'])
    expect(resolved?.options[0]?.percentage).toBe(50)
    expect(resolved?.options[0]?.flag?.alt).toBe('Hiszpania')
  })

  it('labels boolean and tournament-stage distributions', () => {
    const snapshot: BonusStatisticsSnapshot = {
      leagueId: 'league-1',
      generatedAt: '2026-06-11T20:00:00Z',
      memberCount: 3,
      version: 2,
      cards: [
        {
          questionSlug: 'q14-brazil-past-quarter-finals',
          title: 'Brazylia',
          entityType: 'choice',
          metric: 'answer',
          section: 'insights',
          respondentCount: 3,
          options: [{ key: 'true', count: 2 }, { key: 'false', count: 1 }],
        },
        {
          questionSlug: 'q03-spain-exit-stage',
          title: 'Hiszpania',
          entityType: 'choice',
          metric: 'answer',
          section: 'insights',
          respondentCount: 2,
          options: [{ key: 'quarter_finals', count: 2 }],
        },
      ],
    }
    const stages: TournamentStage[] = [{
      id: 'quarter-finals',
      tournamentId: 'tournament-1',
      code: 'quarter_finals',
      name: 'Cwiercfinal',
      shortName: '1/4',
      sortOrder: 7,
    }]
    const resolved = resolveBonusStatisticsCards(snapshot, [
      question('q14-brazil-past-quarter-finals', 'boolean'),
      question('q03-spain-exit-stage', 'team_stage_exit'),
    ], [], [], stages)

    expect(resolved[0]?.options.map((option) => option.label)).toEqual(['Tak', 'Nie'])
    expect(resolved[1]?.options[0]?.label).toBe('Ćwierćfinał')
  })

  it('keeps an answered question with no valid options as an empty distribution', () => {
    const snapshot = normalizeBonusStatisticsSnapshot({
      leagueId: 'league-1',
      generatedAt: '2026-06-11T20:00:00Z',
      memberCount: 4,
      statisticsJson: {
        cards: [card('q07-golden-glove', 'Zlota rekawica', 'player', 0, [])],
      },
    })

    expect(snapshot.cards[0]).toMatchObject({
      respondentCount: 0,
      options: [],
    })
  })
})

describe('bonus statistics migration', () => {
  const migration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/0010_bonus_statistics_snapshot.sql'),
    'utf8',
  )
  const refreshMigration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/0011_expand_bonus_statistics_snapshot.sql'),
    'utf8',
  )

  it('includes scorer, assist leader and all selected statistics', () => {
    for (const slug of [
      'q02-world-cup-winner',
      'q03-spain-exit-stage',
      'q05-top-scorer',
      'q06-top-assists',
      'q07-golden-glove',
      'q14-brazil-past-quarter-finals',
      'q18-england-over-6-group-goals',
      'q19-mbappe-vs-yamal',
      'q21-african-teams-from-groups',
      'q24-top-four',
      'q25-ronaldo-vs-messi-stage',
      'q29-hosts-out-of-groups',
      'q30-host-longest-run',
      'q34-kdb-vs-bfik-assists',
      'q37-japan-vs-korea',
    ]) {
      expect(migration).toContain(slug)
    }

    expect(migration).toContain("'%mvp%'")
    expect(migration).toContain("'%argent%belgi%'")
    expect(migration).toContain(
      'select distinct on (question.league_id, selected.logical_key)',
    )
  })

  it('deduplicates Top 4 teams per participant and stores average positions', () => {
    expect(migration).toContain('with ordinality as selected_team(option_key, position)')
    expect(migration).toContain('min(selected_team.position)::numeric as average_position')
    expect(migration).toContain("count(distinct user_id)::integer as answer_count")
    expect(migration).toContain("'averagePosition', option.average_position")
  })

  it('grants league members SELECT only and defines no refresh trigger', () => {
    expect(migration).toContain(
      'revoke all on table public.league_bonus_statistics from public, anon, authenticated;',
    )
    expect(migration).toContain(
      'grant select on table public.league_bonus_statistics to authenticated;',
    )
    expect(migration).toContain('app_private.is_league_member(league_id)')
    expect(migration).not.toMatch(/grant\s+(insert|update|delete)/i)
    expect(migration).not.toMatch(/create\s+trigger/i)
  })

  it('refreshes only the aggregate table after 0010 was already applied', () => {
    expect(refreshMigration).toContain('insert into public.league_bonus_statistics')
    expect(refreshMigration).toContain('on conflict (league_id) do update')
    expect(refreshMigration).not.toMatch(/(insert into|update|delete from) public\.bonus_predictions/i)
    expect(refreshMigration).not.toMatch(/(insert into|update|delete from) public\.bonus_questions/i)
    expect(refreshMigration).not.toMatch(/grant\s+(insert|update|delete)/i)
  })
})

describe('statistics Vue components', () => {
  it.each([
    'app/components/Statistics/StatisticsBarRow.vue',
    'app/components/Statistics/StatisticsDistributionCard.vue',
    'app/pages/statistics.vue',
  ])('parses %s', (path) => {
    const source = readFileSync(resolve(process.cwd(), path), 'utf8')
    const result = parse(source, { filename: path })

    expect(result.errors).toEqual([])
  })
})

function card(
  questionSlug: string,
  title: string,
  entityType: 'team' | 'player' | 'choice',
  respondentCount: number,
  options: Array<{ key: string; count: number; averagePosition?: number }>,
) {
  return {
    questionSlug,
    title,
    entityType,
    metric: questionSlug === 'q24-top-four' ? 'top4_presence' : 'answer',
    section: questionSlug === 'q24-top-four' ? 'featured' : 'awards',
    respondentCount,
    options,
  }
}

function team(id: string, name: string, flag: string): Team {
  return {
    id,
    tournamentId: 'tournament-1',
    name,
    countryCode: flag.toUpperCase(),
    flag,
  }
}

function player(id: string, teamId: string, name: string): Player {
  return {
    id,
    teamId,
    name,
    position: 'FW',
    active: true,
  }
}

function question(slug: string, kind: BonusQuestion['kind']): BonusQuestion {
  return {
    id: `${slug}-id`,
    leagueId: 'league-1',
    slug,
    title: slug,
    points: 20,
    deadlineAt: '2026-06-11T19:00:00Z',
    kind,
    sourceKind: 'players',
    configJson: {},
    correctOptionId: null,
  }
}
