import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AuditMatchRecord,
  AuditPlayerRecord,
  AuditTeamRecord,
  TheSportsDbAuditContext,
} from './thesportsdb-audit'

interface TournamentRow {
  id: string
}

interface TeamRow {
  id: string
  name: string
  provider: string | null
  external_id: string | null
}

interface MatchRow {
  id: string
  provider: string | null
  external_id: string | null
  home_team_id: string | null
  away_team_id: string | null
  starts_at_utc: string
  status: string
  home_score_90: number | null
  away_score_90: number | null
  result_confirmed_at: string | null
  match_number: number | null
}

interface PlayerRow {
  id: string
  team_id: string
  name: string
}

export async function loadWorldCupAuditContext(
  client: SupabaseClient,
): Promise<TheSportsDbAuditContext & { tournamentId: string }> {
  const { data: tournamentData, error: tournamentError } = await client
    .from('tournaments')
    .select('id')
    .eq('slug', 'world-cup-2026')
    .maybeSingle()

  if (tournamentError) {
    throw tournamentError
  }

  if (!tournamentData) {
    throw createError({
      statusCode: 404,
      statusMessage: 'world_cup_2026_tournament_not_found',
    })
  }

  const tournament = tournamentData as TournamentRow
  const [teamResult, matchResult] = await Promise.all([
    client
      .from('teams')
      .select('id, name, provider, external_id')
      .eq('tournament_id', tournament.id)
      .order('name', { ascending: true }),
    client
      .from('matches')
      .select(
        'id, provider, external_id, home_team_id, away_team_id, starts_at_utc, status, home_score_90, away_score_90, result_confirmed_at, match_number',
      )
      .eq('tournament_id', tournament.id)
      .order('starts_at_utc', { ascending: true }),
  ])

  if (teamResult.error) {
    throw teamResult.error
  }

  if (matchResult.error) {
    throw matchResult.error
  }

  return {
    tournamentId: tournament.id,
    teams: (teamResult.data as TeamRow[]).map(mapTeam),
    matches: (matchResult.data as MatchRow[]).map(mapMatch),
  }
}

export async function loadAuditPlayers(
  client: SupabaseClient,
  teamIds: readonly string[],
): Promise<AuditPlayerRecord[]> {
  const uniqueTeamIds = [...new Set(teamIds.filter(Boolean))]

  if (uniqueTeamIds.length === 0) {
    return []
  }

  const { data, error } = await client
    .from('players')
    .select('id, team_id, name')
    .in('team_id', uniqueTeamIds)
    .eq('active', true)
    .order('team_id', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    throw error
  }

  return (data as PlayerRow[]).map((row) => ({
    id: row.id,
    teamId: row.team_id,
    name: row.name,
  }))
}

function mapTeam(row: TeamRow): AuditTeamRecord {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    externalId: row.external_id,
  }
}

function mapMatch(row: MatchRow): AuditMatchRecord {
  return {
    id: row.id,
    provider: row.provider,
    externalId: row.external_id,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    startsAtUtc: row.starts_at_utc,
    status: row.status,
    homeScore90: row.home_score_90,
    awayScore90: row.away_score_90,
    resultConfirmedAt: row.result_confirmed_at,
    matchNumber: row.match_number,
  }
}
