export type WorldCup26AuditStatus = 'complete' | 'partial' | 'unmapped'
export type WorldCup26MappingStatus = 'matched' | 'ambiguous' | 'unmatched'
export type WorldCup26TeamSide = 'home' | 'away'
export type WorldCup26LocalResultState = 'missing' | 'saved' | 'confirmed'

export interface WorldCup26TeamMapping {
  externalId: string | null
  externalName: string | null
  status: WorldCup26MappingStatus
  matchedBy: 'external_id' | 'name' | 'alias' | null
  internalTeamId: string | null
  internalTeamName: string | null
  candidates: Array<{
    id: string
    name: string
  }>
}

export interface WorldCup26MatchMapping {
  status: WorldCup26MappingStatus
  matchedBy: 'match_number' | 'teams' | null
  internalMatchId: string | null
  matchNumber: number | null
  startsAtUtc: string | null
  candidates: Array<{
    id: string
    matchNumber: number | null
    startsAtUtc: string
  }>
}

export interface WorldCup26LocalResult {
  state: WorldCup26LocalResultState
  homeScore: number | null
  awayScore: number | null
}

export interface WorldCup26PlayerMapping {
  status: WorldCup26MappingStatus
  matchedBy: 'exact_name' | 'name_tokens' | 'initials_and_surname' | null
  internalPlayerId: string | null
  internalPlayerName: string | null
  candidates: Array<{
    id: string
    name: string
  }>
}

export interface WorldCup26GoalAudit {
  sequence: number
  goalId: string
  minute: number | null
  extraMinute: number | null
  minuteLabel: string
  detail: string | null
  ownGoal: boolean
  penalty: boolean
  teamSide: WorldCup26TeamSide
  externalTeamId: string | null
  externalTeamName: string | null
  internalTeamId: string | null
  externalPlayerName: string
  player: WorldCup26PlayerMapping
  raw: string
}

export interface WorldCup26AuditSummary {
  externalEventId: string
  eventName: string
  sourceLocalDate: string | null
  providerStatus: string | null
  homeScore: number | null
  awayScore: number | null
  homeTeam: WorldCup26TeamMapping
  awayTeam: WorldCup26TeamMapping
  match: WorldCup26MatchMapping
  localResult: WorldCup26LocalResult
  auditStatus: WorldCup26AuditStatus
  warnings: string[]
  raw: Record<string, unknown>
}

export interface WorldCup26GoalCoverage {
  expectedHome: number
  returnedHome: number
  missingHome: number
  extraHome: number
  expectedAway: number
  returnedAway: number
  missingAway: number
  extraAway: number
}

export interface WorldCup26AuditDetails extends WorldCup26AuditSummary {
  goals: WorldCup26GoalAudit[]
  goalCoverage: WorldCup26GoalCoverage
  firstScorerCertain: boolean
  sourceOrderTie: boolean
  rawDetails: {
    game: Record<string, unknown>
    parsedScorers: Array<Record<string, unknown>>
  }
}

export interface WorldCup26ResultsResponse {
  ok: true
  source: 'worldcup26'
  fetchedAt: string
  totalEvents: number
  expectedTournamentMatches: number
  coverageComplete: boolean
  warnings: string[]
  results: WorldCup26AuditSummary[]
}

export interface WorldCup26EventDetailsResponse {
  ok: true
  source: 'worldcup26'
  fetchedAt: string
  audit: WorldCup26AuditDetails
}
