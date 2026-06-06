import type {
  FixtureDetails,
  ProviderFixture,
  ProviderGoalEvent,
  ProviderPlayer,
  ProviderTeam,
  ProviderTournament,
  SportsDataProvider,
} from './types'

const API_FOOTBALL_WORLD_CUP_LEAGUE_ID = 1

interface ApiFootballResponse<T> {
  response: T
  errors?: unknown
  paging?: {
    current: number
    total: number
  }
}

export class ApiFootballProvider implements SportsDataProvider {
  readonly name = 'api-football' as const

  constructor(private readonly apiKey: string) {}

  async getCoverage(tournament: ProviderTournament) {
    const data = await this.request<unknown[]>('/leagues', {
      id: String(API_FOOTBALL_WORLD_CUP_LEAGUE_ID),
      season: String(tournament.seasonYear),
    })

    return {
      available: data.response.length > 0,
      message: data.response.length > 0 ? 'API-Football zwraca MŚ dla podanego sezonu.' : 'Brak widocznego sezonu w darmowym kluczu.',
    }
  }

  async listTeams(tournament: ProviderTournament): Promise<ProviderTeam[]> {
    const data = await this.request<Array<{ team: { id: number; name: string; code?: string; logo?: string } }>>('/teams', {
      league: String(API_FOOTBALL_WORLD_CUP_LEAGUE_ID),
      season: String(tournament.seasonYear),
    })

    return data.response.map((item) => ({
      externalId: String(item.team.id),
      name: item.team.name,
      countryCode: item.team.code,
      logoUrl: item.team.logo,
    }))
  }

  async listFixtures(tournament: ProviderTournament): Promise<ProviderFixture[]> {
    const data = await this.request<Array<{
      fixture: { id: number; date: string; status: { short: string } }
      league: { round: string }
      teams: { home: { id: number }; away: { id: number } }
      score: { fulltime: { home: number | null; away: number | null } }
    }>>('/fixtures', {
      league: String(API_FOOTBALL_WORLD_CUP_LEAGUE_ID),
      season: String(tournament.seasonYear),
    })

    return data.response.map((item) => ({
      externalId: String(item.fixture.id),
      stageName: item.league.round,
      homeTeamExternalId: String(item.teams.home.id),
      awayTeamExternalId: String(item.teams.away.id),
      startsAtUtc: item.fixture.date,
      status: item.fixture.status.short,
      homeScore90: item.score.fulltime.home,
      awayScore90: item.score.fulltime.away,
    }))
  }

  async listPlayers(tournament: ProviderTournament, page = 1) {
    const data = await this.request<Array<{
      player: { id: number; name: string }
      statistics: Array<{ team: { id: number }; games: { position?: string } }>
    }>>('/players', {
      league: String(API_FOOTBALL_WORLD_CUP_LEAGUE_ID),
      season: String(tournament.seasonYear),
      page: String(page),
    })

    return {
      players: data.response.map((item) => ({
        externalId: String(item.player.id),
        teamExternalId: String(item.statistics[0]?.team.id ?? ''),
        name: item.player.name,
        position: item.statistics[0]?.games.position,
      })),
      nextPage: data.paging && data.paging.current < data.paging.total ? data.paging.current + 1 : null,
    }
  }

  async getFixtureDetails(fixtureExternalIds: string[]): Promise<FixtureDetails[]> {
    const fixtures = await Promise.all(
      fixtureExternalIds.map(async (fixtureExternalId) => {
        const data = await this.request<Array<{
          fixture: { id: number; date: string; status: { short: string } }
          league: { round: string }
          teams: { home: { id: number }; away: { id: number } }
          score: { fulltime: { home: number | null; away: number | null } }
        }>>('/fixtures', { id: fixtureExternalId })
        const item = data.response[0]

        if (!item) {
          throw new Error(`Fixture ${fixtureExternalId} not found in API-Football.`)
        }

        return {
          fixture: {
            externalId: String(item.fixture.id),
            stageName: item.league.round,
            homeTeamExternalId: String(item.teams.home.id),
            awayTeamExternalId: String(item.teams.away.id),
            startsAtUtc: item.fixture.date,
            status: item.fixture.status.short,
            homeScore90: item.score.fulltime.home,
            awayScore90: item.score.fulltime.away,
          },
          events: await this.getFixtureEvents(fixtureExternalId),
        }
      }),
    )

    return fixtures
  }

  async getFixtureEvents(fixtureExternalId: string): Promise<ProviderGoalEvent[]> {
    const data = await this.request<Array<{
      time: { elapsed: number; extra: number | null }
      team: { id: number }
      player: { id: number | null; name: string | null }
      type: string
      detail: string | null
    }>>('/fixtures/events', { fixture: fixtureExternalId })

    return data.response
      .filter((item) => item.type === 'Goal')
      .map((item, index) => ({
        externalId: `${fixtureExternalId}-${index}-${item.time.elapsed}-${item.player.id ?? 'unknown'}`,
        fixtureExternalId,
        minute: item.time.elapsed,
        extraMinute: item.time.extra,
        teamExternalId: String(item.team.id),
        playerExternalId: item.player.id === null ? null : String(item.player.id),
        playerName: item.player.name,
        detail: item.detail,
      }))
  }

  async getFixtureLineups(fixtureExternalId: string): Promise<ProviderPlayer[]> {
    const data = await this.request<Array<{
      team: { id: number }
      startXI: Array<{ player: { id: number; name: string; pos?: string } }>
      substitutes: Array<{ player: { id: number; name: string; pos?: string } }>
    }>>('/fixtures/lineups', { fixture: fixtureExternalId })

    return data.response.flatMap((lineup) =>
      [...lineup.startXI, ...lineup.substitutes].map((entry) => ({
        externalId: String(entry.player.id),
        teamExternalId: String(lineup.team.id),
        name: entry.player.name,
        position: entry.player.pos,
      })),
    )
  }

  private async request<T>(path: string, query: Record<string, string>) {
    if (!this.apiKey) {
      throw new Error('Missing API-Football key.')
    }

    const url = new URL(`https://v3.football.api-sports.io${path}`)
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value)
    }

    return await $fetch<ApiFootballResponse<T>>(url.toString(), {
      headers: {
        'x-apisports-key': this.apiKey,
      },
    })
  }
}
