import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from '@vue/compiler-sfc'
import { describe, expect, it } from 'vitest'
import type { WorldCup26Game } from '../server/utils/sports-providers/worldcup26-provider'
import {
  buildWorldCup26AuditDetails,
  buildWorldCup26AuditSummary,
  normalizeWorldCup26Goals,
  parseWorldCup26Scorers,
  type ParsedWorldCup26Scorer,
} from '../server/utils/worldcup26-audit'
import type {
  AuditMatchRecord,
  AuditPlayerRecord,
  AuditTeamRecord,
} from '../server/utils/thesportsdb-audit'

const mexicoGame = loadFixture('mexico-south-africa.json')
const koreaGame = loadFixture('south-korea-czech-republic.json')

const teams: AuditTeamRecord[] = [
  team('canada', 'Canada'),
  team('bosnia', 'Bosnia & Herzegovina'),
  team('mexico', 'Mexico'),
  team('south-africa', 'South Africa'),
  team('south-korea', 'Korea Republic'),
  team('czech-republic', 'Czechia'),
]

const matches: AuditMatchRecord[] = [
  match('match-3', 'canada', 'bosnia', 3),
  match('match-1', 'mexico', 'south-africa', 1),
  match('match-2', 'south-korea', 'czech-republic', 2),
]

const players: AuditPlayerRecord[] = [
  player('quinones', 'mexico', 'Julián QUIÑONES'),
  player('jimenez', 'mexico', 'Raúl JIMÉNEZ'),
  player('krejci', 'czech-republic', 'Ladislav KREJČÍ'),
  player('hwang', 'south-korea', 'In-Beom HWANG'),
  player('oh', 'south-korea', 'Hyeon-Gyu OH'),
]

