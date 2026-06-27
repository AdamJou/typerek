import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const TEAMS_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.teams.json'
const MATCHES_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'
const SQUAD_FILE = 'SquadLists-English.txt'

const STAGE_BY_KNOCKOUT_ROUND = {
  'Round of 32': 'round_of_32',
  'Round of 16': 'round_of_16',
  'Quarter-final': 'quarter_finals',
  'Semi-final': 'semi_finals',
  'Match for third place': 'third_place',
  Final: 'final',
}

// Confirmed by the live tournament bracket before the upstream fixture file was updated.
const CONFIRMED_KNOCKOUT_TEAMS = {
  74: { home: 'GER', away: 'PAR' },
  77: { home: 'FRA', away: 'SWE' },
  78: { home: 'CIV', away: 'NOR' },
  81: { home: 'USA', away: 'BIH' },
  86: { home: 'ARG', away: 'CPV' },
  88: { home: 'AUS', away: 'EGY' },
}

async function loadJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`)
  }

  return await response.json()
}

function cleanText(value) {
  return value
    .replace(/\0/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeLastNames(value) {
  return cleanText(value)
    .replace(/\bM (?=[A-ZÀ-Þ])/g, 'M')
    .replace(/\bMV OM\b/g, 'MVOM')
}

function normalizeFirstNames(value, lastNames) {
  const firstNames = cleanText(value)
  const compactLastName = lastNames.replace(/\s+/g, '')
  if (!compactLastName) {
    return firstNames
  }

  return firstNames
    .replace(new RegExp(`\\s+[A-ZÀ-Þ]?${escapeRegExp(compactLastName)}$`, 'i'), '')
    .trim()
}

function parseSquads() {
  const lines = readFileSync(SQUAD_FILE, 'utf8').split(/\r?\n/)
  const teamHeaderPattern = /^\s*(.+?)\s+\(([A-Z]{3})\)\s*$/
  const playerPattern = /^\s*(\d{1,2})\s*(GK|DF|MF|FW)\s+(.+?)\s{2,}(.+?)\s{2,}(.+?)\s{2,}(.+?)\s{2,}\d{2}\/\d{2}\/\d{4}/

  let currentTeamCode = null
  const players = []
  const teams = new Map()
  const rejectedPlayerLines = []

  for (const line of lines) {
    const teamMatch = line.match(teamHeaderPattern)
    if (teamMatch) {
      const teamName = cleanText(teamMatch[1])
      if (!['SQUAD LIST', 'ROLE'].includes(teamName)) {
        currentTeamCode = teamMatch[2]
        teams.set(currentTeamCode, teamName)
      }
      continue
    }

    if (!currentTeamCode || !/^\s*\d{1,2}\s*(GK|DF|MF|FW)\b/.test(line)) {
      continue
    }

    const playerMatch = line.match(playerPattern)
    if (!playerMatch) {
      rejectedPlayerLines.push({ teamCode: currentTeamCode, line: cleanText(line) })
      continue
    }

    const shirtNumber = Number(playerMatch[1])
    const position = playerMatch[2]
    const lastNames = normalizeLastNames(playerMatch[5])
    const firstNames = normalizeFirstNames(playerMatch[4], lastNames)
    const name = cleanText(`${firstNames} ${lastNames}`)

    players.push({
      team_code: currentTeamCode,
      shirt_number: shirtNumber,
      position,
      name,
    })
  }

  return {
    teams,
    players,
    rejectedPlayerLines,
  }
}

function parseOffsetDate(date, time) {
  const match = time.match(/^(\d{1,2}):(\d{2}) UTC([+-]\d{1,2})$/)
  if (!match) {
    throw new Error(`Unsupported match time: ${date} ${time}`)
  }

  const [, hourRaw, minuteRaw, offsetRaw] = match
  const [year, month, day] = date.split('-').map(Number)
  const hour = Number(hourRaw)
  const minute = Number(minuteRaw)
  const offset = Number(offsetRaw)
  return new Date(Date.UTC(year, month - 1, day, hour - offset, minute, 0)).toISOString()
}

function groupStageCode(match, groupCounters, nameToCode) {
  const homeCode = nameToCode.get(match.team1)
  const awayCode = nameToCode.get(match.team2)
  const homeRound = (groupCounters.get(homeCode) ?? 0) + 1
  const awayRound = (groupCounters.get(awayCode) ?? 0) + 1
  const round = Math.max(homeRound, awayRound)
  groupCounters.set(homeCode, homeRound)
  groupCounters.set(awayCode, awayRound)

  if (round < 1 || round > 3) {
    throw new Error(`Could not map group round for match ${match.team1} - ${match.team2}`)
  }

  return `group_round_${round}`
}

function buildTeams(rawTeams) {
  return rawTeams.map((team) => ({
    fifa_code: team.fifa_code,
    name: team.name_normalised ?? team.name,
    flag_code: team.flag_icon || null,
    group_code: team.group,
    confederation: team.confed,
  }))
}

function buildNameToCode(rawTeams) {
  const map = new Map()
  for (const team of rawTeams) {
    map.set(team.name, team.fifa_code)
    if (team.name_normalised) {
      map.set(team.name_normalised, team.fifa_code)
    }
  }
  return map
}

function buildMatches(rawMatches, rawTeams) {
  const nameToCode = buildNameToCode(rawTeams)
  const groupCounters = new Map()

  return rawMatches.map((match, index) => {
    const confirmedTeams = CONFIRMED_KNOCKOUT_TEAMS[match.num]
    const homeTeamCode = confirmedTeams?.home ?? nameToCode.get(match.team1) ?? null
    const awayTeamCode = confirmedTeams?.away ?? nameToCode.get(match.team2) ?? null
    const isGroupMatch = match.group?.startsWith('Group ')
    const groupCode = isGroupMatch ? match.group.replace('Group ', '') : null
    const stageCode = isGroupMatch
      ? groupStageCode(match, groupCounters, nameToCode)
      : STAGE_BY_KNOCKOUT_ROUND[match.round]

    if (!stageCode) {
      throw new Error(`Could not map stage for round: ${match.round}`)
    }

    return {
      external_id: `openfootball:2026:${match.num ?? index + 1}`,
      match_number: match.num ?? index + 1,
      stage_code: stageCode,
      round_name: match.round,
      group_code: groupCode,
      starts_at_utc: parseOffsetDate(match.date, match.time),
      home_team_code: homeTeamCode,
      away_team_code: awayTeamCode,
      home_placeholder: homeTeamCode ? null : match.team1,
      away_placeholder: awayTeamCode ? null : match.team2,
      venue: match.ground,
    }
  })
}

function validateData(teams, matches, squads) {
  const teamCodes = new Set(teams.map((team) => team.fifa_code))
  const squadCodes = new Set(squads.players.map((player) => player.team_code))
  const missingSquads = [...teamCodes].filter((code) => !squadCodes.has(code)).sort()
  const unknownSquads = [...squadCodes].filter((code) => !teamCodes.has(code)).sort()
  const playersByTeam = squads.players.reduce((acc, player) => {
    acc.set(player.team_code, (acc.get(player.team_code) ?? 0) + 1)
    return acc
  }, new Map())
  const teamsWithUnexpectedSquadSize = [...playersByTeam.entries()]
    .filter(([, count]) => count !== 26)
    .map(([teamCode, count]) => ({ teamCode, count }))

  return {
    teams: teams.length,
    matches: matches.length,
    players: squads.players.length,
    squadTeams: squadCodes.size,
    missingSquads,
    unknownSquads,
    teamsWithUnexpectedSquadSize,
    rejectedPlayerLines: squads.rejectedPlayerLines,
    matchStages: matches.reduce((acc, match) => {
      acc[match.stage_code] = (acc[match.stage_code] ?? 0) + 1
      return acc
    }, {}),
    placeholderMatches: matches.filter((match) => match.home_placeholder || match.away_placeholder).length,
  }
}

function sqlCall(functionName, payload) {
  return `select app_private.${functionName}($manual_import$${JSON.stringify(payload)}$manual_import$::jsonb);`
}

function loadLocalEnv() {
  const content = readFileSync('.env.local', 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const separator = line.indexOf('=')
    if (separator === -1) {
      continue
    }

    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, '')
    if (key && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

async function importPlayersViaTemporaryRpc(players, chunkSize) {
  loadLocalEnv()

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NUXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_KEY ?? process.env.NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const token = process.env.MANUAL_IMPORT_TOKEN

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL/SUPABASE_KEY in .env.local.')
  }

  if (!token) {
    throw new Error('Missing MANUAL_IMPORT_TOKEN.')
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  })

  let imported = 0
  for (let start = 0; start < players.length; start += chunkSize) {
    const chunk = players.slice(start, start + chunkSize)
    const { data, error } = await supabase.rpc('tmp_import_manual_players', {
      p_token: token,
      p_payload: chunk,
    })

    if (error) {
      throw new Error(`Player chunk ${start / chunkSize} failed: ${error.message}`)
    }

    imported += Number(data ?? 0)
    console.log(`players chunk ${start / chunkSize + 1}: ${data}`)
  }

  console.log(`players imported: ${imported}`)
}

async function main() {
  const command = process.argv[2] ?? 'summary'
  const rawTeams = await loadJson(TEAMS_URL)
  const worldCup = await loadJson(MATCHES_URL)
  const squads = parseSquads()
  const teams = buildTeams(rawTeams)
  const matches = buildMatches(worldCup.matches, rawTeams)
  const summary = validateData(teams, matches, squads)

  if (command === 'summary') {
    console.log(JSON.stringify(summary, null, 2))
    return
  }

  if (command === 'sql') {
    const kind = process.argv[3]
    const chunkIndex = Number(process.argv[4] ?? 0)
    const chunkSize = Number(process.argv[5] ?? 100)

    if (kind === 'teams') {
      const start = chunkIndex * chunkSize
      console.log(sqlCall('import_manual_teams', teams.slice(start, start + chunkSize)))
      return
    }

    if (kind === 'matches') {
      const start = chunkIndex * chunkSize
      console.log(sqlCall('import_manual_matches', matches.slice(start, start + chunkSize)))
      return
    }

    if (kind === 'players') {
      const start = chunkIndex * chunkSize
      const chunk = squads.players.slice(start, start + chunkSize)
      if (chunk.length === 0) {
        throw new Error(`No players in chunk ${chunkIndex} with chunk size ${chunkSize}.`)
      }

      console.log(sqlCall('import_manual_players', chunk))
      return
    }
  }

  if (command === 'rpc-players') {
    const chunkSize = Number(process.argv[3] ?? 100)
    await importPlayersViaTemporaryRpc(squads.players, chunkSize)
    return
  }

  throw new Error(`Unknown command. Use: summary | sql teams | sql matches | sql players <chunkIndex> <chunkSize>`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
