import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  BonusPrediction,
  BonusQuestion,
  BonusQuestionOption,
  BonusQuestionResolution,
  League,
  LeagueMember,
  Match,
  MatchEvent,
  MatchPrediction,
  MatchPredictionPresence,
  MatchScorerInput,
  Player,
  ScoreBreakdown,
  SynchronizationLog,
  Team,
  Tournament,
  TournamentStage,
} from '~/types/domain'

export interface UpsertMatchPredictionPayload {
  matchId: string
  predictedHomeScore: number
  predictedAwayScore: number
  firstScorerPlayerId: string | null
  noScorer: boolean
}

export interface SetMatchResultPayload {
  matchId: string
  homeScore90: number
  awayScore90: number
  firstScorerPlayerId: string | null
  noScorerConfirmed: boolean
  scorers?: MatchScorerInput[]
  reason?: string | null
}

export interface UpsertBonusPredictionPayload {
  questionId: string
  answerJson: Record<string, unknown> | null
}

export interface TyperekDataSnapshot {
  tournament: Tournament
  league: League | null
  stages: TournamentStage[]
  teams: Team[]
  players: Player[]
  matches: Match[]
  matchEvents: MatchEvent[]
  members: LeagueMember[]
  predictions: MatchPrediction[]
  predictionPresence: MatchPredictionPresence[]
  bonusQuestions: BonusQuestion[]
  bonusOptions: BonusQuestionOption[]
  bonusPredictions: BonusPrediction[]
  bonusResolutions: BonusQuestionResolution[]
  scoreBreakdowns: ScoreBreakdown[]
  synchronizationLogs: SynchronizationLog[]
}

interface TournamentRow {
  id: string
  slug: string
  name: string
  season_year: number
  starts_at: string
  ends_at: string
}

interface TournamentStageRow {
  id: string
  tournament_id: string
  code: TournamentStage['code']
  name: string
  short_name: string
  sort_order: number
}

interface TeamRow {
  id: string
  tournament_id: string
  name: string
  country_code: string | null
  flag_code: string | null
  group_code: string | null
  confederation: string | null
}

interface PlayerRow {
  id: string
  team_id: string
  name: string
  position: string | null
  shirt_number: number | null
  active: boolean
}

interface MatchRow {
  id: string
  tournament_id: string
  stage_id: string
  home_team_id: string | null
  away_team_id: string | null
  starts_at_utc: string
  status: Match['status']
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

interface LeagueRow {
  id: string
  tournament_id: string
  name: string
  owner_user_id: string
}

interface LeagueMemberRow {
  id: string
  league_id: string
  user_id: string
  status: LeagueMember['status']
  joined_at: string
}

interface ProfileRow {
  user_id: string
  display_name: string
}

interface MatchPredictionRow {
  id: string
  league_id: string
  user_id: string
  match_id: string
  predicted_home_score: number
  predicted_away_score: number
  first_scorer_player_id: string | null
  no_scorer: boolean
  updated_at: string
}

interface MatchPredictionPresenceRow {
  match_id: string
  user_id: string
}

interface BonusQuestionRow {
  id: string
  league_id: string
  slug?: string | null
  title: string
  points: number
  deadline_at: string
  lock_at?: string | null
  display_order?: number | null
  kind?: BonusQuestion['kind']
  source_kind?: BonusQuestion['sourceKind']
  config_json?: BonusQuestion['configJson']
  correct_option_id: string | null
}

interface BonusQuestionOptionRow {
  id: string
  question_id: string
  label: string
  sort_order: number
}

interface BonusPredictionRow {
  id: string
  question_id: string
  user_id: string
  answer_json?: Record<string, unknown> | null
  option_id?: string | null
  updated_at: string
}

interface BonusQuestionResolutionRow {
  id: string
  question_id: string
  status: BonusQuestionResolution['status']
  answer_json: Record<string, unknown> | null
  source_snapshot_json: Record<string, unknown> | null
  source_status: BonusQuestionResolution['sourceStatus']
  note: string | null
  updated_at: string
}

interface ScoreBreakdownRow {
  league_id: string
  user_id: string
  source_type: ScoreBreakdown['sourceType']
  source_id: string
  stage_id: string | null
  outcome_points: number
  exact_score_points: number
  first_scorer_points: number
  bonus_points: number
  total_points: number
}

interface SynchronizationLogRow {
  id: string
  provider: SynchronizationLog['provider']
  status: SynchronizationLog['status']
  started_at: string
  finished_at: string | null
  request_count: number
  message: string | null
}

const pageSize = 1000

export class TyperekRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getWorldCupSnapshot(currentUserId: string | null, slug = 'world-cup-2026'): Promise<TyperekDataSnapshot> {
    const tournament = await this.getTournamentBySlug(slug)

