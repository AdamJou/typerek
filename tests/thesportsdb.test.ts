import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from '@vue/compiler-sfc'
import { describe, expect, it } from 'vitest'
import type {
  TheSportsDbEvent,
  TheSportsDbTimelineEvent,
} from '../server/utils/sports-providers/thesportsdb-provider'
import {
  buildTheSportsDbAuditDetails,
  buildTheSportsDbAuditSummary,
  normalizeGoalEvents,
  normalizeTheSportsDbText,
  type AuditMatchRecord,
  type AuditPlayerRecord,
  type AuditTeamRecord,
} from '../server/utils/thesportsdb-audit'

interface Fixture {
  event: TheSportsDbEvent
  timeline: TheSportsDbTimelineEvent[]
  lineup: Record<string, unknown>[]
  stats: Record<string, unknown>[]
}

const mexicoFixture = loadFixture('mexico-south-africa.json')
const koreaFixture = loadFixture('south-korea-czech-republic.json')

const teams: AuditTeamRecord[] = [
  team('mexico', 'Mexico'),
  team('south-africa', 'South Africa'),
  team('south-korea', 'Korea Republic'),
  team('czech-republic', 'Czechia'),
]

const matches: AuditMatchRecord[] = [
  match('match-1', 'mexico', 'south-africa', '2026-06-11T19:00:00.000Z', 1),
  match('match-2', 'south-korea', 'czech-republic', '2026-06-12T02:00:00.000Z', 2),
]

const players: AuditPlayerRecord[] = [
  player('quinones', 'mexico', 'Julián QUIÑONES'),
  player('jimenez', 'mexico', 'Raúl JIMÉNEZ'),
  player('krejci', 'czech-republic', 'Ladislav KREJČÍ'),
  player('hwang', 'south-korea', 'In-Beom HWANG'),
  player('oh', 'south-korea', 'Hyeon-Gyu OH'),
]

