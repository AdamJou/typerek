import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  BonusPrediction,
  BonusQuestion,
  BonusQuestionOption,
  LeagueMember,
  Player,
  Team,
  TournamentStage,
} from '../../../app/types/domain'
import { bonusAnswersExportFilename, buildBonusAnswersExport } from '../../../app/utils/bonusExport'

interface LeagueRow {
  id: string
  tournament_id: string
  name: string
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
  is_admin?: boolean
}

interface BonusQuestionRow {
  id: string
  league_id: string
  slug: string | null
  title: string
  points: number
  deadline_at: string
  lock_at: string | null
  display_order: number | null
  kind: BonusQuestion['kind']
  source_kind: BonusQuestion['sourceKind']
  config_json: BonusQuestion['configJson']
  correct_option_id: string | null
}

interface BonusPredictionRow {
  id: string
  question_id: string
  user_id: string
  answer_json: Record<string, unknown> | null
  option_id: string | null
  updated_at: string
}

interface BonusQuestionOptionRow {
  id: string
  question_id: string
  label: string
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

interface TournamentStageRow {
  id: string
  tournament_id: string
  code: TournamentStage['code']
  name: string
  short_name: string
  sort_order: number
}

const pageSize = 1000

export default defineEventHandler(async (event) => {
  const leagueId = String(getQuery(event).leagueId ?? '')
  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl || ''
  const publishableKey = config.public.supabasePublishableKey || config.public.supabaseKey || ''
  const authorization = getHeader(event, 'authorization')
  const accessToken = authorization?.replace(/^Bearer\s+/i, '')

  if (!supabaseUrl || !publishableKey) {
    throw createError({ statusCode: 500, statusMessage: 'supabase_admin_not_configured' })
  }

  if (!accessToken) {
    throw createError({ statusCode: 401, statusMessage: 'not_authenticated' })
  }

  if (!leagueId) {
    throw createError({ statusCode: 400, statusMessage: 'league_id_required' })
  }

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
  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken)

  if (userError || !userData.user) {
    throw createError({ statusCode: 401, statusMessage: 'not_authenticated' })
  }

  const { data: profileData, error: profileError } = await userClient
    .from('profiles')
    .select('user_id, display_name, is_admin')
    .eq('user_id', userData.user.id)
    .maybeSingle()

  if (profileError) {
    throw profileError
  }

  if (!(profileData as ProfileRow | null)?.is_admin) {
    throw createError({ statusCode: 403, statusMessage: 'admin_required' })
  }

  const { data: leagueData, error: leagueError } = await userClient
    .from('leagues')
    .select('id, tournament_id, name')
    .eq('id', leagueId)
    .maybeSingle()

  if (leagueError) {
    throw leagueError
  }

  if (!leagueData) {
    throw createError({ statusCode: 404, statusMessage: 'league_not_found' })
  }

  const league = leagueData as LeagueRow
  const [memberRows, questionRows, teamRows, stageRows] = await Promise.all([
    fetchPaged<LeagueMemberRow>((from, to) =>
      userClient
        .from('league_members')
        .select('id, league_id, user_id, status, joined_at')
        .eq('league_id', league.id)
        .eq('status', 'active')
        .order('joined_at', { ascending: true })
        .range(from, to),
    ),
    fetchPaged<BonusQuestionRow>((from, to) =>
      userClient
        .from('bonus_questions')
        .select(
          'id, league_id, slug, title, points, deadline_at, lock_at, display_order, kind, source_kind, config_json, correct_option_id',
        )
        .eq('league_id', league.id)
        .order('display_order', { ascending: true, nullsFirst: false })
        .range(from, to),
    ),
    fetchPaged<TeamRow>((from, to) =>
      userClient
        .from('teams')
        .select('id, tournament_id, name, country_code, flag_code, group_code, confederation')
        .eq('tournament_id', league.tournament_id)
        .order('name', { ascending: true })
        .range(from, to),
    ),
    fetchPaged<TournamentStageRow>((from, to) =>
      userClient
        .from('tournament_stages')
        .select('id, tournament_id, code, name, short_name, sort_order')
        .eq('tournament_id', league.tournament_id)
        .order('sort_order', { ascending: true })
        .range(from, to),
    ),
  ])
  const memberUserIds = memberRows.map((member) => member.user_id)
  const questionIds = questionRows.map((question) => question.id)
  const teamIds = teamRows.map((team) => team.id)
  const [profileRows, optionRows, predictionRows, playerRows] = await Promise.all([
    memberUserIds.length
      ? fetchPaged<ProfileRow>((from, to) =>
          userClient
            .from('profiles')
            .select('user_id, display_name')
            .in('user_id', memberUserIds)
            .range(from, to),
        )
      : Promise.resolve([]),
    questionIds.length
      ? fetchPaged<BonusQuestionOptionRow>((from, to) =>
          userClient
            .from('bonus_question_options')
            .select('id, question_id, label, sort_order')
            .in('question_id', questionIds)
            .order('sort_order', { ascending: true })
            .range(from, to),
        )
      : Promise.resolve([]),
    questionIds.length
      ? fetchPaged<BonusPredictionRow>((from, to) =>
          userClient
            .from('bonus_predictions')
            .select('id, question_id, user_id, answer_json, option_id, updated_at')
            .in('question_id', questionIds)
            .order('updated_at', { ascending: false })
            .range(from, to),
        )
      : Promise.resolve([]),
    teamIds.length
      ? fetchPaged<PlayerRow>((from, to) =>
          userClient
            .from('players')
            .select('id, team_id, name, position, shirt_number, active')
            .in('team_id', teamIds)
            .order('name', { ascending: true })
            .range(from, to),
        )
      : Promise.resolve([]),
  ])
  const profilesByUserId = new Map(profileRows.map((profile) => [profile.user_id, profile]))
  const generatedAt = new Date().toISOString()
  const text = buildBonusAnswersExport({
    leagueName: league.name,
    generatedAt,
    members: memberRows.map((member) => ({
      userId: member.user_id,
      displayName: profilesByUserId.get(member.user_id)?.display_name ?? member.user_id.slice(0, 8),
    })),
    questions: questionRows.map(mapQuestion),
    predictions: predictionRows.map(mapPrediction),
    options: optionRows.map(mapOption),
    teams: teamRows.map(mapTeam),
    players: playerRows.map(mapPlayer),
    stages: stageRows.map(mapStage),
  })

  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setResponseHeader(
    event,
    'Content-Disposition',
    `attachment; filename="${bonusAnswersExportFilename(league.name, generatedAt)}"`,
  )
  setResponseHeader(event, 'Cache-Control', 'no-store')

  return `\uFEFF${text}`
})

