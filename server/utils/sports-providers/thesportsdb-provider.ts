const THE_SPORTS_DB_BASE_URL = 'https://www.thesportsdb.com/api/v1/json'

export const THE_SPORTS_DB_WORLD_CUP_LEAGUE_ID = '4429'
export const THE_SPORTS_DB_WORLD_CUP_SEASON = '2026'
export const WORLD_CUP_2026_EXPECTED_MATCHES = 104

export interface TheSportsDbEvent extends Record<string, unknown> {
  idEvent?: string | null
  idLeague?: string | null
  strSeason?: string | null
  strEvent?: string | null
  strHomeTeam?: string | null
  strAwayTeam?: string | null
  idHomeTeam?: string | null
  idAwayTeam?: string | null
  intHomeScore?: string | number | null
  intAwayScore?: string | number | null
  strTimestamp?: string | null
  dateEvent?: string | null
  strTime?: string | null
  intRound?: string | number | null
  strStatus?: string | null
  strVenue?: string | null
  strGroup?: string | null
}

export interface TheSportsDbTimelineEvent extends Record<string, unknown> {
  idTimeline?: string | null
  idEvent?: string | null
  strTimeline?: string | null
  strTimelineDetail?: string | null
  strDetail?: string | null
  strType?: string | null
  intTime?: string | number | null
  intMinute?: string | number | null
  intExtraTime?: string | number | null
  strTime?: string | null
  idPlayer?: string | null
  strPlayer?: string | null
  strPlayerName?: string | null
  strPlayerAlternate?: string | null
  idTeam?: string | null
  strTeam?: string | null
  strComment?: string | null
}

interface EventsResponse {
  events?: TheSportsDbEvent[] | null
}

interface TimelineResponse {
  timeline?: TheSportsDbTimelineEvent[] | null
}

interface PlayerResponse {
  players?: Array<{
    idPlayer?: string | null
    strPlayer?: string | null
    strPlayerAlternate?: string | null
  }> | null
}

interface LineupResponse {
  lineup?: Record<string, unknown>[] | null
}

interface StatsResponse {
  eventstats?: Record<string, unknown>[] | null
}

export interface TheSportsDbEventBundle {
  event: TheSportsDbEvent
  timeline: TheSportsDbTimelineEvent[]
  lineup: Record<string, unknown>[]
  stats: Record<string, unknown>[]
  sourceErrors: string[]
}

export class TheSportsDbProvider {
  readonly name = 'thesportsdb' as const

  constructor(private readonly apiKey = '123') {}

  async listWorldCupEvents() {
    const data = await this.request<EventsResponse>('eventsseason.php', {
      id: THE_SPORTS_DB_WORLD_CUP_LEAGUE_ID,
      s: THE_SPORTS_DB_WORLD_CUP_SEASON,
    })

    return data.events ?? []
  }

  async getEvent(idEvent: string) {
    const data = await this.request<EventsResponse>('lookupevent.php', { id: idEvent })
    return data.events?.[0] ?? null
  }

  async getEventBundle(idEvent: string): Promise<TheSportsDbEventBundle | null> {
    const event = await this.getEvent(idEvent)

    if (!event) {
      return null
    }

    const [timeline, lineup, stats] = await Promise.all([
      this.optionalRequest<TimelineResponse>('lookuptimeline.php', { id: idEvent }, 'timeline'),
      this.optionalRequest<LineupResponse>('lookuplineup.php', { id: idEvent }, 'lineup'),
      this.optionalRequest<StatsResponse>('lookupeventstats.php', { id: idEvent }, 'stats'),
    ])
    const sourceErrors = [timeline.error, lineup.error, stats.error].filter(
      (error): error is string => Boolean(error),
    )
    const enrichedTimeline = await this.enrichGoalPlayerNames(
      timeline.data?.timeline ?? [],
      sourceErrors,
    )

    return {
      event,
      timeline: enrichedTimeline,
      lineup: lineup.data?.lineup ?? [],
      stats: stats.data?.eventstats ?? [],
      sourceErrors,
    }
  }

  private async enrichGoalPlayerNames(
    timeline: TheSportsDbTimelineEvent[],
    sourceErrors: string[],
  ) {
    const playerIds = [
      ...new Set(
        timeline
          .filter(isGoalTimelineEvent)
          .filter(item => !item.strPlayerAlternate)
          .map(item => item.idPlayer)
          .filter((id): id is string => Boolean(id)),
      ),
    ]

    const players = await Promise.all(
      playerIds.map(async (playerId) => {
        const lookup = await this.optionalRequest<PlayerResponse>(
          'lookupplayer.php',
          { id: playerId },
          `player:${playerId}`,
        )

        if (lookup.error) {
          sourceErrors.push(lookup.error)
        }

        return [playerId, lookup.data?.players?.[0] ?? null] as const
      }),
    )
    const playersById = new Map(players)

    return timeline.map((item) => {
      if (!item.idPlayer || item.strPlayerAlternate) {
        return item
      }

      const player = playersById.get(item.idPlayer)
      if (!player) {
        return item
      }

      return {
        ...item,
        strPlayer: item.strPlayer || player.strPlayer || null,
        strPlayerAlternate: player.strPlayerAlternate || null,
      }
    })
  }

  private async optionalRequest<T>(
    endpoint: string,
    query: Record<string, string>,
    label: string,
  ): Promise<{ data: T | null; error: string | null }> {
    try {
      return {
        data: await this.request<T>(endpoint, query),
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: `${label}: ${error instanceof Error ? error.message : 'request_failed'}`,
      }
    }
  }

  private async request<T>(endpoint: string, query: Record<string, string>) {
    const url = new URL(`${THE_SPORTS_DB_BASE_URL}/${encodeURIComponent(this.apiKey || '123')}/${endpoint}`)

    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value)
    }

    return await $fetch<T>(url.toString(), {
      headers: {
        accept: 'application/json',
      },
      timeout: 15_000,
    })
  }
}

function isGoalTimelineEvent(event: TheSportsDbTimelineEvent) {
  const label = `${event.strTimeline ?? ''} ${event.strTimelineDetail ?? ''} ${event.strDetail ?? ''} ${event.strType ?? ''}`
    .trim()
    .toLowerCase()

  return label.includes('goal')
    && !label.includes('disallowed')
    && !label.includes('missed penalty')
    && !label.includes('penalty miss')
}

export function isFinishedSportsDbEvent(event: TheSportsDbEvent) {
  const status = normalizeProviderStatus(event.strStatus)

  return (
    ['ft', 'aet', 'pen', 'match finished', 'finished'].includes(status)
    && toNullableNumber(event.intHomeScore) !== null
    && toNullableNumber(event.intAwayScore) !== null
  )
}

function normalizeProviderStatus(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : null
}
