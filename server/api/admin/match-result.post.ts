import { createClient } from '@supabase/supabase-js'

interface MatchResultBody {
  matchId?: string
  homeScore90?: number
  awayScore90?: number
  firstScorerPlayerId?: string | null
  noScorerConfirmed?: boolean
  scorers?: MatchScorerBody[]
  reason?: string | null
}

interface MatchScorerBody {
  teamId?: string
  playerId?: string | null
  minute?: number
  ownGoal?: boolean
}

interface MatchRow {
  id: string
  tournament_id: string
  stage_id: string
  home_team_id: string | null
  away_team_id: string | null
  starts_at_utc: string
  status: 'scheduled' | 'live' | 'finished' | 'confirmed' | 'postponed'
  home_score_90: number | null
  away_score_90: number | null
  first_scorer_player_id: string | null
  no_scorer_confirmed: boolean
  result_confirmed_at: string | null
  match_number: number | null
  round_name: string | null
  group_code: string | null
  venue: string | null
  home_placeholder: string | null
  away_placeholder: string | null
}

interface MatchEventRow {
  id: string
  match_id: string
  provider: string | null
  provider_event_id: string | null
  event_type: string
  minute: number
  extra_minute: number | null
  team_id: string | null
  player_id: string | null
  player_name: string | null
  detail: string | null
  created_at: string
}

const matchSelect =
  'id, tournament_id, stage_id, home_team_id, away_team_id, starts_at_utc, status, home_score_90, away_score_90, first_scorer_player_id, no_scorer_confirmed, result_confirmed_at, match_number, round_name, group_code, venue, home_placeholder, away_placeholder'
const eventSelect =
  'id, match_id, provider, provider_event_id, event_type, minute, extra_minute, team_id, player_id, player_name, detail, created_at'

export default defineEventHandler(async (event) => {
  const body = await readBody<MatchResultBody>(event)
  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl || ''
  const publishableKey = config.public.supabasePublishableKey || config.public.supabaseKey || ''
  const authorization = getHeader(event, 'authorization')
  const accessToken = authorization?.replace(/^Bearer\s+/i, '')

  if (!supabaseUrl || !publishableKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'supabase_admin_not_configured',
    })
  }

  if (!accessToken) {
    throw createError({
      statusCode: 401,
      statusMessage: 'not_authenticated',
    })
  }

  const payload = normalizePayload(body)
  const userClient = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })

  const { data: matchData, error: matchError } = await userClient
    .from('matches')
    .select(matchSelect)
    .eq('id', payload.matchId)
    .maybeSingle()

  if (matchError) {
    throw matchError
  }

  if (!matchData) {
    throw createError({
      statusCode: 404,
      statusMessage: 'match_not_found',
    })
  }

  const match = matchData as MatchRow
  validateScorersForScore(payload, match)

  const firstScorerPlayerId = payload.noScorerConfirmed ? null : payload.scorers.find((scorer) => !scorer.ownGoal)?.playerId
  const { data: savedMatchData, error: resultError } = await userClient.rpc('set_match_result_with_events', {
    p_match_id: payload.matchId,
    p_home_score_90: payload.homeScore90,
    p_away_score_90: payload.awayScore90,
    p_first_scorer_player_id: firstScorerPlayerId ?? null,
    p_no_scorer_confirmed: payload.noScorerConfirmed,
    p_scorers: payload.scorers.map((scorer) => ({
      teamId: scorer.teamId,
      playerId: scorer.playerId,
      ownGoal: scorer.ownGoal,
    })),
    p_reason: payload.reason,
  })

  if (resultError) {
    throw mapSupabaseRpcError(resultError)
  }

  const { data: eventRows, error: eventError } = await userClient
    .from('match_events')
    .select(eventSelect)
    .eq('match_id', payload.matchId)
    .order('minute', { ascending: true })
    .order('created_at', { ascending: true })

  if (eventError) {
    throw mapSupabaseRpcError(eventError)
  }

  return {
    match: mapMatch(savedMatchData as MatchRow),
    matchEvents: (eventRows as MatchEventRow[]).map(mapMatchEvent),
  }
})

