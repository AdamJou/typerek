import type {
  TheSportsDbAuditDetails,
  TheSportsDbAuditStatus,
  TheSportsDbAuditSummary,
  TheSportsDbGoalAudit,
  TheSportsDbLocalResult,
  TheSportsDbMatchMapping,
  TheSportsDbPlayerMapping,
  TheSportsDbTeamMapping,
  TheSportsDbTeamSide,
} from '../../app/types/thesportsdb'
import type {
  TheSportsDbEvent,
  TheSportsDbTimelineEvent,
} from './sports-providers/thesportsdb-provider'

const MAX_KICKOFF_DIFFERENCE_MS = 6 * 60 * 60 * 1000

const TEAM_NAME_ALIASES: Record<string, string> = {
  'cape verde': 'cabo verde',
  'czech republic': 'czechia',
  'ivory coast': 'cote d ivoire',
  'south korea': 'korea republic',
  turkey: 'turkiye',
  usa: 'united states',
}

export interface AuditTeamRecord {
  id: string
  name: string
  provider: string | null
  externalId: string | null
}

export interface AuditMatchRecord {
  id: string
  provider: string | null
  externalId: string | null
  homeTeamId: string | null
  awayTeamId: string | null
  startsAtUtc: string
  status: string
  homeScore90: number | null
  awayScore90: number | null
  resultConfirmedAt: string | null
  matchNumber: number | null
}

export interface AuditPlayerRecord {
  id: string
  teamId: string
  name: string
}

export interface TheSportsDbAuditContext {
  teams: readonly AuditTeamRecord[]
  matches: readonly AuditMatchRecord[]
}

export interface TheSportsDbDetailsInput extends TheSportsDbAuditContext {
  event: TheSportsDbEvent
  timeline: readonly TheSportsDbTimelineEvent[]
  lineup: readonly Record<string, unknown>[]
  stats: readonly Record<string, unknown>[]
  players: readonly AuditPlayerRecord[]
  sourceErrors?: readonly string[]
}

export function buildTheSportsDbAuditSummary(
  event: TheSportsDbEvent,
  context: TheSportsDbAuditContext,
): TheSportsDbAuditSummary {
  const homeTeam = resolveTeam(event.idHomeTeam, event.strHomeTeam, context.teams)
  const awayTeam = resolveTeam(event.idAwayTeam, event.strAwayTeam, context.teams)
  const match = resolveMatch(event, homeTeam, awayTeam, context.matches)
  const warnings = mappingWarnings(homeTeam, awayTeam, match)

  if (match.status === 'matched') {
    warnings.push('Timeline nie został jeszcze pobrany. Pełność listy strzelców nie jest potwierdzona.')
  }

  return {
    externalEventId: cleanString(event.idEvent) ?? '',
    eventName: cleanString(event.strEvent)
      ?? `${cleanString(event.strHomeTeam) ?? 'TBD'} vs ${cleanString(event.strAwayTeam) ?? 'TBD'}`,
    startsAtUtc: buildKickoffAt(event),
    providerStatus: cleanString(event.strStatus),
    homeScore: toNullableInteger(event.intHomeScore),
    awayScore: toNullableInteger(event.intAwayScore),
    homeTeam,
    awayTeam,
    match,
    localResult: resolveLocalResult(match, context.matches),
    auditStatus: resolveSummaryStatus(homeTeam, awayTeam, match),
    warnings,
    raw: { ...event },
  }
}

