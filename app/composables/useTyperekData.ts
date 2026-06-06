import { computed, reactive, readonly, shallowRef } from 'vue'
import { TyperekRepository } from '~/repositories/TyperekRepository'
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
  Player,
  ScoreBreakdown,
  SynchronizationLog,
  Team,
  Tournament,
  TournamentStage,
} from '~/types/domain'
import type {
  SetMatchResultPayload,
  UpsertBonusPredictionPayload,
  UpsertMatchPredictionPayload,
} from '~/repositories/TyperekRepository'
import { aggregateRanking, currentPredictionStageId } from '~/utils/scoring'

const tournament = reactive<Tournament>(emptyTournament())
const league = reactive<League>(emptyLeague())
const stages = reactive<TournamentStage[]>([])
const teams = reactive<Team[]>([])
const players = reactive<Player[]>([])
const matches = reactive<Match[]>([])
const matchEvents = reactive<MatchEvent[]>([])
const members = reactive<LeagueMember[]>([])
const bonusQuestions = reactive<BonusQuestion[]>([])
const bonusOptions = reactive<BonusQuestionOption[]>([])
const bonusResolutions = reactive<BonusQuestionResolution[]>([])
const synchronizationLogs = reactive<SynchronizationLog[]>([])
const predictions = shallowRef<MatchPrediction[]>([])
const bonusPredictions = shallowRef<BonusPrediction[]>([])
const scoreBreakdowns = shallowRef<ScoreBreakdown[]>([])
const currentUserId = shallowRef<string | null>(null)
const isLoading = shallowRef(false)
const hasLoaded = shallowRef(false)
const errorMessage = shallowRef('')
let loadPromise: Promise<void> | null = null

export function useTyperekData() {
  const ranking = computed(() => aggregateRanking(scoreBreakdowns.value, members))
  const currentStage = computed(() => {
    const activeStageId = currentPredictionStageId(stages, matches)

    return stages.find((stage) => stage.id === activeStageId) ?? stages[0] ?? null
  })
  const currentStageRanking = computed(() => aggregateRanking(scoreBreakdowns.value, members, currentStage.value?.id))
  const hasLeague = computed(() => Boolean(league.id))

  if (import.meta.client && !hasLoaded.value && !isLoading.value) {
    void loadTyperekData()
  }

  async function refresh() {
    await loadTyperekData({ force: true })
  }

  async function upsertLocalPrediction(prediction: MatchPrediction) {
    const savedPrediction = await upsertPrediction({
      matchId: prediction.matchId,
      predictedHomeScore: prediction.predictedHomeScore,
      predictedAwayScore: prediction.predictedAwayScore,
      firstScorerPlayerId: prediction.firstScorerPlayerId,
      noScorer: prediction.noScorer,
    })

    return savedPrediction
  }

  async function upsertPrediction(payload: UpsertMatchPredictionPayload) {
    const repository = getRepository()
    const savedPrediction = await repository.upsertMatchPrediction(payload)
    upsertPredictionInState(savedPrediction)
    return savedPrediction
  }

  async function upsertBonusPrediction(payload: UpsertBonusPredictionPayload) {
    const repository = getRepository()
    const savedPrediction = await repository.upsertBonusPrediction(payload)
    upsertBonusPredictionInState(savedPrediction)
    return savedPrediction
  }

  async function deleteBonusPrediction(questionId: string) {
    const repository = getRepository()
    await repository.deleteBonusPrediction(questionId)
    bonusPredictions.value = bonusPredictions.value.filter((prediction) => prediction.questionId !== questionId)
  }

  async function deletePrediction(matchId: string) {
    const repository = getRepository()
    await repository.deleteMatchPrediction(matchId)
    predictions.value = predictions.value.filter((prediction) => prediction.matchId !== matchId)
  }

  async function setMatchResult(payload: SetMatchResultPayload) {
    const { supabase } = useSupabase()
    const { data } = await supabase.value!.auth.getSession()
    const accessToken = data.session?.access_token
    const response = await $fetch<{ match: Match; matchEvents: MatchEvent[] }>('/api/admin/match-result', {
      method: 'POST',
      body: payload,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })

    replaceMatchInState(response.match)
    replaceMatchEventsForMatch(response.match.id, response.matchEvents)
    await refresh()
    return response.match
  }

  return {
    tournament,
    league,
    stages: readonly(stages),
    teams: readonly(teams),
    players: readonly(players),
    matches: readonly(matches),
    matchEvents: readonly(matchEvents),
    members: readonly(members),
    predictions: readonly(predictions),
    bonusQuestions: readonly(bonusQuestions),
    bonusOptions: readonly(bonusOptions),
    bonusPredictions: readonly(bonusPredictions),
    bonusResolutions: readonly(bonusResolutions),
    synchronizationLogs: readonly(synchronizationLogs),
    scoreBreakdowns: readonly(scoreBreakdowns),
    ranking,
    currentStage,
    currentStageRanking,
    currentUserId: readonly(currentUserId),
    isLoading: readonly(isLoading),
    hasLoaded: readonly(hasLoaded),
    hasLeague,
    errorMessage: readonly(errorMessage),
    refresh,
    upsertLocalPrediction,
    upsertPrediction,
    deletePrediction,
    upsertBonusPrediction,
    deleteBonusPrediction,
    setMatchResult,
  }
}

