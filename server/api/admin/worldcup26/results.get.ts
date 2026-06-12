import type { WorldCup26ResultsResponse } from '../../../../app/types/worldcup26'
import { requireAdminReadClient } from '../../../utils/admin-read-client'
import {
  isFinishedWorldCup26Game,
  WorldCup26Provider,
  WORLD_CUP_2026_EXPECTED_MATCHES,
} from '../../../utils/sports-providers/worldcup26-provider'
import { loadWorldCupAuditContext } from '../../../utils/thesportsdb-audit-db'
import {
  buildWorldCup26AuditSummary,
  worldCup26GameSortValue,
} from '../../../utils/worldcup26-audit'

export default defineEventHandler(async (event): Promise<WorldCup26ResultsResponse> => {
  const client = await requireAdminReadClient(event)
  const config = useRuntimeConfig()
  const provider = new WorldCup26Provider(
    config.worldCup26ApiBaseUrl,
    config.worldCup26ApiToken,
  )
  const [games, context] = await Promise.all([
    provider.listGames(),
    loadWorldCupAuditContext(client),
  ])
  const finishedGames = games
    .filter(isFinishedWorldCup26Game)
    .sort((left, right) =>
      worldCup26GameSortValue(left) - worldCup26GameSortValue(right)
      || Number(left.id) - Number(right.id),
    )
  const warnings: string[] = []

  if (games.length !== WORLD_CUP_2026_EXPECTED_MATCHES) {
    warnings.push(
      `WorldCup26 zwrócił ${games.length} zamiast oczekiwanych ${WORLD_CUP_2026_EXPECTED_MATCHES} meczów turnieju.`,
    )
  }

  if (finishedGames.length === 0) {
    warnings.push('WorldCup26 nie zwrócił żadnych zakończonych meczów z kompletnym wynikiem.')
  }

  setResponseHeader(event, 'Cache-Control', 'no-store')

  return {
    ok: true,
    source: 'worldcup26',
    fetchedAt: new Date().toISOString(),
    totalEvents: games.length,
    expectedTournamentMatches: WORLD_CUP_2026_EXPECTED_MATCHES,
    coverageComplete: games.length === WORLD_CUP_2026_EXPECTED_MATCHES,
    warnings,
    results: finishedGames.map(game => buildWorldCup26AuditSummary(game, context)),
  }
})
