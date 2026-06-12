import type { TheSportsDbResultsResponse } from '../../../../app/types/thesportsdb'
import {
  isFinishedSportsDbEvent,
  TheSportsDbProvider,
  WORLD_CUP_2026_EXPECTED_MATCHES,
} from '../../../utils/sports-providers/thesportsdb-provider'
import { requireAdminReadClient } from '../../../utils/admin-read-client'
import { buildTheSportsDbAuditSummary } from '../../../utils/thesportsdb-audit'
import { loadWorldCupAuditContext } from '../../../utils/thesportsdb-audit-db'

export default defineEventHandler(async (event): Promise<TheSportsDbResultsResponse> => {
  const client = await requireAdminReadClient(event)
  const config = useRuntimeConfig()
  const provider = new TheSportsDbProvider(config.theSportsDbApiKey || '123')
  const [events, context] = await Promise.all([
    provider.listWorldCupEvents(),
    loadWorldCupAuditContext(client),
  ])
  const finishedEvents = events
    .filter(isFinishedSportsDbEvent)
    .sort((left, right) =>
      String(left.strTimestamp ?? '').localeCompare(String(right.strTimestamp ?? '')),
    )
  const warnings: string[] = []

  if (events.length < WORLD_CUP_2026_EXPECTED_MATCHES) {
    warnings.push(
      `TheSportsDB zwrócił ${events.length} z oczekiwanych ${WORLD_CUP_2026_EXPECTED_MATCHES} meczów turnieju.`,
    )
  }

  if (finishedEvents.length === 0) {
    warnings.push('TheSportsDB nie zwrócił żadnych zakończonych meczów z kompletnym wynikiem.')
  }

  setResponseHeader(event, 'Cache-Control', 'no-store')

  return {
    ok: true,
    source: 'thesportsdb',
    fetchedAt: new Date().toISOString(),
    totalEvents: events.length,
    expectedTournamentMatches: WORLD_CUP_2026_EXPECTED_MATCHES,
    coverageComplete: events.length >= WORLD_CUP_2026_EXPECTED_MATCHES,
    warnings,
    results: finishedEvents.map((providerEvent) =>
      buildTheSportsDbAuditSummary(providerEvent, context),
    ),
  }
})