    const [stages, teams, matches, league, synchronizationLogs] = await Promise.all([
      this.listStages(tournament.id),
      this.listTeams(tournament.id),
      this.listMatches(tournament.id),
      this.getCurrentUserLeague(tournament.id),
      this.listSynchronizationLogs(),
    ])

    const [players, matchEvents] = await Promise.all([
      this.listPlayersForTeams(teams.map((team) => team.id)),
      this.listMatchEvents(matches.map((match) => match.id)),
    ])

    if (!league) {
      return {
        tournament,
        league: null,
        stages,
        teams,
        players,
        matches,
        matchEvents,
        members: [],
        predictions: [],
        predictionPresence: [],
        bonusQuestions: [],
        bonusOptions: [],
        bonusPredictions: [],
        bonusResolutions: [],
        scoreBreakdowns: [],
        synchronizationLogs,
      }
    }

    const [members, predictions, predictionPresence, bonusQuestions, scoreBreakdowns] = await Promise.all([
      this.listLeagueMembers(league.id),
      this.listMatchPredictions(league.id),
      this.listMatchPredictionPresence(league.id),
      this.listBonusQuestions(league.id),
      this.listScoreBreakdowns(league.id),
    ])
    const questionIds = bonusQuestions.map((question) => question.id)
    const [bonusOptions, bonusPredictions, bonusResolutions] = await Promise.all([
      this.listBonusOptions(questionIds),
      currentUserId ? this.listBonusPredictions(questionIds, currentUserId) : Promise.resolve([]),
      this.listBonusResolutions(questionIds),
    ])

    return {
      tournament,
      league,
      stages,
      teams,
      players,
      matches,
      matchEvents,
      members,
      predictions,
      predictionPresence,
      bonusQuestions,
      bonusOptions,
      bonusPredictions,
      bonusResolutions,
      scoreBreakdowns,
      synchronizationLogs,
    }
  }

  private async getTournamentBySlug(slug: string) {
    const { data, error } = await this.supabase
      .from('tournaments')
      .select('id, slug, name, season_year, starts_at, ends_at')
      .eq('slug', slug)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      throw new Error(`Tournament not found: ${slug}`)
    }

