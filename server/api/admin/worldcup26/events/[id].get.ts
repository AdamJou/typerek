import type { WorldCup26EventDetailsResponse } from '../../../../../app/types/worldcup26'
import { requireAdminReadClient } from '../../../../utils/admin-read-client'
import { WorldCup26Provider } from '../../../../utils/sports-providers/worldcup26-provider'
import {
  loadAuditPlayers,
  loadWorldCupAuditContext,
} from '../../../../utils/thesportsdb-audit-db'
import {
  buildWorldCup26AuditDetails,
  buildWorldCup26AuditSummary,
} from '../../../../utils/worldcup26-audit'

export default defineEventHandler(async (event): Promise<WorldCup26EventDetailsResponse> => {
  const eventId = String(getRouterParam(event, 'id') ?? '')

  if (!/^(?:[1-9]|[1-9]\d|10[0-4])$/.test(eventId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'invalid_worldcup26_event_id',
    })
  }

  const client = await requireAdminReadClient(event)
  const config = useRuntimeConfig()
  const provider = new WorldCup26Provider(
    config.worldCup26ApiBaseUrl,
    config.worldCup26ApiToken,
  )
  const [game, context] = await Promise.all([
    provider.getGame(eventId),
    loadWorldCupAuditContext(client),
  ])

  if (!game) {
    throw createError({
      statusCode: 404,
      statusMessage: 'worldcup26_event_not_found',
    })
  }

  const summary = buildWorldCup26AuditSummary(game, context)
  const players = await loadAuditPlayers(
    client,
    [
      summary.homeTeam.internalTeamId,
      summary.awayTeam.internalTeamId,
    ].filter((teamId): teamId is string => Boolean(teamId)),
  )
  const audit = buildWorldCup26AuditDetails({
    ...context,
    game,
    players,
  })

  setResponseHeader(event, 'Cache-Control', 'no-store')

  return {
    ok: true,
    source: 'worldcup26',
    fetchedAt: new Date().toISOString(),
    audit,
  }
})
