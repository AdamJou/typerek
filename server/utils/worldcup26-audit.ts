import type {
  WorldCup26AuditDetails,
  WorldCup26AuditStatus,
  WorldCup26AuditSummary,
  WorldCup26GoalAudit,
  WorldCup26LocalResult,
  WorldCup26MatchMapping,
  WorldCup26PlayerMapping,
  WorldCup26TeamMapping,
  WorldCup26TeamSide,
} from '../../app/types/worldcup26'
import type {
  AuditMatchRecord,
  AuditPlayerRecord,
  AuditTeamRecord,
} from './thesportsdb-audit'
import {
  cleanWorldCup26String,
  isFinishedWorldCup26Game,
  toWorldCup26Integer,
  type WorldCup26Game,
} from './sports-providers/worldcup26-provider'

const TEAM_NAME_ALIASES: Record<string, string> = {
  'bosnia and herzegovina': 'bosnia herzegovina',
  'cape verde': 'cabo verde',
  'czech republic': 'czechia',
  'ivory coast': 'cote d ivoire',
  'south korea': 'korea republic',
  turkey: 'turkiye',
  usa: 'united states',
}

export interface WorldCup26AuditContext {
  teams: readonly AuditTeamRecord[]
  matches: readonly AuditMatchRecord[]
}

export interface WorldCup26DetailsInput extends WorldCup26AuditContext {
  game: WorldCup26Game
  players: readonly AuditPlayerRecord[]
}

export interface ParsedWorldCup26Scorer {
  playerName: string
  minute: number | null
  extraMinute: number | null
  teamSide: WorldCup26TeamSide
  ownGoal: boolean
  penalty: boolean
  detail: string | null
  raw: string
  sourceIndex: number
}

export function buildWorldCup26AuditSummary(
  game: WorldCup26Game,
  context: WorldCup26AuditContext,
): WorldCup26AuditSummary {
  const homeTeam = resolveTeam(
    game.home_team_id,
    game.home_team_name_en ?? game.home_team_label,
    context.teams,
  )
  const awayTeam = resolveTeam(
    game.away_team_id,
    game.away_team_name_en ?? game.away_team_label,
    context.teams,
  )
  const match = resolveMatch(game, homeTeam, awayTeam, context.matches)
  const localResult = resolveLocalResult(match, context.matches)
  const homeScore = toWorldCup26Integer(game.home_score)
  const awayScore = toWorldCup26Integer(game.away_score)
  const warnings = mappingWarnings(homeTeam, awayTeam, match)
  const numberedMatch = context.matches.find(candidate =>
    candidate.matchNumber === toWorldCup26Integer(game.id),
  )

  if (numberedMatch && match.matchedBy !== 'match_number') {
    warnings.push('Numer meczu wskazuje rekord z innymi drużynami; użyto wyłącznie jednoznacznego dopasowania pary drużyn.')
  }

  if (
    localResult.state !== 'missing'
    && (localResult.homeScore !== homeScore || localResult.awayScore !== awayScore)
  ) {
    warnings.push('Wynik WorldCup26 różni się od wyniku zapisanego w aplikacji.')
  }

  return {
    externalEventId: cleanWorldCup26String(game.id) ?? '',
    eventName: `${homeTeam.externalName ?? 'TBD'} vs ${awayTeam.externalName ?? 'TBD'}`,
    sourceLocalDate: cleanWorldCup26String(game.local_date),
    providerStatus: cleanWorldCup26String(game.time_elapsed)
      ?? (String(game.finished).toLowerCase() === 'true' ? 'finished' : null),
    homeScore,
    awayScore,
    homeTeam,
    awayTeam,
    match,
    localResult,
    auditStatus: resolveSummaryStatus(homeTeam, awayTeam, match),
    warnings: uniqueStrings(warnings),
    raw: { ...game },
  }
}

