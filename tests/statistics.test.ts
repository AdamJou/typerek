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
  classifyBonusStatisticSection,
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

  it('normalizes numeric distributions with averages, medians and numeric sorting', () => {
    const snapshot = normalizeBonusStatisticsSnapshot({
      leagueId: 'league-1',
      generatedAt: '2026-06-11T20:00:00Z',
      memberCount: 4,
      statisticsJson: {
        version: 3,
        cards: [{
          questionSlug: 'q09-direct-free-kick-goals',
          title: 'Ile goli z rzutow wolnych?',
          entityType: 'choice',
          metric: 'numeric_distribution',
          section: 'forecasts',
          respondentCount: 3,
          averageValue: 3.67,
          medianValue: 3,
          options: [
            { key: '10', count: 1 },
            { key: '2', count: 1 },
            { key: '3', count: 1 },
          ],
        }],
      },
    })
    const [resolved] = resolveBonusStatisticsCards(snapshot, [], [], [])

    expect(snapshot.version).toBe(3)
    expect(resolved).toMatchObject({
      averageValue: 3.67,
      medianValue: 3,
    })
    expect(resolved?.options.map((option) => option.key)).toEqual(['2', '3', '10'])
  })

  it('keeps missing numeric summaries null instead of coercing them to zero', () => {
    const snapshot = normalizeBonusStatisticsSnapshot({
      leagueId: 'league-1',
      generatedAt: '2026-06-11T20:00:00Z',
      memberCount: 4,
      statisticsJson: {
        version: 3,
        cards: [{
          questionSlug: 'q09-direct-free-kick-goals',
          title: 'Ile goli z rzutow wolnych?',
          entityType: 'choice',
          metric: 'numeric_distribution',
          section: 'forecasts',
          respondentCount: 0,
          averageValue: null,
          medianValue: null,
          options: [],
        }],
      },
    })

    expect(snapshot.cards[0]).toMatchObject({
      averageValue: null,
      medianValue: null,
    })
  })

  it('normalizes group consensus and applies the declared tie breakers', () => {
    const snapshot = normalizeBonusStatisticsSnapshot({
      leagueId: 'league-1',
      generatedAt: '2026-06-11T20:00:00Z',
      memberCount: 4,
      statisticsJson: {
        version: 3,
        cards: [{
          questionSlug: 'groups-stage-order',
          title: 'Typowanie grup',
          entityType: 'choice',
          metric: 'group_consensus',
          section: 'groups',
          respondentCount: 4,
          options: [],
          groups: [
            {
              groupCode: 'B',
              respondentCount: 3,
              teams: [],
            },
            {
              groupCode: 'A',
              respondentCount: 4,
              teams: [
                { key: 'team-b', averagePosition: 2, positionVotes: [2, 2, 0, 0] },
                { key: 'team-a', averagePosition: 2, positionVotes: [3, 2, 0, 0] },
                { key: 'team-c', averagePosition: 2, positionVotes: [3, 3, 0, 0] },
              ],
            },
          ],
        }],
      },
    })

    expect(snapshot.cards[0]?.groups?.map((group) => group.groupCode)).toEqual(['A', 'B'])
    expect(snapshot.cards[0]?.groups?.[0]?.teams.map((team) => team.key)).toEqual([
      'team-c',
      'team-a',
      'team-b',
    ])
    expect(snapshot.cards[0]?.groups?.[0]?.teams[0]?.positionVotes).toEqual([3, 3, 0, 0])
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

describe('bonus statistics classification', () => {
  it.each([
    ['q02-world-cup-winner', 'Kto wygra mundial?', 'team_single', 'featured'],
    ['q24-top-four', 'Top 4', 'ranked_top4', 'featured'],
    ['q05-top-scorer', 'Krol strzelcow', 'player_single', 'awards'],
    ['production-mvp', 'Kto zostanie MVP turnieju?', 'player_single', 'awards'],
    ['groups-stage-order', 'Typowanie grup', 'ranked_group_table', 'groups'],
    ['q17-bellingham-vs-wirtz', 'Bellingham czy Wirtz?', 'duel_player', 'duels'],
    ['q37-japan-vs-korea', 'Japonia czy Korea?', 'duel_team', 'duels'],
    ['q08-own-goals-vs-red-cards', 'Swojaki czy kartki?', 'comparison_numeric', 'duels'],
    ['q03-spain-exit-stage', 'Etap Hiszpanii', 'team_stage_exit', 'picks'],
    ['q16-most-cards-team', 'Druzyna z kartkami', 'team_single', 'picks'],
    ['q05-other-player', 'Wybierz zawodnika', 'player_single', 'picks'],
    ['q09-direct-free-kick-goals', 'Ile goli?', 'numeric', 'forecasts'],
    ['q10-ronaldo-goals', 'Ile goli Ronaldo?', 'player_numeric', 'forecasts'],
    ['q28-bosnia-group-points', 'Ile punktow Bosni?', 'team_numeric', 'forecasts'],
  ] as const)('classifies %s as %s', (slug, title, kind, expectedSection) => {
    expect(classifyBonusStatisticSection(question(slug, kind, title))).toBe(expectedSection)
  })

  it.each([
    ['q12-neymar-over-240-minutes', 'Czy Neymar rozegra wiecej niz 240 minut?'],
    ['q20-modric-goal', 'Czy Luka Modric zdobedzie gola?'],
    ['q33-chris-wood-goal', 'Czy Chris Wood strzeli bramke?'],
    ['q22-son-over-1-goal', 'Czy Heung Min Son zdobedzie wiecej niz 1 gola?'],
    ['q36-australia-win-any-match', 'Czy Australia wygra spotkanie?'],
    ['q39-ekstraklasa-goal-or-assist', 'Czy pilkarz z Ekstraklasy zdobedzie gola lub asyste?'],
  ])('keeps requested question %s in sentiments regardless of kind', (slug, title) => {
    expect(classifyBonusStatisticSection(question(slug, 'numeric', title))).toBe('sentiments')
  })

  it('recognizes Curacao and a production-only Haaland question without a known slug', () => {
    expect(classifyBonusStatisticSection(
      question('q04-curacao-group-points', 'team_numeric', 'Ile punktow zdobedzie Curacao?'),
    )).toBe('sentiments')
    expect(classifyBonusStatisticSection(
      question(
        'production-question-uuid',
        'comparison_numeric',
        'Czy Erling Haaland zdobędzie więcej goli na turnieju niż Uzbekistan?',
      ),
    )).toBe('sentiments')
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
  const allQuestionsMigration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/0012_all_bonus_statistics_snapshot.sql'),
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

  it('rebuilds version 3 from every locked bonus question without a slug allowlist', () => {
    expect(allQuestionsMigration).toContain('from public.bonus_questions as question')
    expect(allQuestionsMigration).toContain(
      'where clock_timestamp() >= coalesce(question.lock_at, question.deadline_at)',
    )
    expect(allQuestionsMigration).toContain("'version', 3")
    expect(allQuestionsMigration).not.toContain('selected_questions')

    for (const kind of [
      'boolean',
      'numeric',
      'player_numeric',
      'team_numeric',
      'team_single',
      'player_single',
      'team_stage_exit',
      'duel_player',
      'duel_team',
      'comparison_numeric',
      'ranked_top4',
      'ranked_group_table',
    ]) {
      expect(allQuestionsMigration).toContain(kind)
    }
  })

  it('classifies sentiments, numeric forecasts and groups in SQL', () => {
    for (const slug of [
      'q04-curacao-group-points',
      'q12-neymar-over-240-minutes',
      'q20-modric-goal',
      'q22-son-over-1-goal',
      'q33-chris-wood-goal',
      'q36-australia-win-any-match',
      'q39-ekstraklasa-goal-or-assist',
    ]) {
      expect(allQuestionsMigration).toContain(slug)
    }

    expect(allQuestionsMigration).toContain("lower(question.title) like '%haaland%'")
    expect(allQuestionsMigration).toContain("lower(question.title) like '%uzbek%'")
    expect(allQuestionsMigration).toContain("then 'numeric_distribution'")
    expect(allQuestionsMigration).toContain("then 'group_consensus'")
    expect(allQuestionsMigration).toContain("then 'sentiments'")
  })

  it('stores numeric summaries and deterministic group consensus', () => {
    expect(allQuestionsMigration).toContain('round(avg(numeric_value), 2) as average_value')
    expect(allQuestionsMigration).toContain('percentile_cont(0.5)')
    expect(allQuestionsMigration).toContain('with ordinality as selected_team(team_key, position)')
    expect(allQuestionsMigration).toContain('select count(distinct team_id)')
    expect(allQuestionsMigration).toContain('team.position_1_votes desc')
    expect(allQuestionsMigration).toContain('team.position_4_votes desc')
    expect(allQuestionsMigration).toContain("'positionVotes', jsonb_build_array(")
  })

  it('overwrites only the aggregate snapshot and leaves source data and RLS untouched', () => {
    expect(allQuestionsMigration).toContain('insert into public.league_bonus_statistics')
    expect(allQuestionsMigration).toContain('statistics_json = excluded.statistics_json')
    expect(allQuestionsMigration).not.toMatch(
      /(?:insert into|update|delete from)\s+public\.(?:bonus_questions|bonus_predictions|league_members)/i,
    )
    expect(allQuestionsMigration).not.toMatch(/(?:grant|revoke|create policy|alter table)/i)
    expect(allQuestionsMigration).not.toMatch(/create\s+trigger/i)
  })
})

describe('statistics Vue components', () => {
  it.each([
    'app/components/Statistics/StatisticsBarRow.vue',
    'app/components/Statistics/StatisticsCategoryTabs.vue',
    'app/components/Statistics/StatisticsDistributionCard.vue',
    'app/components/Statistics/StatisticsGroupConsensusCard.vue',
    'app/pages/statistics.vue',
  ])('parses %s', (path) => {
    const source = readFileSync(resolve(process.cwd(), path), 'utf8')
    const result = parse(source, { filename: path })

    expect(result.errors).toEqual([])
  })

  it('keeps category selection in the URL query', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/pages/statistics.vue'), 'utf8')

    expect(source).toContain('route.query.category')
    expect(source).toContain('category: activeCategory.value')
    expect(source).toContain('category,')
    expect(source).toContain('<StatisticsCategoryTabs')
    expect(source).toContain('<StatisticsGroupConsensusCard')
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

function question(
  slug: string,
  kind: BonusQuestion['kind'],
  title = slug,
): BonusQuestion {
  return {
    id: `${slug}-id`,
    leagueId: 'league-1',
    slug,
    title,
    points: 20,
    deadlineAt: '2026-06-11T19:00:00Z',
    kind,
    sourceKind: 'players',
    configJson: {},
    correctOptionId: null,
  }
}