function mapSupabaseRpcError(error: { code?: string; message?: string }) {
  const message = error.message ?? 'match_result_save_failed'

  if (error.code === 'PGRST202' || message.includes('set_match_result_with_events')) {
    return createError({
      statusCode: 500,
      statusMessage: 'match_result_migration_missing',
    })
  }

  const validationErrors = [
    'admin_required',
    'not_authenticated',
    'invalid_score',
    'invalid_goal_scorer',
    'first_scorer_not_in_match',
    'goal_player_team_mismatch',
    'own_goal_player_team_mismatch',
    'no_scorer_requires_zero_zero',
    'goal_count_mismatch',
    'goal_team_count_mismatch',
    'match_not_found',
  ]

  const knownError = validationErrors.find((candidate) => message.includes(candidate))

  if (knownError) {
    return createError({
      statusCode: knownError === 'not_authenticated' ? 401 : knownError === 'match_not_found' ? 404 : 400,
      statusMessage: knownError,
    })
  }

  return createError({
    statusCode: 500,
    statusMessage: message,
  })
}

function normalizePayload(body: MatchResultBody) {
  const homeScore90 = Number(body.homeScore90)
  const awayScore90 = Number(body.awayScore90)
  const scorers = (body.scorers ?? []).map((scorer, index) => ({
    teamId: String(scorer.teamId ?? ''),
    playerId: scorer.playerId ? String(scorer.playerId) : '',
    minute: Number.isFinite(Number(scorer.minute)) ? Number(scorer.minute) : index + 1,
    ownGoal: Boolean(scorer.ownGoal),
  }))

  if (!body.matchId || !Number.isInteger(homeScore90) || !Number.isInteger(awayScore90)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'invalid_match_result_payload',
    })
  }

  if (homeScore90 < 0 || awayScore90 < 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'invalid_score',
    })
  }

  return {
    matchId: body.matchId,
    homeScore90,
    awayScore90,
    noScorerConfirmed: Boolean(body.noScorerConfirmed),
    reason: body.reason?.trim() || null,
    scorers,
  }
}

function validateScorersForScore(
  payload: ReturnType<typeof normalizePayload>,
  match: Pick<MatchRow, 'home_team_id' | 'away_team_id'>,
) {
  const totalGoals = payload.homeScore90 + payload.awayScore90

  if (totalGoals === 0) {
    if (!payload.noScorerConfirmed || payload.scorers.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'no_scorer_requires_zero_zero',
      })
    }

    return
  }

  if (payload.noScorerConfirmed || payload.scorers.length !== totalGoals) {
    throw createError({
      statusCode: 400,
      statusMessage: 'goal_count_mismatch',
    })
  }

  const homeGoals = payload.scorers.filter((scorer) => scorer.teamId === match.home_team_id).length
  const awayGoals = payload.scorers.filter((scorer) => scorer.teamId === match.away_team_id).length

  if (homeGoals !== payload.homeScore90 || awayGoals !== payload.awayScore90) {
    throw createError({
      statusCode: 400,
      statusMessage: 'goal_team_count_mismatch',
    })
  }

  if (payload.scorers.some((scorer) => !scorer.playerId || ![match.home_team_id, match.away_team_id].includes(scorer.teamId))) {
    throw createError({
      statusCode: 400,
      statusMessage: 'invalid_goal_scorer',
    })
  }
}

function mapMatch(row: MatchRow) {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    stageId: row.stage_id,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    startsAtUtc: row.starts_at_utc,
    status: row.status,
    homeScore90: row.home_score_90,
    awayScore90: row.away_score_90,
    firstScorerPlayerId: row.first_scorer_player_id,
    noScorerConfirmed: row.no_scorer_confirmed,
    resultConfirmedAt: row.result_confirmed_at,
    matchNumber: row.match_number,
    roundName: row.round_name,
    groupCode: row.group_code,
    venue: row.venue,
    homePlaceholder: row.home_placeholder,
    awayPlaceholder: row.away_placeholder,
  }
}

function mapMatchEvent(row: MatchEventRow) {
  return {
    id: row.id,
    matchId: row.match_id,
    provider: row.provider,
    providerEventId: row.provider_event_id,
    eventType: row.event_type,
    minute: row.minute,
    extraMinute: row.extra_minute,
    teamId: row.team_id,
    playerId: row.player_id,
    playerName: row.player_name,
    detail: row.detail,
    createdAt: row.created_at,
  }
}