    return mapTournament(data as TournamentRow)
  }

  private async listStages(tournamentId: string) {
    const { data, error } = await this.supabase
      .from('tournament_stages')
      .select('id, tournament_id, code, name, short_name, sort_order')
      .eq('tournament_id', tournamentId)
      .order('sort_order', { ascending: true })

    if (error) {
      throw error
    }

    return (data as TournamentStageRow[]).map(mapStage)
  }

  private async listTeams(tournamentId: string) {
    const { data, error } = await this.supabase
      .from('teams')
      .select('id, tournament_id, name, country_code, flag_code, group_code, confederation')
      .eq('tournament_id', tournamentId)
      .order('group_code', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      throw error
    }

    return (data as TeamRow[]).map(mapTeam)
  }

  private async listPlayersForTeams(teamIds: string[]) {
    if (teamIds.length === 0) {
      return []
    }

    const rows = await this.fetchPaged<PlayerRow>((from, to) =>
      this.supabase
        .from('players')
        .select('id, team_id, name, position, shirt_number, active')
        .in('team_id', teamIds)
        .order('team_id', { ascending: true })
        .order('shirt_number', { ascending: true })
        .order('name', { ascending: true })
        .range(from, to),
    )

    return rows.map(mapPlayer)
  }

  private async listMatches(tournamentId: string) {
    const rows = await this.fetchPaged<MatchRow>((from, to) =>
      this.supabase
        .from('matches')
        .select(
          'id, tournament_id, stage_id, home_team_id, away_team_id, starts_at_utc, status, home_score_90, away_score_90, first_scorer_player_id, no_scorer_confirmed, result_confirmed_at, match_number, round_name, group_code, venue, home_placeholder, away_placeholder',
        )
        .eq('tournament_id', tournamentId)
        .order('match_number', { ascending: true })
        .range(from, to),
    )

    return rows.map(mapMatch)
  }

  private async listMatchEvents(matchIds: string[]) {
    if (matchIds.length === 0) {
      return []
    }

    const rows = await this.fetchPaged<MatchEventRow>((from, to) =>
      this.supabase
        .from('match_events')
        .select(
          'id, match_id, provider, provider_event_id, event_type, minute, extra_minute, team_id, player_id, player_name, detail, created_at',
        )
        .in('match_id', matchIds)
        .order('match_id', { ascending: true })
        .order('minute', { ascending: true })
        .order('created_at', { ascending: true })
        .range(from, to),
    )

    return rows.map(mapMatchEvent)
  }

  private async getCurrentUserLeague(tournamentId: string) {
    const { data, error } = await this.supabase
      .from('leagues')
      .select('id, tournament_id, name, owner_user_id')
      .eq('tournament_id', tournamentId)
      .limit(1)
      .maybeSingle()

    if (error) {
      throw error
    }

    return data ? mapLeague(data as LeagueRow) : null
  }

  private async listLeagueMembers(leagueId: string) {
    const { data, error } = await this.supabase
      .from('league_members')
      .select('id, league_id, user_id, status, joined_at')
      .eq('league_id', leagueId)
      .eq('status', 'active')
      .order('joined_at', { ascending: true })

    if (error) {
      throw error
    }

    const memberRows = data as LeagueMemberRow[]
    const profilesByUserId = await this.getProfilesByUserId(memberRows.map((member) => member.user_id))

    return memberRows.map((member) =>
      mapLeagueMember(member, profilesByUserId.get(member.user_id)?.display_name ?? member.user_id.slice(0, 8)),
    )
  }

  private async getProfilesByUserId(userIds: string[]) {
    const uniqueIds = [...new Set(userIds)]

    if (uniqueIds.length === 0) {
      return new Map<string, ProfileRow>()
    }

    const { data, error } = await this.supabase
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', uniqueIds)

    if (error) {
      throw error
    }

    return new Map((data as ProfileRow[]).map((profile) => [profile.user_id, profile]))
  }

  private async listMatchPredictions(leagueId: string) {
    const rows = await this.fetchPaged<MatchPredictionRow>((from, to) =>
      this.supabase
        .from('match_predictions')
        .select(
          'id, league_id, user_id, match_id, predicted_home_score, predicted_away_score, first_scorer_player_id, no_scorer, updated_at',
        )
        .eq('league_id', leagueId)
        .order('updated_at', { ascending: false })
        .range(from, to),
    )

    return rows.map(mapMatchPrediction)
  }

  private async listMatchPredictionPresence(leagueId: string) {
    const { data, error } = await this.supabase.rpc('list_match_prediction_presence', {
      p_league_id: leagueId,
    })

    if (error) {
      if (error.code === 'PGRST202' || error.code === '42883') {
        return []
      }

      throw error
    }

    return (data as MatchPredictionPresenceRow[]).map((row) => ({
      matchId: row.match_id,
      userId: row.user_id,
    }))
  }

  private async listBonusQuestions(leagueId: string) {
    const { data, error } = await this.supabase
      .from('bonus_questions')
      .select('*')
      .eq('league_id', leagueId)
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('deadline_at', { ascending: true })

    if (error) {
      throw error
    }

    return (data as BonusQuestionRow[]).map(mapBonusQuestion)
  }

  private async listBonusOptions(questionIds: string[]) {
    if (questionIds.length === 0) {
      return []
    }

    const { data, error } = await this.supabase
      .from('bonus_question_options')
      .select('id, question_id, label, sort_order')
      .in('question_id', questionIds)
      .order('sort_order', { ascending: true })

    if (error) {
      throw error
    }

    return (data as BonusQuestionOptionRow[]).map(mapBonusOption)
  }

  private async listBonusPredictions(questionIds: string[], userId: string) {
    if (questionIds.length === 0) {
      return []
    }

    const { data, error } = await this.supabase
      .from('bonus_predictions')
      .select('*')
      .in('question_id', questionIds)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) {
      throw error
    }

    return (data as BonusPredictionRow[]).map(mapBonusPrediction)
  }

  private async listBonusResolutions(questionIds: string[]) {
    if (questionIds.length === 0) {
      return []
    }

    try {
      const { data, error } = await this.supabase
        .from('bonus_question_resolutions')
        .select('*')
        .in('question_id', questionIds)
        .order('updated_at', { ascending: false })

      if (error) {
        throw error
      }

      return (data as BonusQuestionResolutionRow[]).map(mapBonusResolution)
    } catch {
      return []
    }
  }

  private async listScoreBreakdowns(leagueId: string) {
    const rows = await this.fetchPaged<ScoreBreakdownRow>((from, to) =>
      this.supabase
        .from('score_breakdowns')
        .select(
          'league_id, user_id, source_type, source_id, stage_id, outcome_points, exact_score_points, first_scorer_points, bonus_points, total_points',
        )
        .eq('league_id', leagueId)
        .range(from, to),
    )

    return rows.map(mapScoreBreakdown)
  }

  private async listSynchronizationLogs() {
    const { data, error } = await this.supabase
      .from('synchronization_logs')
      .select('id, provider, status, started_at, finished_at, request_count, message')
      .order('started_at', { ascending: false })
      .limit(20)

    if (error) {
      throw error
    }

    return (data as SynchronizationLogRow[]).map(mapSynchronizationLog)
  }

  private async fetchPaged<T>(
    fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  ) {
    const rows: T[] = []

    for (let from = 0; ; from += pageSize) {
      const { data, error } = await fetchPage(from, from + pageSize - 1)

      if (error) {
        throw error
      }

      if (!data || data.length === 0) {
        break
      }

      rows.push(...data)

      if (data.length < pageSize) {
        break
      }
    }

    return rows
  }

  async joinLeagueByCode(code: string) {
    const { data, error } = await this.supabase.rpc('join_league_by_code', {
      p_code: code,
    })

    if (error) {
      throw error
    }

    return data
  }

  async upsertMatchPrediction(payload: UpsertMatchPredictionPayload) {
    const { data, error } = await this.supabase.rpc('upsert_match_prediction', {
      p_match_id: payload.matchId,
      p_predicted_home_score: payload.predictedHomeScore,
      p_predicted_away_score: payload.predictedAwayScore,
      p_first_scorer_player_id: payload.firstScorerPlayerId,
      p_no_scorer: payload.noScorer,
    })

    if (error) {
      throw error
    }

    return mapMatchPrediction(data as MatchPredictionRow)
  }

  async deleteMatchPrediction(matchId: string) {
    const { error } = await this.supabase.rpc('delete_match_prediction', {
      p_match_id: matchId,
    })

    if (error) {
      throw error
    }
  }

  async getRevealedMatchPrediction(matchId: string, userId: string) {
    const { data, error } = await this.supabase.rpc('get_revealed_match_prediction', {
      p_match_id: matchId,
      p_user_id: userId,
    })

    if (error) {
      throw error
    }

    return data ? mapMatchPrediction(data as MatchPredictionRow) : null
  }

  async upsertBonusPrediction(payload: UpsertBonusPredictionPayload) {
    const { data, error } = await this.supabase.rpc('upsert_bonus_prediction', {
      p_question_id: payload.questionId,
      p_answer_json: payload.answerJson,
    })

    if (error) {
      throw error
    }

    return mapBonusPrediction(data as BonusPredictionRow)
  }

  async deleteBonusPrediction(questionId: string) {
    const { error } = await this.supabase.rpc('delete_bonus_prediction', {
      p_question_id: questionId,
    })

    if (error) {
      throw error
    }
  }

  async setMatchResult(payload: SetMatchResultPayload) {
    const { data, error } = await this.supabase.rpc('set_match_result', {
      p_match_id: payload.matchId,
      p_home_score_90: payload.homeScore90,
      p_away_score_90: payload.awayScore90,
      p_first_scorer_player_id: payload.noScorerConfirmed ? null : payload.firstScorerPlayerId,
      p_no_scorer_confirmed: payload.noScorerConfirmed,
      p_reason: payload.reason ?? null,
    })

    if (error) {
      throw error
    }

    if (!data) {
      throw new Error('Nie udało się zapisać wyniku meczu.')
    }

    return mapMatch(data as MatchRow)
  }

  async recalculateLeagueScores(leagueId: string) {
    const { data, error } = await this.supabase.rpc('recalculate_league_scores', {
      p_league_id: leagueId,
    })

    if (error) {
      throw error
    }

    return data as number
  }
}