export function buildWorldCup26AuditDetails(
  input: WorldCup26DetailsInput,
): WorldCup26AuditDetails {
  const summary = buildWorldCup26AuditSummary(input.game, input)
  const parsedScorers = [
    ...parseWorldCup26Scorers(input.game.home_scorers, 'home'),
    ...parseWorldCup26Scorers(input.game.away_scorers, 'away'),
  ]
  const goals = normalizeWorldCup26Goals(
    input.game,
    parsedScorers,
    summary.homeTeam,
    summary.awayTeam,
    input.players,
  )
  const expectedHome = summary.homeScore ?? 0
  const expectedAway = summary.awayScore ?? 0
  const returnedHome = goals.filter(goal => goal.teamSide === 'home').length
  const returnedAway = goals.filter(goal => goal.teamSide === 'away').length
  const goalCoverage = {
    expectedHome,
    returnedHome,
    missingHome: Math.max(0, expectedHome - returnedHome),
    extraHome: Math.max(0, returnedHome - expectedHome),
    expectedAway,
    returnedAway,
    missingAway: Math.max(0, expectedAway - returnedAway),
    extraAway: Math.max(0, returnedAway - expectedAway),
  }
  const warnings = [...summary.warnings]
  const unresolvedPlayers = goals.filter(goal => goal.player.status !== 'matched')
  const goalsWithoutMinute = goals.filter(goal => goal.minute === null)
  const sourceOrderTie = hasCrossTeamMinuteTie(goals)
  const finished = isFinishedWorldCup26Game(input.game)
  const localResultMatches = summary.localResult.state === 'missing'
    || (
      summary.localResult.homeScore === summary.homeScore
      && summary.localResult.awayScore === summary.awayScore
    )

  if (summary.homeScore === null || summary.awayScore === null) {
    warnings.push('WorldCup26 nie zwrócił kompletnego wyniku meczu.')
  }

  if (!finished) {
    warnings.push('Mecz nie jest zakończony. Wynik i lista strzelców są wyłącznie danymi podglądowymi.')
  }

  if (
    goalCoverage.missingHome > 0
    || goalCoverage.extraHome > 0
    || goalCoverage.missingAway > 0
    || goalCoverage.extraAway > 0
  ) {
    warnings.push(
      `Lista strzelców nie zgadza się z wynikiem: gospodarze ${returnedHome}/${expectedHome}, goście ${returnedAway}/${expectedAway}.`,
    )
  }

  if (goalsWithoutMinute.length > 0) {
    warnings.push(`${goalsWithoutMinute.length} goli nie ma poprawnej minuty.`)
  }

  if (unresolvedPlayers.length > 0) {
    warnings.push(`${unresolvedPlayers.length} strzelców nie udało się jednoznacznie dopasować do zawodników aplikacji.`)
  }

  if (sourceOrderTie) {
    warnings.push('Gole obu drużyn mają identyczną minutę. Kolejność pokazuje gospodarzy przed gośćmi zgodnie z regułą audytu.')
  }

  const auditStatus = resolveDetailsStatus(summary.auditStatus, {
    completeScore: summary.homeScore !== null && summary.awayScore !== null,
    finished,
    completeGoalCounts:
      goalCoverage.missingHome === 0
      && goalCoverage.extraHome === 0
      && goalCoverage.missingAway === 0
      && goalCoverage.extraAway === 0,
    completeMinutes: goalsWithoutMinute.length === 0,
    completePlayers: unresolvedPlayers.length === 0,
    localResultMatches,
  })

  return {
    ...summary,
    auditStatus,
    warnings: uniqueStrings(warnings),
    goals,
    goalCoverage,
    firstScorerCertain: auditStatus === 'complete' && goals.length > 0 && !hasFirstGoalTie(goals),
    sourceOrderTie,
    rawDetails: {
      game: { ...input.game },
      parsedScorers: parsedScorers.map(scorer => ({ ...scorer })),
    },
  }
}

export function parseWorldCup26Scorers(
  value: unknown,
  teamSide: WorldCup26TeamSide,
): ParsedWorldCup26Scorer[] {
  const cleaned = cleanScorersValue(value)
  if (!cleaned) {
    return []
  }

  return cleaned
    .split(/\s*,\s*/)
    .map(item => item.replace(/^"+|"+$/g, '').trim())
    .filter(Boolean)
    .map((raw, sourceIndex) => parseSingleScorer(raw, teamSide, sourceIndex))
}