describe('TheSportsDB audit mapper', () => {
  it('maps the Mexico result and reports the missing second goal without guessing', () => {
    const audit = buildTheSportsDbAuditDetails({
      event: mexicoFixture.event,
      timeline: mexicoFixture.timeline,
      lineup: mexicoFixture.lineup,
      stats: mexicoFixture.stats,
      teams,
      matches,
      players,
    })

    expect(audit.match).toMatchObject({
      status: 'matched',
      internalMatchId: 'match-1',
      matchedBy: 'teams_and_kickoff',
      kickoffDifferenceMinutes: 0,
    })
    expect(audit.homeTeam.internalTeamId).toBe('mexico')
    expect(audit.awayTeam.internalTeamId).toBe('south-africa')
    expect(audit.goals).toHaveLength(1)
    expect(audit.goals[0]).toMatchObject({
      sequence: 1,
      minute: 9,
      externalPlayerName: 'Julián Quiñones',
      internalTeamId: 'mexico',
      player: {
        status: 'matched',
        internalPlayerId: 'quinones',
      },
    })
    expect(audit.goalCoverage).toEqual({
      expectedHome: 2,
      returnedHome: 1,
      missingHome: 1,
      expectedAway: 0,
      returnedAway: 0,
      missingAway: 0,
      unknownTeamGoals: 0,
    })
    expect(audit.auditStatus).toBe('partial')
    expect(audit.firstScorerCertain).toBe(false)
    expect(audit.warnings.join(' ')).toContain('Timeline jest niekompletny')
  })

  it('maps team aliases and exposes the incomplete Korea-Czech Republic timeline', () => {
    const audit = buildTheSportsDbAuditDetails({
      event: koreaFixture.event,
      timeline: koreaFixture.timeline,
      lineup: koreaFixture.lineup,
      stats: koreaFixture.stats,
      teams,
      matches,
      players,
    })

    expect(audit.homeTeam).toMatchObject({
      status: 'matched',
      matchedBy: 'alias',
      internalTeamId: 'south-korea',
    })
    expect(audit.awayTeam).toMatchObject({
      status: 'matched',
      matchedBy: 'alias',
      internalTeamId: 'czech-republic',
    })
    expect(audit.goals[0]).toMatchObject({
      minute: 59,
      teamSide: 'away',
      player: {
        status: 'matched',
        internalPlayerId: 'krejci',
      },
    })
    expect(audit.goalCoverage).toMatchObject({
      expectedHome: 2,
      returnedHome: 0,
      missingHome: 2,
      expectedAway: 1,
      returnedAway: 1,
      missingAway: 0,
    })
    expect(audit.auditStatus).toBe('partial')
  })

  it('uses a future direct provider event ID before team and kickoff matching', () => {
    const directMatch: AuditMatchRecord = {
      ...matches[0]!,
      id: 'direct-match',
      provider: 'thesportsdb',
      externalId: '2391728',
      startsAtUtc: '2026-06-11T23:00:00.000Z',
    }
    const summary = buildTheSportsDbAuditSummary(mexicoFixture.event, {
      teams,
      matches: [matches[0]!, directMatch],
    })

    expect(summary.match).toMatchObject({
      status: 'matched',
      matchedBy: 'external_id',
      internalMatchId: 'direct-match',
    })
  })

  it('sorts goals by minute, added time and source order', () => {
    const event: TheSportsDbEvent = {
      ...mexicoFixture.event,
      intHomeScore: 3,
      intAwayScore: 1,
    }
    const timeline: TheSportsDbTimelineEvent[] = [
      goalEvent('goal-4', '45+2', '134497', 'Raúl Jiménez'),
      goalEvent('goal-2', '45+1', '134497', 'Julián Quiñones'),
      goalEvent('goal-1', '45', '136482', 'Teboho Mokoena'),
      goalEvent('goal-3', '45+1', '134497', 'Raúl Jiménez'),
    ]
    const homeTeam = buildTheSportsDbAuditSummary(event, { teams, matches }).homeTeam
    const awayTeam = buildTheSportsDbAuditSummary(event, { teams, matches }).awayTeam
    const goals = normalizeGoalEvents(event, timeline, homeTeam, awayTeam, players)

    expect(goals.map((goal) => [goal.timelineId, goal.minuteLabel])).toEqual([
      ['goal-1', "45'"],
      ['goal-2', "45+1'"],
      ['goal-3', "45+1'"],
      ['goal-4', "45+2'"],
    ])
  })

  it('leaves an ambiguous player unresolved instead of selecting one', () => {
    const event: TheSportsDbEvent = {
      ...mexicoFixture.event,
      intHomeScore: 1,
      intAwayScore: 0,
    }
    const timeline = [
      goalEvent('ambiguous-goal', '10', '134497', 'Jan Novak'),
    ]
    const audit = buildTheSportsDbAuditDetails({
      event,
      timeline,
      lineup: [],
      stats: [],
      teams,
      matches,
      players: [
        player('jan-1', 'mexico', 'Jan Adam Novak'),
        player('jan-2', 'mexico', 'Jan Piotr Novak'),
      ],
    })

    expect(audit.goals[0]?.player).toMatchObject({
      status: 'ambiguous',
      internalPlayerId: null,
    })
    expect(audit.goals[0]?.player.candidates).toHaveLength(2)
    expect(audit.auditStatus).toBe('partial')
  })

  it('handles empty optional data and can mark a complete scoreless match', () => {
    const event: TheSportsDbEvent = {
      ...mexicoFixture.event,
      intHomeScore: 0,
      intAwayScore: 0,
    }
    const audit = buildTheSportsDbAuditDetails({
      event,
      timeline: [],
      lineup: [],
      stats: [],
      teams,
      matches,
      players: [],
    })

    expect(audit.goals).toEqual([])
    expect(audit.lineupCount).toBe(0)
    expect(audit.statsCount).toBe(0)
    expect(audit.auditStatus).toBe('complete')
    expect(audit.firstScorerCertain).toBe(false)
  })

  it('normalizes diacritics, punctuation and name order tokens', () => {
    expect(normalizeTheSportsDbText('  Ladislav KREJČÍ ')).toBe('ladislav krejci')
    expect(normalizeTheSportsDbText('Hyeon-Gyu OH')).toBe('hyeon gyu oh')

    const event: TheSportsDbEvent = {
      ...mexicoFixture.event,
      intHomeScore: 1,
      intAwayScore: 0,
    }
    const audit = buildTheSportsDbAuditDetails({
      event,
      timeline: [goalEvent('ordered-name', '12', '134497', 'Quiñones Julián')],
      lineup: [],
      stats: [],
      teams,
      matches,
      players,
    })

    expect(audit.goals[0]?.player).toMatchObject({
      status: 'matched',
      matchedBy: 'name_tokens',
      internalPlayerId: 'quinones',
    })
  })

  it('uses the provider alternate player name when the timeline name is abbreviated', () => {
    const event: TheSportsDbEvent = {
      ...mexicoFixture.event,
      intHomeScore: 1,
      intAwayScore: 0,
    }
    const audit = buildTheSportsDbAuditDetails({
      event,
      timeline: [{
        ...goalEvent('alternate-name', '12', '134497', 'J. Gomez'),
        strPlayerAlternate: 'Jose Luis Gomez',
      }],
      lineup: [],
      stats: [],
      teams,
      matches,
      players: [player('gomez', 'mexico', 'Jose Luis Gomez')],
    })

    expect(audit.goals[0]?.player).toMatchObject({
      status: 'matched',
      matchedBy: 'exact_name',
      internalPlayerId: 'gomez',
    })
  })
})