function mapTournament(row: TournamentRow): Tournament {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    seasonYear: row.season_year,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  }
}

function mapStage(row: TournamentStageRow): TournamentStage {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    code: row.code,
    name: row.name,
    shortName: row.short_name,
    sortOrder: row.sort_order,
  }
}

function mapTeam(row: TeamRow): Team {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    name: row.name,
    countryCode: row.country_code,
    flag: row.flag_code ?? 'TBD',
    groupCode: row.group_code,
    confederation: row.confederation,
  }
}

function mapPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    position: row.position,
    shirtNumber: row.shirt_number,
    active: row.active,
  }
}

function mapMatch(row: MatchRow): Match {
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

function mapMatchEvent(row: MatchEventRow): MatchEvent {
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

function mapLeague(row: LeagueRow): League {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    name: row.name,
    ownerUserId: row.owner_user_id,
  }
}

function mapLeagueMember(row: LeagueMemberRow, displayName: string): LeagueMember {
  return {
    id: row.id,
    leagueId: row.league_id,
    userId: row.user_id,
    displayName,
    status: row.status,
    joinedAt: row.joined_at,
  }
}

function mapMatchPrediction(row: MatchPredictionRow): MatchPrediction {
  return {
    id: row.id,
    leagueId: row.league_id,
    userId: row.user_id,
    matchId: row.match_id,
    predictedHomeScore: row.predicted_home_score,
    predictedAwayScore: row.predicted_away_score,
    firstScorerPlayerId: row.first_scorer_player_id,
    noScorer: row.no_scorer,
    updatedAt: row.updated_at,
  }
}

function mapBonusQuestion(row: BonusQuestionRow): BonusQuestion {
  return {
    id: row.id,
    leagueId: row.league_id,
    slug: row.slug ?? null,
    title: row.title,
    points: row.points,
    deadlineAt: row.deadline_at,
    lockAt: row.lock_at ?? null,
    displayOrder: row.display_order ?? undefined,
    kind: row.kind ?? null,
    sourceKind: row.source_kind ?? null,
    configJson: row.config_json ?? null,
    correctOptionId: row.correct_option_id,
  }
}

function mapBonusOption(row: BonusQuestionOptionRow): BonusQuestionOption {
  return {
    id: row.id,
    questionId: row.question_id,
    label: row.label,
    sortOrder: row.sort_order,
  }
}

function mapBonusPrediction(row: BonusPredictionRow): BonusPrediction {
  return {
    id: row.id,
    questionId: row.question_id,
    userId: row.user_id,
    answerJson: row.answer_json ?? null,
    optionId: row.option_id ?? null,
    updatedAt: row.updated_at,
  }
}

function mapBonusResolution(row: BonusQuestionResolutionRow): BonusQuestionResolution {
  return {
    id: row.id,
    questionId: row.question_id,
    status: row.status,
    answerJson: row.answer_json,
    sourceSnapshotJson: row.source_snapshot_json,
    sourceStatus: row.source_status,
    note: row.note,
    updatedAt: row.updated_at,
  }
}

function mapScoreBreakdown(row: ScoreBreakdownRow): ScoreBreakdown {
  return {
    leagueId: row.league_id,
    userId: row.user_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    stageId: row.stage_id,
    outcomePoints: row.outcome_points,
    exactScorePoints: row.exact_score_points,
    firstScorerPoints: row.first_scorer_points,
    bonusPoints: row.bonus_points,
    totalPoints: row.total_points,
  }
}

function mapSynchronizationLog(row: SynchronizationLogRow): SynchronizationLog {
  return {
    id: row.id,
    provider: row.provider,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    requestCount: row.request_count,
    message: row.message ?? '',
  }
}
