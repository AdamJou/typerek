import type { Match, MatchPrediction, Player, Team } from '~/types/domain'
import { WORLD_CUP_2026_TEAMS } from '../data/worldCup2026Teams'

const polishTeamNames: Record<string, string> = {
  Argentina: 'Argentyna',
  Australia: 'Australia',
  Algeria: 'Algieria',
  Austria: 'Austria',
  Belgium: 'Belgia',
  'Bosnia & Herzegovina': 'Bo\u015bnia i Hercegowina',
  Brazil: 'Brazylia',
  Cameroon: 'Kamerun',
  Canada: 'Kanada',
  'Cabo Verde': 'Republika Zielonego Przyl\u0105dka',
  Colombia: 'Kolumbia',
  'Congo DR': 'Demokratyczna Republika Konga',
  "Cote d'Ivoire": 'Wybrzeże Kości Słoniowej',
  "Côte d'Ivoire": 'Wybrzeże Kości Słoniowej',
  'Ivory Coast': 'Wybrzeże Kości Słoniowej',
  Croatia: 'Chorwacja',
  Czechia: 'Czechy',
  Denmark: 'Dania',
  Ecuador: 'Ekwador',
  Egypt: 'Egipt',
  England: 'Anglia',
  France: 'Francja',
  Germany: 'Niemcy',
  Ghana: 'Ghana',
  'IR Iran': 'Iran',
  Iran: 'Iran',
  Iraq: 'Irak',
  Italy: 'W\u0142ochy',
  Japan: 'Japonia',
  Jordan: 'Jordania',
  Mexico: 'Meksyk',
  Morocco: 'Maroko',
  Netherlands: 'Holandia',
  'New Zealand': 'Nowa Zelandia',
  Nigeria: 'Nigeria',
  Norway: 'Norwegia',
  Paraguay: 'Paragwaj',
  Poland: 'Polska',
  Portugal: 'Portugalia',
  Qatar: 'Katar',
  'Korea Republic': 'Korea Po\u0142udniowa',
  Romania: 'Rumunia',
  'Saudi Arabia': 'Arabia Saudyjska',
  Scotland: 'Szkocja',
  SCO: 'Szkocja',
  Senegal: 'Senegal',
  Serbia: 'Serbia',
  Slovakia: 'S\u0142owacja',
  Slovenia: 'S\u0142owenia',
  Spain: 'Hiszpania',
  'South Africa': 'Republika Południowej Afryki',
  Sweden: 'Szwecja',
  Switzerland: 'Szwajcaria',
  Tunisia: 'Tunezja',
  'T\u00fcrkiye': 'Turcja',
  Turkey: 'Turcja',
  Ukraine: 'Ukraina',
  Uruguay: 'Urugwaj',
  USA: 'USA',
  'United States': 'USA',
}

const positionLabels: Record<string, string> = {
  goalkeeper: 'Bramkarz',
  defender: 'Obro\u0144ca',
  midfielder: 'Pomocnik',
  forward: 'Napastnik',
  gk: 'Bramkarz',
  df: 'Obro\u0144ca',
  mf: 'Pomocnik',
  fw: 'Napastnik',
}

const positionWeight: Record<string, number> = {
  forward: 0,
  fw: 0,
  striker: 0,
  midfielder: 1,
  mf: 1,
  defender: 2,
  df: 2,
  goalkeeper: 3,
  gk: 3,
}

export interface PlayerNameParts {
  givenInitial: string
  surname: string
  suffix?: string
}

const playerNameDisplayOverrides: Record<string, PlayerNameParts> = {
  [normalizePlayerNameKey('Cristiano RonaldoDOS SANTOS AVEIRO RONALDO')]: { givenInitial: 'C.', surname: 'RONALDO' },
  [normalizePlayerNameKey('Neymar DA SILVA SANTOS JÚNIOR')]: { givenInitial: '', surname: 'NEYMAR JR' },
  [normalizePlayerNameKey('Vinicius José PAIXÃO DE OLIVEIRA JÚNIOR')]: { givenInitial: '', surname: 'VINICIUS JR' },
  [normalizePlayerNameKey('Lamine Yamal NASRAOUI EBANA')]: { givenInitial: 'L.', surname: 'YAMAL' },
  [normalizePlayerNameKey('Bruno Miguel BORGES FERNANDES')]: { givenInitial: 'B.', surname: 'FERNANDES' },
  [normalizePlayerNameKey('Romelu LUKAKU BOLINGOLI')]: { givenInitial: 'R.', surname: 'LUKAKU' },
}

