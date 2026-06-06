import { existsSync, readFileSync } from 'node:fs'

const WORLD_CUP_LEAGUE_ID = '1'
const WORLD_CUP_SEASON = '2026'
const BASE_URL = 'https://v3.football.api-sports.io'

function loadLocalEnv() {
  if (!existsSync('.env.local')) {
    return
  }

  const content = readFileSync('.env.local', 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const separator = line.indexOf('=')
    if (separator === -1) {
      continue
    }

    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, '')
    if (key && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

async function request(path, params = {}) {
  const apiKey = process.env.API_FOOTBALL_KEY ?? process.env.NUXT_API_FOOTBALL_KEY
  if (!apiKey) {
    throw new Error('Missing API_FOOTBALL_KEY or NUXT_API_FOOTBALL_KEY in .env.local.')
  }

  const url = new URL(`${BASE_URL}${path}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url, {
    headers: {
      'x-apisports-key': apiKey,
    },
  })

  const body = await response.json()
  if (!response.ok) {
    return {
      ok: false,
      path,
      status: response.status,
      errors: body.errors ?? body,
    }
  }

  if (body.errors && Object.keys(body.errors).length > 0) {
    return {
      ok: false,
      path,
      status: response.status,
      errors: body.errors,
    }
  }

  return {
    ok: true,
    path,
    status: response.status,
    body,
  }
}

function groupBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item)
    acc.set(key, (acc.get(key) ?? 0) + 1)
    return acc
  }, new Map())
}

try {
  loadLocalEnv()

  const status = await request('/status')
  const leagues = await request('/leagues', {
    id: WORLD_CUP_LEAGUE_ID,
    season: WORLD_CUP_SEASON,
  })
  const teams = await request('/teams', {
    league: WORLD_CUP_LEAGUE_ID,
    season: WORLD_CUP_SEASON,
  })
  const fixtures = await request('/fixtures', {
    league: WORLD_CUP_LEAGUE_ID,
    season: WORLD_CUP_SEASON,
  })
  const rounds = await request('/fixtures/rounds', {
    league: WORLD_CUP_LEAGUE_ID,
    season: WORLD_CUP_SEASON,
  })
  const playersPageOne = await request('/players', {
    league: WORLD_CUP_LEAGUE_ID,
    season: WORLD_CUP_SEASON,
    page: '1',
  })

  const fixtureItems = fixtures.ok ? fixtures.body.response : []
  const fixturesByRound = groupBy(fixtureItems, (item) => item.league?.round ?? 'unknown')
  const statusSummary = groupBy(fixtureItems, (item) => item.fixture?.status?.short ?? 'unknown')

  const report = {
    target: {
      league: WORLD_CUP_LEAGUE_ID,
      season: WORLD_CUP_SEASON,
      expectedFixtures: 104,
    },
    status: status.ok
      ? {
          ok: true,
          requests: status.body.response?.requests ?? null,
        }
      : status,
    endpoints: {
      leagues: leagues.ok ? { ok: true, count: leagues.body.response.length } : leagues,
      teams: teams.ok ? { ok: true, count: teams.body.response.length } : teams,
      fixtures: fixtures.ok
        ? {
            ok: true,
            count: fixtureItems.length,
            allFixturesVisible: fixtureItems.length === 104,
            statuses: Object.fromEntries(statusSummary),
            byRound: Object.fromEntries(fixturesByRound),
            sample: fixtureItems.slice(0, 5).map((item) => ({
              id: item.fixture?.id,
              date: item.fixture?.date,
              round: item.league?.round,
              status: item.fixture?.status?.short,
              home: item.teams?.home?.name,
              away: item.teams?.away?.name,
            })),
          }
        : fixtures,
      rounds: rounds.ok ? { ok: true, count: rounds.body.response.length } : rounds,
      playersPageOne: playersPageOne.ok
        ? {
            ok: true,
            count: playersPageOne.body.response.length,
            pages: playersPageOne.body.paging?.total ?? null,
          }
        : playersPageOne,
    },
  }

  console.log(JSON.stringify(report, null, 2))
  if (!fixtures.ok || fixtureItems.length !== 104) {
    process.exitCode = 1
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