export function clearTyperekData() {
  Object.assign(tournament, emptyTournament())
  Object.assign(league, emptyLeague())
  replaceArray(stages, [])
  replaceArray(teams, [])
  replaceArray(players, [])
  replaceArray(matches, [])
  replaceArray(matchEvents, [])
  replaceArray(members, [])
  replaceArray(bonusQuestions, [])
  replaceArray(bonusOptions, [])
  replaceArray(bonusResolutions, [])
  replaceArray(synchronizationLogs, [])
  predictions.value = []
  bonusPredictions.value = []
  scoreBreakdowns.value = []
  currentUserId.value = null
  isLoading.value = false
  hasLoaded.value = false
  errorMessage.value = ''
  loadPromise = null
}

async function loadTyperekData(options: { force?: boolean } = {}) {
  if (hasLoaded.value && !options.force) {
    return
  }

  if (loadPromise && !options.force) {
    return loadPromise
  }

  loadPromise = doLoadTyperekData()

  try {
    await loadPromise
  } finally {
    loadPromise = null
  }
}

async function doLoadTyperekData() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const repository = getRepository()
    const { supabase } = useSupabase()
    const { data: userData } = await supabase.value!.auth.getUser()
    const userId = userData.user?.id ?? null
    const snapshot = await repository.getWorldCupSnapshot(userId)

    currentUserId.value = userId
    applySnapshot(snapshot)
    hasLoaded.value = true
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Nie udało się pobrać danych.'
    hasLoaded.value = false
  } finally {
    isLoading.value = false
  }
}

function getRepository() {
  const { supabase, isConfigured } = useSupabase()

  if (!isConfigured || !supabase.value) {
    throw new Error('Aplikacja nie jest jeszcze gotowa do pobierania danych.')
  }

  return new TyperekRepository(supabase.value)
}

function applySnapshot(snapshot: Awaited<ReturnType<TyperekRepository['getWorldCupSnapshot']>>) {
  Object.assign(tournament, snapshot.tournament)
  Object.assign(league, snapshot.league ?? emptyLeague(snapshot.tournament))
  replaceArray(stages, snapshot.stages)
  replaceArray(teams, snapshot.teams)
  replaceArray(players, snapshot.players)
  replaceArray(matches, snapshot.matches)
  replaceArray(matchEvents, snapshot.matchEvents)
  replaceArray(members, snapshot.members)
  replaceArray(bonusQuestions, snapshot.bonusQuestions)
  replaceArray(bonusOptions, snapshot.bonusOptions)
  replaceArray(bonusResolutions, snapshot.bonusResolutions)
  replaceArray(synchronizationLogs, snapshot.synchronizationLogs)
  predictions.value = snapshot.predictions
  bonusPredictions.value = snapshot.bonusPredictions
  scoreBreakdowns.value = snapshot.scoreBreakdowns
}

function upsertPredictionInState(prediction: MatchPrediction) {
  const nextPredictions = predictions.value.filter((candidate) => candidate.id !== prediction.id)
  const existingIndex = nextPredictions.findIndex(
    (candidate) =>
      candidate.leagueId === prediction.leagueId &&
      candidate.userId === prediction.userId &&
      candidate.matchId === prediction.matchId,
  )

  if (existingIndex >= 0) {
    nextPredictions.splice(existingIndex, 1, prediction)
  } else {
    nextPredictions.unshift(prediction)
  }

  predictions.value = nextPredictions
}

function upsertBonusPredictionInState(prediction: BonusPrediction) {
  const nextPredictions = bonusPredictions.value.filter((candidate) => candidate.id !== prediction.id)
  const existingIndex = nextPredictions.findIndex(
    (candidate) => candidate.questionId === prediction.questionId && candidate.userId === prediction.userId,
  )

  if (existingIndex >= 0) {
    nextPredictions.splice(existingIndex, 1, prediction)
  } else {
    nextPredictions.unshift(prediction)
  }

  bonusPredictions.value = nextPredictions
}

function replaceMatchInState(match: Match) {
  const matchIndex = matches.findIndex((candidate) => candidate.id === match.id)

  if (matchIndex >= 0) {
    matches.splice(matchIndex, 1, match)
    return
  }

  matches.push(match)
}

function replaceMatchEventsForMatch(matchId: string, nextEvents: MatchEvent[]) {
  const otherEvents = matchEvents.filter((event) => event.matchId !== matchId)
  replaceArray(matchEvents, [...otherEvents, ...nextEvents])
}

function replaceArray<T>(target: T[], next: T[]) {
  target.splice(0, target.length, ...next)
}

function emptyTournament(): Tournament {
  return {
    id: '',
    slug: 'world-cup-2026',
    name: 'Mistrzostwa Świata 2026',
    seasonYear: 2026,
    startsAt: '',
    endsAt: '',
  }
}

function emptyLeague(tournamentValue: Tournament = tournament): League {
  return {
    id: '',
    tournamentId: tournamentValue.id,
    name: '',
    ownerUserId: '',
  }
}
