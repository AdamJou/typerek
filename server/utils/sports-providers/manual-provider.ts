import type {
  FixtureDetails,
  ProviderGoalEvent,
  ProviderPlayer,
  ProviderTeam,
  ProviderTournament,
  SportsDataProvider,
} from './types'

export class ManualProvider implements SportsDataProvider {
  readonly name = 'manual' as const

  async getCoverage(_tournament: ProviderTournament) {
    return {
      available: true,
      message: 'Manualny fallback jest zawsze dostępny, ale wymaga panelu administratora do zawodników, wyników i pierwszego strzelca.',
    }
  }

  async listTeams(): Promise<ProviderTeam[]> {
    return []
  }

  async listFixtures() {
    return []
  }

  async listPlayers() {
    return {
      players: [] as ProviderPlayer[],
      nextPage: null,
    }
  }

  async getFixtureDetails(): Promise<FixtureDetails[]> {
    return []
  }

  async getFixtureEvents(): Promise<ProviderGoalEvent[]> {
    return []
  }

  async getFixtureLineups(): Promise<ProviderPlayer[]> {
    return []
  }
}