async function fetchPaged<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const rows: T[] = []

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1)

    if (error) {
      throw error
    }

    if (!data?.length) {
      break
    }

    rows.push(...data)

    if (data.length < pageSize) {
      break
    }
  }

  return rows
}

function mapQuestion(row: BonusQuestionRow): BonusQuestion {
  return {
    id: row.id,
    leagueId: row.league_id,
    slug: row.slug,
    title: row.title,
    points: row.points,
    deadlineAt: row.deadline_at,
    lockAt: row.lock_at,
    displayOrder: row.display_order ?? undefined,
    kind: row.kind,
    sourceKind: row.source_kind,
    configJson: row.config_json,
    correctOptionId: row.correct_option_id,
  }
}

function mapPrediction(row: BonusPredictionRow): BonusPrediction {
  return {
    id: row.id,
    questionId: row.question_id,
    userId: row.user_id,
    answerJson: row.answer_json,
    optionId: row.option_id,
    updatedAt: row.updated_at,
  }
}

function mapOption(row: BonusQuestionOptionRow): BonusQuestionOption {
  return {
    id: row.id,
    questionId: row.question_id,
    label: row.label,
    sortOrder: row.sort_order,
  }
}

function mapTeam(row: TeamRow): Team {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    name: row.name,
    countryCode: row.country_code,
    flag: row.flag_code?.toLowerCase() ?? '',
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
