import type {
  FixtureDetails,
  ProviderFixture,
  ProviderGoalEvent,
  ProviderPlayer,
  ProviderTeam,
  ProviderTournament,
  SportsDataProvider,
} from './types'

interface FootballDataMatch {
  id: number
  utcDate: string
  status: string
  stage: string
  homeTeam: { id: number; name: string; tla?: string }
  awayTeam: { id: number; name: string; tla?: string }
  score: { fullTime: { home: number | null; away: number | null } }
}

export class FootballDataProvider implements SportsDataProvider {
  readonly name = 'football-data' as const

  constructor(private readonly apiKey: string) {}

  async getCoverage() {
    return {
      available: true,
      message: 'football-data.org Free obejmuje World Cup jako terminarz i wyniki, bez strzelców/składów w darmowym fallbacku.',
    }
  }

  async listTeams(): Promise<ProviderTeam[]> {
    const data = await this.request<{ teams?: Array<{ id: number; name: string; tla?: string }> }>('/competitions/WC/teams')

    return (data.teams ?? []).map((team) => ({
      externalId: String(team.id),
      name: team.name,
      countryCode: team.tla,
    }))
  }

  async listFixtures(): Promise<ProviderFixture[]> {
    const data = await this.request<{ matches: FootballDataMatch[] }>('/competitions/WC/matches')

    return data.matches.map((match) => ({
      externalId: String(match.id),
      stageName: match.stage,
      homeTeamExternalId: String(match.homeTeam.id),
      awayTeamExternalId: String(match.awayTeam.id),
      startsAtUtc: match.utcDate,
      status: match.status,
      homeScore90: match.score.fullTime.home,
      awayScore90: match.score.fullTime.away,
    }))
  }

  async listPlayers(_tournament: ProviderTournament, _page = 1) {
    return {
      players: [],
      nextPage: null,
    }
  }

  async getFixtureDetails(fixtureExternalIds: string[]): Promise<FixtureDetails[]> {
    const fixtures = await this.listFixtures()
    return fixtureExternalIds.map((fixtureExternalId) => {
      const fixture = fixtures.find((candidate) => candidate.externalId === fixtureExternalId)

      if (!fixture) {
        throw new Error(`Fixture ${fixtureExternalId} not found in football-data.org.`)
      }

      return { fixture, events: [] }
    })
  }

  async getFixtureEvents(): Promise<ProviderGoalEvent[]> {
    return []
  }

  async getFixtureLineups(): Promise<ProviderPlayer[]> {
    return []
  }

  private async request<T>(path: string) {
    if (!this.apiKey) {
      throw new Error('Missing football-data.org key.')
    }

    return await $fetch<T>(`https://api.football-data.org/v4${path}`, {
      headers: {
        'X-Auth-Token': this.apiKey,
      },
    })
  }
}