export function formatPlayerDisplayName(fullName: string, suffix?: string) {
  const parts = formatPlayerNameParts(fullName, suffix)
  return [parts.givenInitial, parts.surname, parts.suffix].filter(Boolean).join(' ').trim()
}

export function displayTeamName(team: Team | undefined, fallback = 'Do ustalenia') {
  if (!team) {
    return fallback
  }

  return polishTeamNames[team.name] ?? team.name
}

export interface TeamFlagAsset {
  src: string | null
  emoji: string
  alt: string
}

type WorldCupTeam = (typeof WORLD_CUP_2026_TEAMS)[number]

const worldCupTeamByName = new Map<string, WorldCupTeam>(
  WORLD_CUP_2026_TEAMS.map((team: WorldCupTeam) => [normalizeLookupKey(team.namePl), team]),
)

const worldCupTeamAliases = new Map<string, WorldCupTeam>(
  WORLD_CUP_2026_TEAMS.flatMap((team: WorldCupTeam) =>
    (team.aliases ?? []).map((alias) => [normalizeLookupKey(alias), team] as const),
  ),
)

const worldCupTeamByFifaCode = new Map<string, WorldCupTeam>(
  WORLD_CUP_2026_TEAMS.map((team: WorldCupTeam) => [team.fifaCode.toUpperCase(), team]),
)

const worldCupTeamByFlagCode = new Map<string, WorldCupTeam>(
  WORLD_CUP_2026_TEAMS.map((team: WorldCupTeam) => [team.flagCode.toLowerCase(), team]),
)

function normalizeLookupKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

function emojiFromAlpha2(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) {
    return null
  }

  return [...code]
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join('')
}

function flagUrlFromCode(code: string) {
  return `https://flagsapi.com/${code.toUpperCase()}/flat/64.png`
}

export function getTeamFlag(team: Team | undefined): TeamFlagAsset {
  const fallback = {
    src: null,
    emoji: '🏳️',
    alt: team ? displayTeamName(team) : 'Flaga',
  }

  if (!team) {
    return fallback
  }

  const teamName = displayTeamName(team)
  const lookupKeys = [
    normalizeLookupKey(team.name),
    normalizeLookupKey(teamName),
    normalizeLookupKey(team.flag),
    normalizeLookupKey(team.countryCode ?? ''),
  ]

  const worldCupTeam =
    worldCupTeamByFlagCode.get(team.flag.trim().toLowerCase()) ??
    worldCupTeamByFifaCode.get(team.flag.trim().toUpperCase()) ??
    lookupKeys.map((key) => worldCupTeamByName.get(key) ?? worldCupTeamAliases.get(key)).find(Boolean)

  if (worldCupTeam) {
    return {
      src: worldCupTeam.flagUrl,
      emoji: worldCupTeam.emoji,
      alt: teamName,
    }
  }

  const rawFlag = (team.flag || '').trim()
  const rawCountryCode = (team.countryCode || '').trim().toUpperCase()
  const alpha2Code = /^[A-Z]{2}$/.test(rawFlag.toUpperCase())
    ? rawFlag.toUpperCase()
    : /^[A-Z]{2}$/.test(rawCountryCode)
      ? rawCountryCode
      : ''

  if (alpha2Code) {
    return {
      src: flagUrlFromCode(alpha2Code),
      emoji: emojiFromAlpha2(alpha2Code) ?? '🏳️',
      alt: teamName,
    }
  }

  if (rawFlag && rawFlag !== 'TBD') {
    return {
      src: null,
      emoji: rawFlag,
      alt: teamName,
    }
  }

  return fallback
}

export function displayTeamFlag(team: Team | undefined) {
  return getTeamFlag(team).emoji
}

export function displayPosition(position: string | null | undefined) {
  if (!position) {
    return ''
  }

  return positionLabels[position.toLowerCase()] ?? position
}