export function normalizeWorldCup26Goals(
  game: WorldCup26Game,
  parsedScorers: readonly ParsedWorldCup26Scorer[],
  homeTeam: WorldCup26TeamMapping,
  awayTeam: WorldCup26TeamMapping,
  players: readonly AuditPlayerRecord[],
): WorldCup26GoalAudit[] {
  const externalEventId = cleanWorldCup26String(game.id) ?? 'unknown'

  return parsedScorers
    .map((scorer) => {
      const scoringTeam = scorer.teamSide === 'home' ? homeTeam : awayTeam
      const playerTeam = scorer.ownGoal
        ? scorer.teamSide === 'home' ? awayTeam : homeTeam
        : scoringTeam

      return {
        sourceIndex: scorer.sourceIndex,
        goal: {
          sequence: 0,
          goalId: `${externalEventId}-${scorer.teamSide}-${scorer.sourceIndex + 1}`,
          minute: scorer.minute,
          extraMinute: scorer.extraMinute,
          minuteLabel: formatMinute(scorer.minute, scorer.extraMinute),
          detail: scorer.detail,
          ownGoal: scorer.ownGoal,
          penalty: scorer.penalty,
          teamSide: scorer.teamSide,
          externalTeamId: cleanWorldCup26String(
            scorer.teamSide === 'home' ? game.home_team_id : game.away_team_id,
          ),
          externalTeamName: scoringTeam.externalName,
          internalTeamId: scoringTeam.internalTeamId,
          externalPlayerName: scorer.playerName,
          player: resolvePlayer(scorer.playerName, playerTeam.internalTeamId, players),
          raw: scorer.raw,
        } satisfies WorldCup26GoalAudit,
      }
    })
    .sort((left, right) =>
      nullableMinuteSort(left.goal.minute, right.goal.minute)
      || (left.goal.extraMinute ?? 0) - (right.goal.extraMinute ?? 0)
      || teamSideRank(left.goal.teamSide) - teamSideRank(right.goal.teamSide)
      || left.sourceIndex - right.sourceIndex,
    )
    .map(({ goal }, index) => ({
      ...goal,
      sequence: index + 1,
    }))
}

export function normalizeWorldCup26Text(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function worldCup26GameSortValue(game: WorldCup26Game) {
  const match = cleanWorldCup26String(game.local_date)
    ?.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/)

  if (!match) {
    return Number.MAX_SAFE_INTEGER
  }

  return Date.UTC(
    Number(match[3]),
    Number(match[1]) - 1,
    Number(match[2]),
    Number(match[4]),
    Number(match[5]),
  )
}

function cleanScorersValue(value: unknown) {
  const stringValue = cleanWorldCup26String(value)
  if (!stringValue) {
    return null
  }

  return stringValue
    .replace(/[{}[\]]/g, '')
    .replace(/[\u201c\u201d\u201e]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/â€œ|â€|â€ś|â€ť/g, '"')
    .replace(/â€˜|â€™/g, "'")
    .trim()
}

