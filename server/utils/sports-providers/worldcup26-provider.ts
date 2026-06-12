const DEFAULT_WORLD_CUP_26_BASE_URL = 'https://worldcup26.ir'

export const WORLD_CUP_2026_EXPECTED_MATCHES = 104

export interface WorldCup26Game extends Record<string, unknown> {
  _id?: string | null
  id?: string | number | null
  home_team_id?: string | number | null
  away_team_id?: string | number | null
  home_score?: string | number | null
  away_score?: string | number | null
  home_scorers?: string | null
  away_scorers?: string | null
  group?: string | null
  matchday?: string | number | null
  local_date?: string | null
  persian_date?: string | null
  stadium_id?: string | number | null
  finished?: string | boolean | null
  time_elapsed?: string | null
  type?: string | null
  home_team_name_en?: string | null
  away_team_name_en?: string | null
  home_team_label?: string | null
  away_team_label?: string | null
}

interface GamesResponse {
  games?: unknown
}

export class WorldCup26Provider {
  readonly name = 'worldcup26' as const
  private readonly baseUrl: string

  constructor(
    baseUrl = DEFAULT_WORLD_CUP_26_BASE_URL,
    private readonly token = '',
  ) {
    this.baseUrl = (baseUrl || DEFAULT_WORLD_CUP_26_BASE_URL).replace(/\/+$/, '')
  }

  async listGames(): Promise<WorldCup26Game[]> {
    const response = await this.request<GamesResponse>('/get/games')

    if (!response || !Array.isArray(response.games)) {
      throw new Error('worldcup26_invalid_games_response')
    }

    return response.games.map((game, index) => {
      if (!isRecord(game) || cleanString(game.id) === null) {
        throw new Error(`worldcup26_invalid_game_record:${index}`)
      }

      return game as WorldCup26Game
    })
  }

  async getGame(tournamentMatchId: string): Promise<WorldCup26Game | null> {
    const games = await this.listGames()
    return games.find(game => cleanString(game.id) === tournamentMatchId) ?? null
  }

  private async request<T>(path: string) {
    const headers: Record<string, string> = {
      accept: 'application/json',
    }

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }

    return await $fetch<T>(`${this.baseUrl}${path}`, {
      headers,
      timeout: 15_000,
    })
  }
}

export function isFinishedWorldCup26Game(game: WorldCup26Game) {
  return toBoolean(game.finished)
    && toNullableInteger(game.home_score) !== null
    && toNullableInteger(game.away_score) !== null
}

export function cleanWorldCup26String(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  const stringValue = String(value).trim()
  return !stringValue || stringValue.toLowerCase() === 'null' ? null : stringValue
}

export function toWorldCup26Integer(value: unknown) {
  const stringValue = cleanWorldCup26String(value)
  if (stringValue === null) {
    return null
  }

  const numericValue = Number(stringValue)
  return Number.isFinite(numericValue) ? Math.trunc(numericValue) : null
}

function toBoolean(value: unknown) {
  return value === true || String(value ?? '').trim().toLowerCase() === 'true'
}

function toNullableInteger(value: unknown) {
  return toWorldCup26Integer(value)
}

function cleanString(value: unknown) {
  return cleanWorldCup26String(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