export function formatPlayerNameParts(fullName: string, suffix?: string): PlayerNameParts {
  const override = playerNameDisplayOverrides[normalizePlayerNameKey(fullName)]

  if (override) {
    return {
      ...override,
      suffix,
    }
  }

  const parts = fullName.trim().split(/\s+/).filter(Boolean)

  if (parts.length <= 1) {
    return {
      givenInitial: '',
      surname: (parts[0] ?? fullName).toUpperCase(),
      suffix,
    }
  }

  const surnameParts: string[] = []

  for (let index = parts.length - 1; index > 0; index -= 1) {
    const part = parts[index]!

    if (isUppercaseNamePart(part)) {
      surnameParts.unshift(part)
      continue
    }

    break
  }

  if (surnameParts.length === 0) {
    surnameParts.push(parts[parts.length - 1]!)
  }

  return {
    givenInitial: `${[...parts[0]!][0]?.toUpperCase() ?? ''}.`,
    surname: surnameParts.join(' ').toUpperCase(),
    suffix,
  }
}

function isUppercaseNamePart(value: string) {
  const lettersOnly = value.replace(/[^\p{L}]/gu, '')

  return lettersOnly.length > 0 && lettersOnly === lettersOnly.toUpperCase() && lettersOnly !== lettersOnly.toLowerCase()
}

function normalizePlayerNameKey(value: string) {
  return value
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export function sortPlayersForScorerSelect(players: readonly Player[]) {
  return [...players].sort((a, b) => {
    const positionA = positionWeight[a.position?.toLowerCase() ?? ''] ?? 2
    const positionB = positionWeight[b.position?.toLowerCase() ?? ''] ?? 2

    if (positionA !== positionB) {
      return positionA - positionB
    }

    return a.name.localeCompare(b.name, 'pl')
  })
}

export function compareMatchesChronologically(
  left: Pick<Match, 'startsAtUtc' | 'matchNumber'>,
  right: Pick<Match, 'startsAtUtc' | 'matchNumber'>,
) {
  const kickoffDelta = new Date(left.startsAtUtc).getTime() - new Date(right.startsAtUtc).getTime()

  if (kickoffDelta !== 0) {
    return kickoffDelta
  }

  return (left.matchNumber ?? Number.MAX_SAFE_INTEGER) - (right.matchNumber ?? Number.MAX_SAFE_INTEGER)
}

export function isMatchToday(match: Pick<Match, 'startsAtUtc' | 'status'>, now = new Date()) {
  if (match.status !== 'scheduled') {
    return false
  }

  const kickoff = new Date(match.startsAtUtc)

  return kickoff.toDateString() === now.toDateString()
}

type UpcomingMatchInput = Pick<Match, 'startsAtUtc' | 'status'> & Partial<Pick<Match, 'resultConfirmedAt'>>

function isUnsettledStartedMatch(match: UpcomingMatchInput, now: Date) {
  if (match.status === 'postponed' || match.status === 'confirmed' || Boolean(match.resultConfirmedAt)) {
    return false
  }

  return new Date(match.startsAtUtc).getTime() <= now.getTime()
}

export function isUpcomingMatch(match: UpcomingMatchInput, now = new Date()) {
  if (isUnsettledStartedMatch(match, now)) {
    return true
  }

  if (match.status !== 'scheduled' || Boolean(match.resultConfirmedAt)) {
    return false
  }

  const kickoff = new Date(match.startsAtUtc)

  if (kickoff.getTime() < now.getTime()) {
    return false
  }

  const endOfTomorrow = new Date(now)
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 1)
  endOfTomorrow.setHours(23, 59, 59, 999)

  return kickoff.getTime() <= endOfTomorrow.getTime()
}

export function isUpcomingMatchWithinHours(match: UpcomingMatchInput, hours: number, now = new Date()) {
  if (isUnsettledStartedMatch(match, now)) {
    return true
  }

  if (match.status !== 'scheduled' || Boolean(match.resultConfirmedAt) || hours <= 0) {
    return false
  }

  const kickoffTime = new Date(match.startsAtUtc).getTime()
  const nowTime = now.getTime()

  return kickoffTime >= nowTime && kickoffTime <= nowTime + hours * 60 * 60 * 1000
}

export function isUpcomingMatchToday(match: UpcomingMatchInput, now = new Date()) {
  if (isUnsettledStartedMatch(match, now)) {
    return true
  }

  if (match.status !== 'scheduled' || Boolean(match.resultConfirmedAt)) {
    return false
  }

  const kickoff = new Date(match.startsAtUtc)

  return kickoff.getTime() >= now.getTime() && kickoff.toDateString() === now.toDateString()
}

export function predictionScoreLabel(prediction: MatchPrediction) {
  return `${prediction.predictedHomeScore}:${prediction.predictedAwayScore}`
}
