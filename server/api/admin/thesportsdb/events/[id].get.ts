import type { TheSportsDbEventDetailsResponse } from '../../../../../app/types/thesportsdb'
import {
  THE_SPORTS_DB_WORLD_CUP_LEAGUE_ID,
  THE_SPORTS_DB_WORLD_CUP_SEASON,
  TheSportsDbProvider,
} from '../../../../utils/sports-providers/thesportsdb-provider'
import { requireAdminReadClient } from '../../../../utils/admin-read-client'
import {
  buildTheSportsDbAuditDetails,
  buildTheSportsDbAuditSummary,
} from '../../../../utils/thesportsdb-audit'
import {
  loadAuditPlayers,
  loadWorldCupAuditContext,
} from '../../../../utils/thesportsdb-audit-db'

export default defineEventHandler(async (event): Promise<TheSportsDbEventDetailsResponse> => {
  const idEvent = String(getRouterParam(event, 'id') ?? '')

  if (!/^\d+$/.test(idEvent)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'invalid_thesportsdb_event_id',
    })
  }

  const client = await requireAdminReadClient(event)
  const config = useRuntimeConfig()
  const provider = new TheSportsDbProvider(config.theSportsDbApiKey || '123')
  const [bundle, context] = await Promise.all([
    provider.getEventBundle(idEvent),
    loadWorldCupAuditContext(client),
  ])

  if (!bundle) {
    throw createError({
      statusCode: 404,
      statusMessage: 'thesportsdb_event_not_found',
    })
  }

  if (
    (bundle.event.idLeague && bundle.event.idLeague !== THE_SPORTS_DB_WORLD_CUP_LEAGUE_ID)
    || (bundle.event.strSeason && bundle.event.strSeason !== THE_SPORTS_DB_WORLD_CUP_SEASON)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'thesportsdb_event_outside_world_cup_2026',
    })
  }

  const summary = buildTheSportsDbAuditSummary(bundle.event, context)
  const players = await loadAuditPlayers(
    client,
    [
      summary.homeTeam.internalTeamId,
      summary.awayTeam.internalTeamId,
    ].filter((teamId): teamId is string => Boolean(teamId)),
  )
  const audit = buildTheSportsDbAuditDetails({
    ...context,
    event: bundle.event,
    timeline: bundle.timeline,
    lineup: bundle.lineup,
    stats: bundle.stats,
    sourceErrors: bundle.sourceErrors,
    players,
  })

  setResponseHeader(event, 'Cache-Control', 'no-store')

  return {
    ok: true,
    source: 'thesportsdb',
    fetchedAt: new Date().toISOString(),
    audit,
  }
})