describe('WorldCup26 audit mapper', () => {
  it('maps the complete Mexico result and both scorers in order', () => {
    const audit = buildWorldCup26AuditDetails({
      game: mexicoGame,
      teams,
      matches,
      players,
    })

    expect(audit.match).toMatchObject({
      status: 'matched',
      matchedBy: 'match_number',
      internalMatchId: 'match-1',
    })
    expect(audit.goals.map(goal => [
      goal.sequence,
      goal.minuteLabel,
      goal.externalPlayerName,
      goal.player.internalPlayerId,
    ])).toEqual([
      [1, "9'", 'J. Quiñones', 'quinones'],
      [2, "67'", 'R. Jiménez', 'jimenez'],
    ])
    expect(audit.goalCoverage).toMatchObject({
      expectedHome: 2,
      returnedHome: 2,
      missingHome: 0,
      expectedAway: 0,
      returnedAway: 0,
      missingAway: 0,
    })
    expect(audit.auditStatus).toBe('complete')
    expect(audit.firstScorerCertain).toBe(true)
  })

  it('uses aliases and maps all abbreviated Korea-Czech Republic scorers', () => {
    const audit = buildWorldCup26AuditDetails({
      game: koreaGame,
      teams,
      matches,
      players,
    })

    expect(audit.homeTeam).toMatchObject({
      matchedBy: 'alias',
      internalTeamId: 'south-korea',
    })
    expect(audit.awayTeam).toMatchObject({
      matchedBy: 'alias',
      internalTeamId: 'czech-republic',
    })
    expect(audit.goals.map(goal => [
      goal.minute,
      goal.teamSide,
      goal.player.internalPlayerId,
      goal.player.matchedBy,
    ])).toEqual([
      [59, 'away', 'krejci', 'initials_and_surname'],
      [67, 'home', 'hwang', 'initials_and_surname'],
      [80, 'home', 'oh', 'initials_and_surname'],
    ])
    expect(audit.auditStatus).toBe('complete')
  })

  it('parses null, quote variants, added time, penalties and own goals', () => {
    expect(parseWorldCup26Scorers('null', 'home')).toEqual([])
    expect(parseWorldCup26Scorers(null, 'away')).toEqual([])

    const scorers = parseWorldCup26Scorers(
      `{"A. Player 45+2' (P)",“B. Player 90' (O.G.)”}`,
      'home',
    )

    expect(scorers).toEqual([
      expect.objectContaining({
        playerName: 'A. Player',
        minute: 45,
        extraMinute: 2,
        penalty: true,
        ownGoal: false,
      }),
      expect.objectContaining({
        playerName: 'B. Player',
        minute: 90,
        extraMinute: null,
        penalty: false,
        ownGoal: true,
      }),
    ])
  })

  it('orders equal-minute cross-team goals home first and marks the source ambiguity', () => {
    const tiedGame: WorldCup26Game = {
      ...mexicoGame,
      home_score: '1',
      away_score: '1',
      home_scorers: `{"J. Quiñones 45'"}`,
      away_scorers: `{"T. Mokoena 45'"}`,
    }
    const audit = buildWorldCup26AuditDetails({
      game: tiedGame,
      teams,
      matches,
      players: [
        ...players,
        player('mokoena', 'south-africa', 'Teboho MOKOENA'),
      ],
    })

    expect(audit.goals.map(goal => goal.teamSide)).toEqual(['home', 'away'])
    expect(audit.sourceOrderTie).toBe(true)
    expect(audit.firstScorerCertain).toBe(false)
    expect(audit.warnings.join(' ')).toContain('gospodarzy przed gośćmi')
  })

  it('marks scorer count mismatches and missing minutes as partial', () => {
    const incompleteGame: WorldCup26Game = {
      ...mexicoGame,
      home_scorers: `{"J. Quiñones"}`,
    }
    const audit = buildWorldCup26AuditDetails({
      game: incompleteGame,
      teams,
      matches,
      players,
    })

    expect(audit.auditStatus).toBe('partial')
    expect(audit.goalCoverage.missingHome).toBe(1)
    expect(audit.goals[0]?.minute).toBeNull()
    expect(audit.warnings.join(' ')).toContain('nie ma poprawnej minuty')
  })

  it('accepts a complete scoreless match', () => {
    const scorelessGame: WorldCup26Game = {
      ...mexicoGame,
      home_score: '0',
      away_score: '0',
      home_scorers: 'null',
      away_scorers: '',
      finished: 'TRUE',
    }
    const audit = buildWorldCup26AuditDetails({
      game: scorelessGame,
      teams,
      matches,
      players: [],
    })

    expect(audit.goals).toEqual([])
    expect(audit.auditStatus).toBe('complete')
    expect(audit.firstScorerCertain).toBe(false)
  })

  it('maps the unfinished Canada-Bosnia game without treating 0:0 as final', () => {
    const game: WorldCup26Game = {
      _id: '679c9c8a5749c4077500e003',
      id: '3',
      home_team_id: '5',
      away_team_id: '6',
      home_score: '0',
      away_score: '0',
      home_scorers: 'null',
      away_scorers: 'null',
      local_date: '06/12/2026 15:00',
      finished: 'FALSE',
      time_elapsed: 'notstarted',
      type: 'group',
      home_team_name_en: 'Canada',
      away_team_name_en: 'Bosnia and Herzegovina',
    }
    const audit = buildWorldCup26AuditDetails({
      game,
      teams,
      matches,
      players: [],
    })

    expect(audit.homeTeam).toMatchObject({
      status: 'matched',
      internalTeamId: 'canada',
    })
    expect(audit.awayTeam).toMatchObject({
      status: 'matched',
      matchedBy: 'alias',
      internalTeamId: 'bosnia',
    })
    expect(audit.match).toMatchObject({
      status: 'matched',
      matchedBy: 'match_number',
      internalMatchId: 'match-3',
    })
    expect(audit.goals).toEqual([])
    expect(audit.auditStatus).toBe('partial')
    expect(audit.warnings.join(' ')).toContain('Mecz nie jest zakończony')
  })

  it('does not select an ambiguous initials-and-surname match', () => {
    const game: WorldCup26Game = {
      ...mexicoGame,
      home_score: '1',
      home_scorers: `{"J. Gomez 10'"}`,
    }
    const audit = buildWorldCup26AuditDetails({
      game,
      teams,
      matches,
      players: [
        player('gomez-1', 'mexico', 'Juan GOMEZ'),
        player('gomez-2', 'mexico', 'Jose GOMEZ'),
      ],
    })

    expect(audit.goals[0]?.player).toMatchObject({
      status: 'ambiguous',
      internalPlayerId: null,
    })
    expect(audit.auditStatus).toBe('partial')
  })

  it('verifies match-number teams and falls back to a unique team pair', () => {
    const mismatchedNumber = match('wrong-number', 'south-korea', 'czech-republic', 1)
    const correctPair = match('correct-pair', 'mexico', 'south-africa', 88)
    const summary = buildWorldCup26AuditSummary(mexicoGame, {
      teams,
      matches: [mismatchedNumber, correctPair],
    })

    expect(summary.match).toMatchObject({
      status: 'matched',
      matchedBy: 'teams',
      internalMatchId: 'correct-pair',
    })
    expect(summary.warnings.join(' ')).toContain('Numer meczu wskazuje rekord z innymi drużynami')
  })

  it('maps an own-goal player against the opposite representation', () => {
    const parsed: ParsedWorldCup26Scorer[] = [{
      playerName: 'T. Mokoena',
      minute: 12,
      extraMinute: null,
      teamSide: 'home',
      ownGoal: true,
      penalty: false,
      detail: 'O.G.',
      raw: "T. Mokoena 12' (O.G.)",
      sourceIndex: 0,
    }]
    const summary = buildWorldCup26AuditSummary(mexicoGame, { teams, matches })
    const goals = normalizeWorldCup26Goals(
      mexicoGame,
      parsed,
      summary.homeTeam,
      summary.awayTeam,
      [player('mokoena', 'south-africa', 'Teboho MOKOENA')],
    )

    expect(goals[0]).toMatchObject({
      teamSide: 'home',
      internalTeamId: 'mexico',
      player: {
        status: 'matched',
        internalPlayerId: 'mokoena',
      },
    })
  })
})