export function buildTheSportsDbAuditDetails(input: TheSportsDbDetailsInput): TheSportsDbAuditDetails {
  const summary = buildTheSportsDbAuditSummary(input.event, input)
  const goals = normalizeGoalEvents(
    input.event,
    input.timeline,
    summary.homeTeam,
    summary.awayTeam,
    input.players,
  )
  const expectedHome = summary.homeScore ?? 0
  const expectedAway = summary.awayScore ?? 0
  const returnedHome = goals.filter((goal) => goal.teamSide === 'home').length
  const returnedAway = goals.filter((goal) => goal.teamSide === 'away').length
  const unknownTeamGoals = goals.filter((goal) => goal.teamSide === 'unknown').length
  const goalCoverage = {
    expectedHome,
    returnedHome,
    missingHome: Math.max(0, expectedHome - returnedHome),
    expectedAway,
    returnedAway,
    missingAway: Math.max(0, expectedAway - returnedAway),
    unknownTeamGoals,
  }
  const warnings = summary.warnings.filter((warning) => !warning.startsWith('Timeline nie został'))
  const sourceErrors = [...(input.sourceErrors ?? [])]

  if (summary.homeScore === null || summary.awayScore === null) {
    warnings.push('TheSportsDB nie zwrócił kompletnego wyniku meczu.')
  }

  if (goalCoverage.missingHome > 0 || goalCoverage.missingAway > 0) {
    warnings.push(
      `Timeline jest niekompletny: brakuje ${goalCoverage.missingHome} goli gospodarzy i ${goalCoverage.missingAway} goli gości.`,
    )
  }

  if (unknownTeamGoals > 0) {
    warnings.push(`${unknownTeamGoals} goli nie udało się przypisać do gospodarzy ani gości.`)
  }

  const unresolvedPlayers = goals.filter((goal) => goal.player.status !== 'matched')
  if (unresolvedPlayers.length > 0) {
    warnings.push(`${unresolvedPlayers.length} strzelców nie udało się jednoznacznie dopasować do zawodników aplikacji.`)
  }

  for (const sourceError of sourceErrors) {
    warnings.push(`Błąd opcjonalnego źródła: ${sourceError}`)
  }

  const auditStatus = resolveDetailsStatus(summary.auditStatus, {
    completeScore: summary.homeScore !== null && summary.awayScore !== null,
    completeGoalCounts:
      goalCoverage.missingHome === 0
      && goalCoverage.missingAway === 0
      && goalCoverage.unknownTeamGoals === 0,
    completePlayers: unresolvedPlayers.length === 0,
  })

  return {
    ...summary,
    auditStatus,
    warnings: uniqueStrings(warnings),
    goals,
    goalCoverage,
    firstScorerCertain: auditStatus === 'complete' && goals.length > 0,
    lineupCount: input.lineup.length,
    statsCount: input.stats.length,
    sourceErrors,
    rawDetails: {
      event: { ...input.event },
      timeline: input.timeline.map((item) => ({ ...item })),
      lineup: input.lineup.map((item) => ({ ...item })),
      stats: input.stats.map((item) => ({ ...item })),
    },
  }
}

export function normalizeGoalEvents(
  event: TheSportsDbEvent,
  timeline: readonly TheSportsDbTimelineEvent[],
  homeTeam: TheSportsDbTeamMapping,
  awayTeam: TheSportsDbTeamMapping,
  players: readonly AuditPlayerRecord[],
): TheSportsDbGoalAudit[] {
  const goals = timeline.flatMap((item, sourceIndex) => {
    if (!isGoalTimelineEvent(item)) {
      return []
    }

    const time = parseTimelineTime(item)
    const teamSide = resolveTimelineTeamSide(item, event)
    const internalTeamId = teamSide === 'home'
      ? homeTeam.internalTeamId
      : teamSide === 'away'
        ? awayTeam.internalTeamId
        : null
    const ownGoal = containsNormalized(
      [item.strTimelineDetail, item.strDetail, item.strComment].join(' '),
      'own goal',
    )
    const playerTeamId = ownGoal
      ? teamSide === 'home'
        ? awayTeam.internalTeamId
        : teamSide === 'away'
          ? homeTeam.internalTeamId
          : null
      : internalTeamId
    const playerNames = [
      cleanString(item.strPlayer),
      cleanString(item.strPlayerName),
      cleanString(item.strPlayerAlternate),
    ].filter((name): name is string => Boolean(name))

    return [{
      sourceIndex,
      goal: {
        sequence: 0,
        timelineId: cleanString(item.idTimeline)
          ?? `${cleanString(event.idEvent) ?? 'event'}-goal-${sourceIndex + 1}`,
        minute: time.minute,
        extraMinute: time.extraMinute,
        minuteLabel: formatMinute(time.minute, time.extraMinute),
        detail: cleanString(item.strTimelineDetail) ?? cleanString(item.strDetail),
        ownGoal,
        teamSide,
        externalTeamId: cleanString(item.idTeam),
        externalTeamName: cleanString(item.strTeam),
        internalTeamId,
        externalPlayerId: cleanString(item.idPlayer),
        externalPlayerName: playerNames[0] ?? null,
        player: resolvePlayer(playerNames, playerTeamId, players),
      } satisfies TheSportsDbGoalAudit,
    }]
  })

  return goals
    .sort((left, right) =>
      left.goal.minute - right.goal.minute
      || (left.goal.extraMinute ?? 0) - (right.goal.extraMinute ?? 0)
      || left.sourceIndex - right.sourceIndex,
    )
    .map(({ goal }, index) => ({
      ...goal,
      sequence: index + 1,
    }))
}

