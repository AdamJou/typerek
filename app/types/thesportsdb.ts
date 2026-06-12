export type TheSportsDbAuditStatus = 'complete' | 'partial' | 'unmapped'
export type TheSportsDbMappingStatus = 'matched' | 'ambiguous' | 'unmatched'
export type TheSportsDbTeamSide = 'home' | 'away' | 'unknown'
export type TheSportsDbLocalResultState = 'missing' | 'saved' | 'confirmed'

export interface TheSportsDbTeamMapping {
  externalId: string | null
  externalName: string | null
  status: TheSportsDbMappingStatus
  matchedBy: 'external_id' | 'name' | 'alias' | null
  internalTeamId: string | null
  internalTeamName: string | null
  candidates: Array<{
    id: string
    name: string
  }>
}

export interface TheSportsDbMatchMapping {
  status: TheSportsDbMappingStatus
  matchedBy: 'external_id' | 'teams_and_kickoff' | null
  internalMatchId: string | null
  matchNumber: number | null
  startsAtUtc: string | null
  kickoffDifferenceMinutes: number | null
  candidates: Array<{
    id: string
    matchNumber: number | null
    startsAtUtc: string
  }>
}

export interface TheSportsDbLocalResult {
  state: TheSportsDbLocalResultState
  homeScore: number | null
  awayScore: number | null
}

export interface TheSportsDbPlayerMapping {
  status: TheSportsDbMappingStatus
  matchedBy: 'exact_name' | 'name_tokens' | null
  internalPlayerId: string | null
  internalPlayerName: string | null
  candidates: Array<{
    id: string
    name: string
  }>
}

export interface TheSportsDbGoalAudit {
  sequence: number
  timelineId: string
  minute: number
  extraMinute: number | null
  minuteLabel: string
  detail: string | null
  ownGoal: boolean
  teamSide: TheSportsDbTeamSide
  externalTeamId: string | null
  externalTeamName: string | null
  internalTeamId: string | null
  externalPlayerId: string | null
  externalPlayerName: string | null
  player: TheSportsDbPlayerMapping
}

export interface TheSportsDbAuditSummary {
  externalEventId: string
  eventName: string
  startsAtUtc: string | null
  providerStatus: string | null
  homeScore: number | null
  awayScore: number | null
  homeTeam: TheSportsDbTeamMapping
  awayTeam: TheSportsDbTeamMapping
  match: TheSportsDbMatchMapping
  localResult: TheSportsDbLocalResult
  auditStatus: TheSportsDbAuditStatus
  warnings: string[]
  raw: Record<string, unknown>
}

export interface TheSportsDbGoalCoverage {
  expectedHome: number
  returnedHome: number
  missingHome: number
  expectedAway: number
  returnedAway: number
  missingAway: number
  unknownTeamGoals: number
}

export interface TheSportsDbAuditDetails extends TheSportsDbAuditSummary {
  goals: TheSportsDbGoalAudit[]
  goalCoverage: TheSportsDbGoalCoverage
  firstScorerCertain: boolean
  lineupCount: number
  statsCount: number
  sourceErrors: string[]
  rawDetails: {
    event: Record<string, unknown>
    timeline: Record<string, unknown>[]
    lineup: Record<string, unknown>[]
    stats: Record<string, unknown>[]
  }
}

export interface TheSportsDbResultsResponse {
  ok: true
  source: 'thesportsdb'
  fetchedAt: string
  totalEvents: number
  expectedTournamentMatches: number
  coverageComplete: boolean
  warnings: string[]
  results: TheSportsDbAuditSummary[]
}

export interface TheSportsDbEventDetailsResponse {
  ok: true
  source: 'thesportsdb'
  fetchedAt: string
  audit: TheSportsDbAuditDetails
}