describe('WorldCup26 admin integration', () => {
  const endpointFiles = [
    'server/api/admin/worldcup26/results.get.ts',
    'server/api/admin/worldcup26/events/[id].get.ts',
    'server/utils/admin-read-client.ts',
    'server/utils/thesportsdb-audit-db.ts',
  ]

  it('uses the protected read-only client and contains no database mutation path', () => {
    const source = endpointFiles
      .map(path => readFileSync(resolve(process.cwd(), path), 'utf8'))
      .join('\n')

    expect(source).toContain('requireAdminReadClient')
    expect(source).not.toMatch(/\.(?:insert|update|upsert|delete|rpc)\s*\(/)
    expect(source).not.toMatch(/(?:insert into|update\s+public\.|delete from|on conflict)/i)
  })

  it('uses /get/games for list and detail lookup with private optional auth', () => {
    const provider = readFileSync(
      resolve(process.cwd(), 'server/utils/sports-providers/worldcup26-provider.ts'),
      'utf8',
    )
    const config = readFileSync(resolve(process.cwd(), 'nuxt.config.ts'), 'utf8')

    expect(provider).toContain("this.request<GamesResponse>('/get/games')")
    expect(provider).not.toContain('/get/game/')
    expect(provider).toContain('headers.Authorization = `Bearer ${this.token}`')
    expect(config).toContain("envValue('WORLDCUP26_API_BASE_URL')")
    expect(config).toContain("envValue('WORLDCUP26_API_TOKEN')")
  })

  it('sets no-store on both endpoints', () => {
    const endpoints = endpointFiles.slice(0, 2)
      .map(path => readFileSync(resolve(process.cwd(), path), 'utf8'))
      .join('\n')

    expect(endpoints.match(/Cache-Control/g)).toHaveLength(2)
  })

  it.each([
    'app/components/Admin/AdminWorldCup26AuditCard.vue',
    'app/pages/admin/worldcup26.vue',
    'app/pages/admin/thesportsdb.vue',
    'app/pages/admin/sync.vue',
  ])('parses %s', (path) => {
    const source = readFileSync(resolve(process.cwd(), path), 'utf8')
    const result = parse(source, { filename: path })

    expect(result.errors).toEqual([])
  })

  it('keeps fetching manual, redirects the old page and exposes no save action', () => {
    const page = readFileSync(resolve(process.cwd(), 'app/pages/admin/worldcup26.vue'), 'utf8')
    const oldPage = readFileSync(resolve(process.cwd(), 'app/pages/admin/thesportsdb.vue'), 'utf8')
    const card = readFileSync(
      resolve(process.cwd(), 'app/components/Admin/AdminWorldCup26AuditCard.vue'),
      'utf8',
    )

    expect(page).toContain('@click="loadResults"')
    expect(page).not.toMatch(/onMounted|immediate:\s*true/)
    expect(oldPage).toContain("navigateTo('/admin/worldcup26'")
    expect(`${page}\n${card}`).not.toMatch(/Zapisz wynik|setMatchResult|upsert/i)
  })
})

function loadFixture(filename: string): WorldCup26Game {
  return JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'tests/fixtures/worldcup26', filename),
      'utf8',
    ),
  ) as WorldCup26Game
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
  matchNumber: number,
): AuditMatchRecord {
  return {
    id,
    provider: 'openfootball',
    externalId: `openfootball:2026:${matchNumber}`,
    homeTeamId,
    awayTeamId,
    startsAtUtc: `2026-06-${String(10 + matchNumber).padStart(2, '0')}T19:00:00.000Z`,
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
