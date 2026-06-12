export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'confirmed' | 'postponed'

export type StageCode =
  | 'group_round_1'
  | 'group_round_2'
  | 'group_round_3'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarter_finals'
  | 'semi_finals'
  | 'third_place'
  | 'final'

export interface Tournament {
  id: string
  slug: string
  name: string
  seasonYear: number
  startsAt: string
  endsAt: string
}

export interface TournamentStage {
  id: string
  tournamentId: string
  code: StageCode
  name: string
  shortName: string
  sortOrder: number
}

export interface Team {
  id: string
  tournamentId: string
  name: string
  countryCode: string | null
  flag: string
  groupCode?: string | null
  confederation?: string | null
}

export interface Player {
  id: string
  teamId: string
  name: string
  position: string | null
  shirtNumber?: number | null
  active: boolean
}

export interface Match {
  id: string
  tournamentId: string
  stageId: string
  homeTeamId: string | null
  awayTeamId: string | null
  matchNumber?: number | null
  roundName?: string | null
  groupCode?: string | null
  venue?: string | null
  homePlaceholder?: string | null
  awayPlaceholder?: string | null
  startsAtUtc: string
  status: MatchStatus
  homeScore90: number | null
  awayScore90: number | null
  firstScorerPlayerId: string | null
  noScorerConfirmed: boolean
  resultConfirmedAt: string | null
}

export interface MatchEvent {
  id: string
  matchId: string
  provider: string | null
  providerEventId: string | null
  eventType: string
  minute: number
  extraMinute: number | null
  teamId: string | null
  playerId: string | null
  playerName: string | null
  detail: string | null
  createdAt: string
}

export interface MatchScorerInput {
  teamId: string
  playerId: string | null
  minute: number
  ownGoal?: boolean
}

export interface League {
  id: string
  tournamentId: string
  name: string
  ownerUserId: string
}

export interface LeagueMember {
  id: string
  leagueId: string
  userId: string
  displayName: string
  status: 'active' | 'removed'
  joinedAt: string
}

export interface MatchPrediction {
  id: string
  leagueId: string
  userId: string
  matchId: string
  predictedHomeScore: number
  predictedAwayScore: number
  firstScorerPlayerId: string | null
  noScorer: boolean
  updatedAt: string
}

export interface MatchPredictionPresence {
  matchId: string
  userId: string
}

export interface ScoringRules {
  resultPoints: number
  exactScoreBonus: number
  firstScorerPoints: number
  firstScorerBonusPoints: number
}

export interface ScoreBreakdown {
  leagueId: string
  userId: string
  sourceType: 'match' | 'bonus'
  sourceId: string
  stageId: string | null
  outcomePoints: number
  exactScorePoints: number
  firstScorerPoints: number
  bonusPoints: number
  totalPoints: number
}

export interface RankingRow {
  userId: string
  displayName: string
  position: number
  totalPoints: number
  outcomePoints: number
  exactScorePoints: number
  firstScorerPoints: number
  bonusPoints: number
}

export type BonusQuestionKind =
  | 'player_numeric'
  | 'team_numeric'
  | 'team_single'
  | 'team_stage_exit'
  | 'player_single'
  | 'boolean'
  | 'numeric'
  | 'duel_player'
  | 'duel_team'
  | 'ranked_top4'
  | 'ranked_group_table'
  | 'comparison_numeric'

export type BonusQuestionSourceKind =
  | 'fixed_player'
  | 'fixed_team'
  | 'players'
  | 'goalkeepers'
  | 'teams'
  | 'host_teams'
  | 'team_stages'
  | 'duel_players'
  | 'duel_teams'
  | 'comparison_options'
  | 'group_teams'
  | 'manual_fact'
  | 'tournament_fact'

export interface BonusQuestionConfig {
  subjectLabel?: string
  subjectPlayerName?: string
  subjectTeamName?: string
  playerNames?: readonly string[]
  teamNames?: readonly string[]
  hostTeamNames?: readonly string[]
  comparisonOptions?: ReadonlyArray<{
    key: string
    label: string
  }>
  threshold?: number
  maxValue?: number
  stageCodes?: readonly string[]
  groupSize?: number
  maxSelections?: number
  helperText?: string
  note?: string
  [key: string]: unknown
}

export interface BonusQuestionResolution {
  id: string
  questionId: string
  status: 'pending' | 'resolved' | 'manual_override' | 'missing_data'
  answerJson: Record<string, unknown> | null
  sourceSnapshotJson: Record<string, unknown> | null
  sourceStatus: 'auto' | 'partial' | 'manual'
  note: string | null
  updatedAt: string
}

export interface BonusQuestion {
  id: string
  leagueId: string
  slug?: string | null
  title: string
  points: number
  deadlineAt: string
  lockAt?: string | null
  displayOrder?: number
  kind?: BonusQuestionKind | null
  sourceKind?: BonusQuestionSourceKind | null
  configJson?: BonusQuestionConfig | null
  correctOptionId: string | null
}

export interface BonusQuestionOption {
  id: string
  questionId: string
  label: string
  sortOrder: number
}

export interface BonusPrediction {
  id: string
  questionId: string
  userId: string
  answerJson: Record<string, unknown> | null
  optionId?: string | null
  updatedAt: string
}

export type BonusStatisticEntityType = 'team' | 'player' | 'choice'

export type BonusStatisticMetric =
  | 'answer'
  | 'top4_presence'
  | 'numeric_distribution'
  | 'group_consensus'

export type BonusStatisticSection =
  | 'featured'
  | 'awards'
  | 'duels'
  | 'sentiments'
  | 'picks'
  | 'forecasts'
  | 'groups'
  | 'insights'

export interface BonusStatisticOption {
  key: string
  count: number
  averagePosition?: number | null
}

export interface BonusStatisticGroupTeam {
  key: string
  averagePosition: number
  positionVotes: number[]
}

export interface BonusStatisticGroup {
  groupCode: string
  respondentCount: number
  teams: BonusStatisticGroupTeam[]
}

export interface BonusStatisticCard {
  questionSlug: string
  title: string
  entityType: BonusStatisticEntityType
  metric: BonusStatisticMetric
  section: BonusStatisticSection
  respondentCount: number
  options: BonusStatisticOption[]
  averageValue?: number | null
  medianValue?: number | null
  groups?: BonusStatisticGroup[]
}

export interface BonusStatisticsSnapshot {
  leagueId: string
  generatedAt: string
  memberCount: number
  version: number
  cards: BonusStatisticCard[]
}

export interface SynchronizationLog {
  id: string
  provider: 'api-football' | 'football-data' | 'manual'
  status: 'success' | 'warning' | 'error'
  startedAt: string
  finishedAt: string | null
  requestCount: number
  message: string
}