export function normalizeTheSportsDbText(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function resolveTeam(
  externalIdValue: unknown,
  externalNameValue: unknown,
  teams: readonly AuditTeamRecord[],
): TheSportsDbTeamMapping {
  const externalId = cleanString(externalIdValue)
  const externalName = cleanString(externalNameValue)
  const directCandidates = externalId
    ? teams.filter((team) => team.provider === 'thesportsdb' && team.externalId === externalId)
    : []

  if (directCandidates.length > 0) {
    return teamMapping(externalId, externalName, directCandidates, 'external_id')
  }

  const normalizedExternalName = normalizeTheSportsDbText(externalName)
  const aliasedName = TEAM_NAME_ALIASES[normalizedExternalName] ?? normalizedExternalName
  const nameCandidates = aliasedName
    ? teams.filter((team) => normalizeTheSportsDbText(team.name) === aliasedName)
    : []

  return teamMapping(
    externalId,
    externalName,
    nameCandidates,
    aliasedName !== normalizedExternalName ? 'alias' : 'name',
  )
}

function teamMapping(
  externalId: string | null,
  externalName: string | null,
  candidates: readonly AuditTeamRecord[],
  matchedBy: TheSportsDbTeamMapping['matchedBy'],
): TheSportsDbTeamMapping {
  const status = mappingStatus(candidates.length)
  const resolved = status === 'matched' ? candidates[0]! : null

  return {
    externalId,
    externalName,
    status,
    matchedBy: resolved ? matchedBy : null,
    internalTeamId: resolved?.id ?? null,
    internalTeamName: resolved?.name ?? null,
    candidates: candidates.map((team) => ({ id: team.id, name: team.name })),
  }
}

function resolveMatch(
  event: TheSportsDbEvent,
  homeTeam: TheSportsDbTeamMapping,
  awayTeam: TheSportsDbTeamMapping,
  matches: readonly AuditMatchRecord[],
): TheSportsDbMatchMapping {
  const eventId = cleanString(event.idEvent)
  const directCandidates = eventId
    ? matches.filter((match) => match.provider === 'thesportsdb' && match.externalId === eventId)
    : []

  if (directCandidates.length > 0) {
    return matchMapping(directCandidates, 'external_id', buildKickoffAt(event))
  }

  if (
    homeTeam.status !== 'matched'
    || awayTeam.status !== 'matched'
    || !homeTeam.internalTeamId
    || !awayTeam.internalTeamId
  ) {
    return emptyMatchMapping()
  }

  const kickoffAt = buildKickoffAt(event)
  const kickoffTime = kickoffAt ? Date.parse(kickoffAt) : Number.NaN

  if (!Number.isFinite(kickoffTime)) {
    return emptyMatchMapping()
  }

  const candidates = matches
    .filter((match) =>
      match.homeTeamId === homeTeam.internalTeamId
      && match.awayTeamId === awayTeam.internalTeamId,
    )
    .map((match) => ({
      match,
      difference: Math.abs(Date.parse(match.startsAtUtc) - kickoffTime),
    }))
    .filter((candidate) => Number.isFinite(candidate.difference) && candidate.difference <= MAX_KICKOFF_DIFFERENCE_MS)
    .sort((left, right) =>
      left.difference - right.difference
      || (left.match.matchNumber ?? Number.MAX_SAFE_INTEGER) - (right.match.matchNumber ?? Number.MAX_SAFE_INTEGER),
    )

  if (candidates.length === 0) {
    return emptyMatchMapping()
  }

  const closestDifference = candidates[0]!.difference
  const closestMatches = candidates
    .filter((candidate) => candidate.difference === closestDifference)
    .map((candidate) => candidate.match)

  return matchMapping(closestMatches, 'teams_and_kickoff', kickoffAt)
}

function matchMapping(
  candidates: readonly AuditMatchRecord[],
  matchedBy: TheSportsDbMatchMapping['matchedBy'],
  externalKickoffAt: string | null,
): TheSportsDbMatchMapping {
  const status = mappingStatus(candidates.length)
  const resolved = status === 'matched' ? candidates[0]! : null
  const difference = resolved && externalKickoffAt
    ? Math.round(Math.abs(Date.parse(resolved.startsAtUtc) - Date.parse(externalKickoffAt)) / 60_000)
    : null

  return {
    status,
    matchedBy: resolved ? matchedBy : null,
    internalMatchId: resolved?.id ?? null,
    matchNumber: resolved?.matchNumber ?? null,
    startsAtUtc: resolved?.startsAtUtc ?? null,
    kickoffDifferenceMinutes: Number.isFinite(difference) ? difference : null,
    candidates: candidates.map((match) => ({
      id: match.id,
      matchNumber: match.matchNumber,
      startsAtUtc: match.startsAtUtc,
    })),
  }
}

function emptyMatchMapping(): TheSportsDbMatchMapping {
  return {
    status: 'unmatched',
    matchedBy: null,
    internalMatchId: null,
    matchNumber: null,
    startsAtUtc: null,
    kickoffDifferenceMinutes: null,
    candidates: [],
  }
}

function resolvePlayer(
  externalNames: readonly string[],
  internalTeamId: string | null,
  players: readonly AuditPlayerRecord[],
): TheSportsDbPlayerMapping {
  if (!internalTeamId || externalNames.length === 0) {
    return emptyPlayerMapping()
  }

  const teamPlayers = players.filter((player) => player.teamId === internalTeamId)
  const normalizedNames = uniqueStrings(externalNames.map(normalizeTheSportsDbText).filter(Boolean))
  const exactCandidates = teamPlayers.filter((player) =>
    normalizedNames.includes(normalizeTheSportsDbText(player.name)),
  )

  if (exactCandidates.length > 0) {
    return playerMapping(exactCandidates, 'exact_name')
  }

  const externalTokenSets = normalizedNames
    .map((name) => new Set(name.split(' ').filter(Boolean)))
    .filter((tokens) => tokens.size >= 2)
  const tokenCandidates = teamPlayers.filter((player) => {
    const playerTokens = new Set(normalizeTheSportsDbText(player.name).split(' ').filter(Boolean))

    return externalTokenSets.some((externalTokens) =>
      isTokenSubset(externalTokens, playerTokens) || isTokenSubset(playerTokens, externalTokens),
    )
  })

  return playerMapping(tokenCandidates, tokenCandidates.length ? 'name_tokens' : null)
}

function playerMapping(
  candidates: readonly AuditPlayerRecord[],
  matchedBy: TheSportsDbPlayerMapping['matchedBy'],
): TheSportsDbPlayerMapping {
  const status = mappingStatus(candidates.length)
  const resolved = status === 'matched' ? candidates[0]! : null

  return {
    status,
    matchedBy: resolved ? matchedBy : null,
    internalPlayerId: resolved?.id ?? null,
    internalPlayerName: resolved?.name ?? null,
    candidates: candidates.map((player) => ({ id: player.id, name: player.name })),
  }
}

function emptyPlayerMapping(): TheSportsDbPlayerMapping {
  return {
    status: 'unmatched',
    matchedBy: null,
    internalPlayerId: null,
    internalPlayerName: null,
    candidates: [],
  }
}

function mappingWarnings(
  homeTeam: TheSportsDbTeamMapping,
  awayTeam: TheSportsDbTeamMapping,
  match: TheSportsDbMatchMapping,
) {
  const warnings: string[] = []

  if (homeTeam.status !== 'matched') {
    warnings.push(`Nie udało się jednoznacznie dopasować gospodarzy: ${homeTeam.externalName ?? 'brak nazwy'}.`)
  }

  if (awayTeam.status !== 'matched') {
    warnings.push(`Nie udało się jednoznacznie dopasować gości: ${awayTeam.externalName ?? 'brak nazwy'}.`)
  }

  if (match.status !== 'matched') {
    warnings.push('Nie udało się jednoznacznie dopasować meczu do terminarza aplikacji.')
  }

  return warnings
}

function resolveSummaryStatus(
  homeTeam: TheSportsDbTeamMapping,
  awayTeam: TheSportsDbTeamMapping,
  match: TheSportsDbMatchMapping,
): TheSportsDbAuditStatus {
  return homeTeam.status === 'matched' && awayTeam.status === 'matched' && match.status === 'matched'
    ? 'partial'
    : 'unmapped'
}

function resolveDetailsStatus(
  summaryStatus: TheSportsDbAuditStatus,
  completeness: {
    completeScore: boolean
    completeGoalCounts: boolean
    completePlayers: boolean
  },
): TheSportsDbAuditStatus {
  if (summaryStatus === 'unmapped') {
    return 'unmapped'
  }

  return completeness.completeScore && completeness.completeGoalCounts && completeness.completePlayers
    ? 'complete'
    : 'partial'
}

function resolveLocalResult(
  matchMapping: TheSportsDbMatchMapping,
  matches: readonly AuditMatchRecord[],
): TheSportsDbLocalResult {
  const match = matches.find((candidate) => candidate.id === matchMapping.internalMatchId)

  if (!match) {
    return {
      state: 'missing',
      homeScore: null,
      awayScore: null,
    }
  }

  return {
    state: match.status === 'confirmed' || Boolean(match.resultConfirmedAt)
      ? 'confirmed'
      : match.homeScore90 !== null && match.awayScore90 !== null
        ? 'saved'
        : 'missing',
    homeScore: match.homeScore90,
    awayScore: match.awayScore90,
  }
}

function resolveTimelineTeamSide(
  item: TheSportsDbTimelineEvent,
  event: TheSportsDbEvent,
): TheSportsDbTeamSide {
  const teamId = cleanString(item.idTeam)

  if (teamId && teamId === cleanString(event.idHomeTeam)) {
    return 'home'
  }

  if (teamId && teamId === cleanString(event.idAwayTeam)) {
    return 'away'
  }

  const teamName = canonicalTeamName(item.strTeam)
  if (teamName && teamName === canonicalTeamName(event.strHomeTeam)) {
    return 'home'
  }

  if (teamName && teamName === canonicalTeamName(event.strAwayTeam)) {
    return 'away'
  }

  return 'unknown'
}

function isGoalTimelineEvent(item: TheSportsDbTimelineEvent) {
  const type = normalizeTheSportsDbText(
    [item.strTimeline, item.strTimelineDetail, item.strType, item.strDetail].join(' '),
  )
  const excluded = ['disallowed', 'cancelled', 'canceled', 'no goal'].some((phrase) => type.includes(phrase))

  return type.includes('goal') && !excluded
}

function parseTimelineTime(item: TheSportsDbTimelineEvent) {
  const explicitExtra = toNullableInteger(item.intExtraTime)
  const rawValue = item.intTime ?? item.intMinute ?? item.strTime
  const text = String(rawValue ?? '').trim()
  const addedTime = text.match(/^(\d+)\s*[+]\s*(\d+)$/)

  if (addedTime) {
    return {
      minute: Number(addedTime[1]),
      extraMinute: Number(addedTime[2]),
    }
  }

  return {
    minute: toNullableInteger(rawValue) ?? 0,
    extraMinute: explicitExtra,
  }
}

function formatMinute(minute: number, extraMinute: number | null) {
  return extraMinute && extraMinute > 0 ? `${minute}+${extraMinute}'` : `${minute}'`
}

function buildKickoffAt(event: TheSportsDbEvent) {
  const timestamp = cleanString(event.strTimestamp)

  if (timestamp) {
    return normalizeUtcTimestamp(timestamp)
  }

  const date = cleanString(event.dateEvent)
  if (!date) {
    return null
  }

  return normalizeUtcTimestamp(`${date}T${cleanString(event.strTime) ?? '00:00:00'}`)
}

function normalizeUtcTimestamp(value: string) {
  const withZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`
  const timestamp = Date.parse(withZone)

  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
}

function canonicalTeamName(value: unknown) {
  const normalized = normalizeTheSportsDbText(value)
  return TEAM_NAME_ALIASES[normalized] ?? normalized
}

function cleanString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function toNullableInteger(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? Math.trunc(numericValue) : null
}

function mappingStatus(candidateCount: number) {
  return candidateCount === 1 ? 'matched' : candidateCount > 1 ? 'ambiguous' : 'unmatched'
}

function containsNormalized(value: unknown, phrase: string) {
  return normalizeTheSportsDbText(value).includes(normalizeTheSportsDbText(phrase))
}

function isTokenSubset(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  return [...left].every((token) => right.has(token))
}

function uniqueStrings(values: readonly string[]) {
  return [...new Set(values)]
}