function parseSingleScorer(
  raw: string,
  teamSide: WorldCup26TeamSide,
  sourceIndex: number,
): ParsedWorldCup26Scorer {
  const minuteMatch = raw.match(/(\d{1,3})(?:\s*\+\s*(\d{1,2}))?\s*['’]/)
  const annotations = [...raw.matchAll(/\(([^)]+)\)/g)].map(match => match[1]!.trim())
  const normalizedAnnotations = normalizeWorldCup26Text(annotations.join(' '))
  const playerName = raw
    .replace(/(\d{1,3})(?:\s*\+\s*(\d{1,2}))?\s*['’]/, '')
    .replace(/\([^)]*\)/g, '')
    .trim()

  return {
    playerName,
    minute: minuteMatch ? Number(minuteMatch[1]) : null,
    extraMinute: minuteMatch?.[2] ? Number(minuteMatch[2]) : null,
    teamSide,
    ownGoal: /\b(og|o g|own goal|samoboj)\b/.test(normalizedAnnotations),
    penalty: /\b(p|pen|penalty|karny)\b/.test(normalizedAnnotations),
    detail: annotations.length ? annotations.join(', ') : null,
    raw,
    sourceIndex,
  }
}

function resolveTeam(
  externalIdValue: unknown,
  externalNameValue: unknown,
  teams: readonly AuditTeamRecord[],
): WorldCup26TeamMapping {
  const externalId = cleanWorldCup26String(externalIdValue)
  const externalName = cleanWorldCup26String(externalNameValue)
  const directCandidates = externalId
    ? teams.filter(team => team.provider === 'worldcup26' && team.externalId === externalId)
    : []

  if (directCandidates.length > 0) {
    return teamMapping(externalId, externalName, directCandidates, 'external_id')
  }

  const normalizedExternalName = normalizeWorldCup26Text(externalName)
  const aliasedName = TEAM_NAME_ALIASES[normalizedExternalName] ?? normalizedExternalName
  const nameCandidates = aliasedName
    ? teams.filter(team => normalizeWorldCup26Text(team.name) === aliasedName)
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
  matchedBy: WorldCup26TeamMapping['matchedBy'],
): WorldCup26TeamMapping {
  const status = mappingStatus(candidates.length)
  const resolved = status === 'matched' ? candidates[0]! : null

  return {
    externalId,
    externalName,
    status,
    matchedBy: resolved ? matchedBy : null,
    internalTeamId: resolved?.id ?? null,
    internalTeamName: resolved?.name ?? null,
    candidates: candidates.map(team => ({ id: team.id, name: team.name })),
  }
}

function resolveMatch(
  game: WorldCup26Game,
  homeTeam: WorldCup26TeamMapping,
  awayTeam: WorldCup26TeamMapping,
  matches: readonly AuditMatchRecord[],
): WorldCup26MatchMapping {
  if (
    homeTeam.status !== 'matched'
    || awayTeam.status !== 'matched'
    || !homeTeam.internalTeamId
    || !awayTeam.internalTeamId
  ) {
    return emptyMatchMapping()
  }

  const matchNumber = toWorldCup26Integer(game.id)
  const numberedCandidates = matchNumber === null
    ? []
    : matches.filter(match =>
        match.matchNumber === matchNumber
        && match.homeTeamId === homeTeam.internalTeamId
        && match.awayTeamId === awayTeam.internalTeamId,
      )

  if (numberedCandidates.length > 0) {
    return matchMapping(numberedCandidates, 'match_number')
  }

  const teamCandidates = matches.filter(match =>
    match.homeTeamId === homeTeam.internalTeamId
    && match.awayTeamId === awayTeam.internalTeamId,
  )

  return matchMapping(teamCandidates, teamCandidates.length ? 'teams' : null)
}

function matchMapping(
  candidates: readonly AuditMatchRecord[],
  matchedBy: WorldCup26MatchMapping['matchedBy'],
): WorldCup26MatchMapping {
  const status = mappingStatus(candidates.length)
  const resolved = status === 'matched' ? candidates[0]! : null

  return {
    status,
    matchedBy: resolved ? matchedBy : null,
    internalMatchId: resolved?.id ?? null,
    matchNumber: resolved?.matchNumber ?? null,
    startsAtUtc: resolved?.startsAtUtc ?? null,
    candidates: candidates.map(match => ({
      id: match.id,
      matchNumber: match.matchNumber,
      startsAtUtc: match.startsAtUtc,
    })),
  }
}

function emptyMatchMapping(): WorldCup26MatchMapping {
  return {
    status: 'unmatched',
    matchedBy: null,
    internalMatchId: null,
    matchNumber: null,
    startsAtUtc: null,
    candidates: [],
  }
}

function resolvePlayer(
  externalName: string,
  internalTeamId: string | null,
  players: readonly AuditPlayerRecord[],
): WorldCup26PlayerMapping {
  if (!internalTeamId || !externalName) {
    return emptyPlayerMapping()
  }

  const teamPlayers = players.filter(player => player.teamId === internalTeamId)
  const normalizedExternalName = normalizeWorldCup26Text(externalName)
  const exactCandidates = teamPlayers.filter(player =>
    normalizeWorldCup26Text(player.name) === normalizedExternalName,
  )

  if (exactCandidates.length > 0) {
    return playerMapping(exactCandidates, 'exact_name')
  }

  const externalTokens = normalizedExternalName.split(' ').filter(Boolean)
  const externalTokenSet = new Set(externalTokens)
  const tokenCandidates = externalTokens.length >= 2
    ? teamPlayers.filter((player) => {
        const playerTokens = new Set(normalizeWorldCup26Text(player.name).split(' ').filter(Boolean))
        return isTokenSubset(externalTokenSet, playerTokens) || isTokenSubset(playerTokens, externalTokenSet)
      })
    : []

  if (tokenCandidates.length > 0) {
    return playerMapping(tokenCandidates, 'name_tokens')
  }

  const initialsCandidates = teamPlayers.filter(player =>
    matchesInitialsAndSurname(externalTokens, normalizeWorldCup26Text(player.name).split(' ').filter(Boolean)),
  )

  return playerMapping(
    initialsCandidates,
    initialsCandidates.length ? 'initials_and_surname' : null,
  )
}

function matchesInitialsAndSurname(externalTokens: string[], playerTokens: string[]) {
  if (externalTokens.length < 2 || playerTokens.length < 2) {
    return false
  }

  const externalSurname = externalTokens.at(-1)
  const playerSurname = playerTokens.at(-1)
  const externalInitials = externalTokens.slice(0, -1)

  if (
    externalSurname !== playerSurname
    || externalInitials.some(token => token.length !== 1)
    || externalInitials.length > playerTokens.length - 1
  ) {
    return false
  }

  return externalInitials.every((initial, index) => playerTokens[index]?.startsWith(initial))
}

function playerMapping(
  candidates: readonly AuditPlayerRecord[],
  matchedBy: WorldCup26PlayerMapping['matchedBy'],
): WorldCup26PlayerMapping {
  const status = mappingStatus(candidates.length)
  const resolved = status === 'matched' ? candidates[0]! : null

  return {
    status,
    matchedBy: resolved ? matchedBy : null,
    internalPlayerId: resolved?.id ?? null,
    internalPlayerName: resolved?.name ?? null,
    candidates: candidates.map(player => ({ id: player.id, name: player.name })),
  }
}

function emptyPlayerMapping(): WorldCup26PlayerMapping {
  return {
    status: 'unmatched',
    matchedBy: null,
    internalPlayerId: null,
    internalPlayerName: null,
    candidates: [],
  }
}

function mappingWarnings(
  homeTeam: WorldCup26TeamMapping,
  awayTeam: WorldCup26TeamMapping,
  match: WorldCup26MatchMapping,
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
  homeTeam: WorldCup26TeamMapping,
  awayTeam: WorldCup26TeamMapping,
  match: WorldCup26MatchMapping,
): WorldCup26AuditStatus {
  return homeTeam.status === 'matched' && awayTeam.status === 'matched' && match.status === 'matched'
    ? 'partial'
    : 'unmapped'
}

function resolveDetailsStatus(
  summaryStatus: WorldCup26AuditStatus,
  completeness: {
    completeScore: boolean
    finished: boolean
    completeGoalCounts: boolean
    completeMinutes: boolean
    completePlayers: boolean
    localResultMatches: boolean
  },
): WorldCup26AuditStatus {
  if (summaryStatus === 'unmapped') {
    return 'unmapped'
  }

  return Object.values(completeness).every(Boolean) ? 'complete' : 'partial'
}

function resolveLocalResult(
  matchMapping: WorldCup26MatchMapping,
  matches: readonly AuditMatchRecord[],
): WorldCup26LocalResult {
  const match = matches.find(candidate => candidate.id === matchMapping.internalMatchId)

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

function formatMinute(minute: number | null, extraMinute: number | null) {
  if (minute === null) {
    return '?'
  }

  return extraMinute && extraMinute > 0 ? `${minute}+${extraMinute}'` : `${minute}'`
}

function hasCrossTeamMinuteTie(goals: readonly WorldCup26GoalAudit[]) {
  return goals.some((goal, index) =>
    goals.slice(index + 1).some(candidate =>
      goal.minute !== null
      && goal.minute === candidate.minute
      && (goal.extraMinute ?? 0) === (candidate.extraMinute ?? 0)
      && goal.teamSide !== candidate.teamSide,
    ),
  )
}

function hasFirstGoalTie(goals: readonly WorldCup26GoalAudit[]) {
  if (goals.length < 2) {
    return false
  }

  const [first, second] = goals
  return first!.minute !== null
    && first!.minute === second!.minute
    && (first!.extraMinute ?? 0) === (second!.extraMinute ?? 0)
    && first!.teamSide !== second!.teamSide
}

function nullableMinuteSort(left: number | null, right: number | null) {
  return (left ?? Number.MAX_SAFE_INTEGER) - (right ?? Number.MAX_SAFE_INTEGER)
}

function teamSideRank(teamSide: WorldCup26TeamSide) {
  return teamSide === 'home' ? 0 : 1
}

function mappingStatus(candidateCount: number) {
  return candidateCount === 1 ? 'matched' : candidateCount > 1 ? 'ambiguous' : 'unmatched'
}

function isTokenSubset(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  return [...left].every(token => right.has(token))
}

function uniqueStrings(values: readonly string[]) {
  return [...new Set(values)]
}
