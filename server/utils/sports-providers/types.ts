export interface ProviderTournament {
  id: string
  slug: string
  seasonYear: number
}

export interface ProviderTeam {
  externalId: string
  name: string
  countryCode?: string
  logoUrl?: string
}

export interface ProviderPlayer {
  externalId: string
  teamExternalId: string
  name: string
  position?: string
}

export interface ProviderFixture {
  externalId: string
  stageName: string
  homeTeamExternalId: string
  awayTeamExternalId: string
  startsAtUtc: string
  status: string
  homeScore90: number | null
  awayScore90: number | null
}

export interface ProviderGoalEvent {
  externalId: string
  fixtureExternalId: string
  minute: number
  extraMinute: number | null
  teamExternalId: string
  playerExternalId: string | null
  playerName: string | null
  detail: string | null
}

export interface FixtureDetails {
  fixture: ProviderFixture
  events: ProviderGoalEvent[]
}

export interface SportsDataProvider {
  readonly name: 'api-football' | 'football-data' | 'manual'
  getCoverage(tournament: ProviderTournament): Promise<{ available: boolean; message: string }>
  listTeams(tournament: ProviderTournament): Promise<ProviderTeam[]>
  listFixtures(tournament: ProviderTournament): Promise<ProviderFixture[]>
  listPlayers(tournament: ProviderTournament, page?: number): Promise<{ players: ProviderPlayer[]; nextPage: number | null }>
  getFixtureDetails(fixtureExternalIds: string[]): Promise<FixtureDetails[]>
  getFixtureEvents(fixtureExternalId: string): Promise<ProviderGoalEvent[]>
  getFixtureLineups(fixtureExternalId: string): Promise<ProviderPlayer[]>
}