describe('TheSportsDB admin integration', () => {
  const endpointFiles = [
    'server/api/admin/thesportsdb/results.get.ts',
    'server/api/admin/thesportsdb/events/[id].get.ts',
    'server/utils/admin-read-client.ts',
    'server/utils/thesportsdb-audit-db.ts',
  ]

  it('requires a verified Supabase administrator', () => {
    const authSource = readFileSync(
      resolve(process.cwd(), 'server/utils/admin-read-client.ts'),
      'utf8',
    )

    expect(authSource).toContain('client.auth.getUser(accessToken)')
    expect(authSource).toContain(".select('user_id, is_admin')")
    expect(authSource).toContain('admin_required')
    expect(authSource).toContain('not_authenticated')
  })

  it('contains no database mutation path', () => {
    const source = endpointFiles
      .map((path) => readFileSync(resolve(process.cwd(), path), 'utf8'))
      .join('\n')

    expect(source).not.toMatch(/\.(?:insert|update|upsert|delete|rpc)\s*\(/)
    expect(source).not.toMatch(/(?:insert into|update\s+public\.|delete from|on conflict)/i)
  })

  it('sets no-store and uses the private runtime key', () => {
    const endpoints = endpointFiles.slice(0, 2)
      .map((path) => readFileSync(resolve(process.cwd(), path), 'utf8'))
      .join('\n')
    const config = readFileSync(resolve(process.cwd(), 'nuxt.config.ts'), 'utf8')

    expect(endpoints.match(/Cache-Control/g)).toHaveLength(2)
    expect(endpoints).toContain("config.theSportsDbApiKey || '123'")
    expect(config).toContain("envValue('NUXT_THESPORTSDB_API_KEY', 'THESPORTSDB_API_KEY') || '123'")
  })

  it.each([
    'app/components/Admin/AdminTheSportsDbAuditCard.vue',
    'app/pages/admin/thesportsdb.vue',
    'app/pages/admin/sync.vue',
  ])('parses %s', (path) => {
    const source = readFileSync(resolve(process.cwd(), path), 'utf8')
    const result = parse(source, { filename: path })

    expect(result.errors).toEqual([])
  })

  it('keeps the fallback read-only and redirects its former page', () => {
    const page = readFileSync(resolve(process.cwd(), 'app/pages/admin/thesportsdb.vue'), 'utf8')
    const card = readFileSync(
      resolve(process.cwd(), 'app/components/Admin/AdminTheSportsDbAuditCard.vue'),
      'utf8',
    )

    expect(page).toContain("navigateTo('/admin/worldcup26'")
    expect(card).toContain('Pobierz szczegóły i timeline')
    expect(`${page}\n${card}`).not.toMatch(/Zapisz wynik|setMatchResult|upsert/i)
  })
})

function loadFixture(filename: string): Fixture {
  return JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'tests/fixtures/thesportsdb', filename),
      'utf8',
    ),
  ) as Fixture
}

function team(id: string, name: string): AuditTeamRecord {
  return {
    id,
    name,
    provider: 'openfootball',
    externalId: id.toUpperCase(),
  }
}

function match(
  id: string,
  homeTeamId: string,
  awayTeamId: string,
  startsAtUtc: string,
  matchNumber: number,
): AuditMatchRecord {
  return {
    id,
    provider: 'openfootball',
    externalId: `openfootball:2026:${matchNumber}`,
    homeTeamId,
    awayTeamId,
    startsAtUtc,
    status: 'scheduled',
    homeScore90: null,
    awayScore90: null,
    resultConfirmedAt: null,
    matchNumber,
  }
}

function player(id: string, teamId: string, name: string): AuditPlayerRecord {
  return {
    id,
    teamId,
    name,
  }
}

function goalEvent(
  idTimeline: string,
  minute: string,
  idTeam: string,
  strPlayer: string,
): TheSportsDbTimelineEvent {
  return {
    idTimeline,
    strTimeline: 'Goal',
    strTimelineDetail: 'Normal Goal',
    intTime: minute,
    idTeam,
    strTeam: idTeam === '134497' ? 'Mexico' : 'South Africa',
    strPlayer,
  }
}
