import { BONUS_QUESTION_CATALOG, type BonusCatalogEntry, type BonusQuestionSection } from '~/data/bonusQuestionCatalog'
import type {
  BonusPrediction,
  BonusQuestion,
  BonusQuestionConfig,
  BonusQuestionKind,
  BonusQuestionSourceKind,
  Match,
  Player,
  Team,
  Tournament,
  TournamentStage,
} from '~/types/domain'
import { displayPosition, displayTeamName, formatPlayerDisplayName, formatPlayerNameParts } from '~/utils/footballUi'

export interface ResolvedBonusQuestion extends BonusQuestion {
  slug: string
  kind: BonusQuestionKind
  sourceKind: BonusQuestionSourceKind
  configJson: BonusQuestionConfig
  section: BonusQuestionSection
  sourceStatus: BonusCatalogEntry['sourceStatus']
  sourceNote: string
}

export interface BonusEntityOption {
  id: string
  label: string
  meta: string
  keywords: string[]
}

export interface BonusStageOption {
  value: string
  label: string
}

const stageLabelFallbacks: Record<string, string> = {
  group_round_1: 'Kolejka 1',
  group_round_2: 'Kolejka 2',
  group_round_3: 'Kolejka 3',
  round_of_32: '1/16 finału',
  round_of_16: '1/8 finału',
  quarter_finals: 'Ćwierćfinał',
  semi_finals: 'Półfinał',
  third_place: 'Mecz o 3. miejsce',
  final: 'Finał',
}

export function normalizeBonusText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

const catalogBySlug = new Map(BONUS_QUESTION_CATALOG.map((entry) => [entry.slug, entry]))
const catalogByTitle = new Map(BONUS_QUESTION_CATALOG.map((entry) => [normalizeBonusText(entry.title), entry]))

export function resolveBonusQuestion(question: BonusQuestion): ResolvedBonusQuestion {
  const catalogEntry =
    (question.slug ? catalogBySlug.get(question.slug) : undefined) ?? catalogByTitle.get(normalizeBonusText(question.title))

  if (!catalogEntry) {
    return {
      ...question,
      slug: question.slug ?? `bonus-${question.id}`,
      kind: question.kind ?? 'numeric',
      sourceKind: question.sourceKind ?? 'manual_fact',
      configJson: question.configJson ?? {},
      section: 'quick',
      sourceStatus: 'manual',
      sourceNote: 'Pytanie spoza katalogu. Wymaga konfiguracji w panelu admina.',
    }
  }

  return {
    ...question,
    slug: question.slug ?? catalogEntry.slug,
    kind: question.kind ?? catalogEntry.kind,
    sourceKind: question.sourceKind ?? catalogEntry.sourceKind,
    configJson: {
      ...catalogEntry.config,
      ...(question.configJson ?? {}),
    },
    section: catalogEntry.section,
    sourceStatus: catalogEntry.sourceStatus,
    sourceNote: catalogEntry.sourceNote,
  }
}

export function questionKindLabel(kind: BonusQuestionKind) {
  const labels: Record<BonusQuestionKind, string> = {
    player_numeric: 'Liczba zawodnika',
    team_numeric: 'Liczba drużyny',
    team_single: 'Jedna drużyna',
    team_stage_exit: 'Etap odpadnięcia',
    player_single: 'Jeden zawodnik',
    boolean: 'Tak / nie',
    numeric: 'Liczba',
    duel_player: 'Pojedynek zawodników',
    duel_team: 'Pojedynek drużyn',
    ranked_top4: 'Top 4',
    ranked_group_table: 'Grupy',
    comparison_numeric: 'Porównanie',
  }

  return labels[kind]
}

export function questionSectionLabel(section: BonusQuestionSection) {
  const labels: Record<BonusQuestionSection, string> = {
    quick: 'Szybkie pytania',
    picks: 'Wybory drużyn i zawodników',
    top4: 'Top 4',
    groups: 'Grupy',
  }

  return labels[section]
}

export function questionLockAt(question: BonusQuestion, globalLockAt: string | null) {
  return question.lockAt ?? question.deadlineAt ?? globalLockAt
}

export function resolveBonusGlobalLockAt(
  matches: readonly Pick<Match, 'startsAtUtc' | 'homeTeamId' | 'awayTeamId'>[],
  teams: readonly Team[],
  tournament?: Pick<Tournament, 'startsAt'> | null,
) {
  const mexicoTeam = teams.find((team) => normalizeBonusText(team.name) === 'mexico')
  const mexicoKickoff = mexicoTeam
    ? matches
        .filter((match) => match.homeTeamId === mexicoTeam.id || match.awayTeamId === mexicoTeam.id)
        .map((match) => new Date(match.startsAtUtc).getTime())
        .filter(Number.isFinite)
        .sort((left, right) => left - right)[0]
    : undefined

  if (typeof mexicoKickoff === 'number') {
    return new Date(mexicoKickoff).toISOString()
  }

  if (tournament?.startsAt) {
    return `${tournament.startsAt}T00:00:00+02:00`
  }

  const earliestKickoff = matches
    .map((match) => new Date(match.startsAtUtc).getTime())
    .filter(Number.isFinite)
    .sort((left, right) => left - right)[0]

  return typeof earliestKickoff === 'number' ? new Date(earliestKickoff).toISOString() : null
}

export function isBonusLocked(lockAt: string | null | undefined, now = new Date()) {
  if (!lockAt) {
    return false
  }

  return now.getTime() >= new Date(lockAt).getTime()
}

export function isBonusAnswerFilled(question: ResolvedBonusQuestion, answerJson: Record<string, unknown> | null | undefined) {
  if (!answerJson) {
    return false
  }

  switch (question.kind) {
    case 'boolean':
      return typeof answerJson.value === 'boolean'
    case 'numeric':
    case 'player_numeric':
    case 'team_numeric':
      return Number.isFinite(answerJson.value)
    case 'team_single':
      return typeof answerJson.teamId === 'string' && answerJson.teamId.length > 0
    case 'player_single':
      return typeof answerJson.playerId === 'string' && answerJson.playerId.length > 0
    case 'team_stage_exit':
      return typeof answerJson.stageCode === 'string' && answerJson.stageCode.length > 0
    case 'duel_player':
    case 'duel_team':
    case 'comparison_numeric':
      return typeof answerJson.winnerKey === 'string' && answerJson.winnerKey.length > 0
    case 'ranked_top4':
      return Array.isArray(answerJson.orderedTeamIds) && answerJson.orderedTeamIds.length === 4
    case 'ranked_group_table':
      return Array.isArray(answerJson.groups) && answerJson.groups.length > 0
    default:
      return false
  }
}

export function normalizeBonusNumericValue(value: string | number, maxValue: number) {
  if (value === '') {
    return null
  }

  const numericValue = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numericValue)) {
    return null
  }

  return Math.max(0, Math.min(maxValue, Math.trunc(numericValue)))
}

export function filledBonusCount(questions: readonly ResolvedBonusQuestion[], predictions: readonly BonusPrediction[]) {
  return questions.reduce((count, question) => {
    const prediction = predictions.find((candidate) => candidate.questionId === question.id)
    return count + (isBonusAnswerFilled(question, prediction?.answerJson) ? 1 : 0)
  }, 0)
}

export function defaultAnswerForQuestion(question: ResolvedBonusQuestion, teams: readonly Team[]) {
  switch (question.kind) {
    case 'ranked_group_table':
      return { groups: emptyGroupAnswer(teams) }
    default:
      return null
  }
}

export function resolveTeamByName(teams: readonly Team[], teamName: string | null | undefined) {
  if (!teamName) {
    return null
  }

  const normalizedName = normalizeBonusText(teamName)

  return (
    teams.find((team) => normalizeBonusText(team.name) === normalizedName) ??
    teams.find((team) => normalizeBonusText(displayTeamName(team)) === normalizedName) ??
    null
  )
}

export function resolvePlayerByName(players: readonly Player[], playerName: string | null | undefined) {
  if (!playerName) {
    return null
  }

  const normalizedName = normalizeBonusText(playerName)

  return players.find((player) => normalizeBonusText(player.name) === normalizedName) ?? null
}

export function playerOptions(players: readonly Player[], teams: readonly Team[], filter: 'all' | 'goalkeepers' = 'all') {
  return players
    .filter((player) => player.active)
    .filter((player) => (filter === 'goalkeepers' ? (player.position ?? '').toLowerCase() === 'gk' : true))
    .map<BonusEntityOption>((player) => {
      const team = teams.find((candidate) => candidate.id === player.teamId)
      const teamName = displayTeamName(team ?? undefined)
      const name = formatPlayerNameParts(player.name)

      return {
        id: player.id,
        label: [name.givenInitial, name.surname].filter(Boolean).join(' ').trim(),
        meta: [displayPosition(player.position), teamName].filter(Boolean).join(' · '),
        keywords: [player.name, teamName].map(normalizeBonusText),
      }
    })
    .sort((left, right) => left.label.localeCompare(right.label, 'pl'))
}

export function teamOptions(teams: readonly Team[]) {
  return teams
    .map<BonusEntityOption>((team) => ({
      id: team.id,
      label: displayTeamName(team),
      meta: [team.groupCode ? `Grupa ${team.groupCode}` : '', team.confederation ?? ''].filter(Boolean).join(' · '),
      keywords: [team.name, displayTeamName(team), team.groupCode ?? '', team.confederation ?? ''].map(normalizeBonusText),
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'pl'))
}

export function hostTeamOptions(teams: readonly Team[], config: BonusQuestionConfig) {
  const optionsById = new Map(teamOptions(teams).map((option) => [option.id, option]))

  return (config.hostTeamNames ?? [])
    .map((teamName) => resolveTeamByName(teams, teamName))
    .filter((team): team is Team => Boolean(team))
    .map((team) => optionsById.get(team.id))
    .filter((team): team is BonusEntityOption => Boolean(team))
}

export function optionsForQuestion(question: ResolvedBonusQuestion, teams: readonly Team[], players: readonly Player[]) {
  switch (question.sourceKind) {
    case 'players':
      return playerOptions(players, teams)
    case 'goalkeepers':
      return playerOptions(players, teams, 'goalkeepers')
    case 'teams':
      return teamOptions(teams)
    case 'host_teams':
      return hostTeamOptions(teams, question.configJson)
    default:
      return []
  }
}

export function fixedSubjectLabel(question: ResolvedBonusQuestion, teams: readonly Team[], players: readonly Player[]) {
  if (question.configJson.subjectPlayerName) {
    const player = resolvePlayerByName(players, question.configJson.subjectPlayerName)
    return player ? formatPlayerDisplayName(player.name) : formatPlayerDisplayName(question.configJson.subjectPlayerName)
  }

  if (question.configJson.subjectTeamName) {
    const team = resolveTeamByName(teams, question.configJson.subjectTeamName)
    return team ? displayTeamName(team) : question.configJson.subjectTeamName
  }

  return question.configJson.subjectLabel ?? null
}

export function fixedPlayer(question: ResolvedBonusQuestion, players: readonly Player[]) {
  return resolvePlayerByName(players, question.configJson.subjectPlayerName)
}

export function fixedTeam(question: ResolvedBonusQuestion, teams: readonly Team[]) {
  return resolveTeamByName(teams, question.configJson.subjectTeamName)
}

export function duelOptions(question: ResolvedBonusQuestion, teams: readonly Team[], players: readonly Player[]) {
  if (question.kind === 'duel_team') {
    return (question.configJson.teamNames ?? [])
      .map((teamName) => resolveTeamByName(teams, teamName))
      .filter((team): team is Team => Boolean(team))
      .map((team) => ({
        key: team.id,
        label: displayTeamName(team),
        meta: team.groupCode ? `Grupa ${team.groupCode}` : '',
      }))
  }

  if (question.kind === 'duel_player') {
    return (question.configJson.playerNames ?? [])
      .map((playerName) => resolvePlayerByName(players, playerName))
      .filter((player): player is Player => Boolean(player))
      .map((player) => {
        const name = formatPlayerNameParts(player.name)
        const team = teams.find((candidate) => candidate.id === player.teamId)

        return {
          key: player.id,
          label: [name.givenInitial, name.surname].filter(Boolean).join(' ').trim(),
          meta: displayTeamName(team ?? undefined),
        }
      })
  }

  return (question.configJson.comparisonOptions ?? []).map((option) => ({
    key: option.key,
    label: option.label,
    meta: '',
  }))
}

export function stageOptions(stages: readonly TournamentStage[]): BonusStageOption[] {
  return stages
    .map((stage) => ({
      value: stage.code,
      label: stageLabelFallbacks[stage.code] ?? stage.name,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'pl'))
}

export function groupedTeams(teams: readonly Team[]) {
  return [...teams]
    .filter((team) => team.groupCode)
    .reduce<Record<string, Team[]>>((groups, team) => {
      const groupCode = team.groupCode!
      groups[groupCode] ??= []
      groups[groupCode]!.push(team)
      groups[groupCode]!.sort((left, right) => displayTeamName(left).localeCompare(displayTeamName(right), 'pl'))
      return groups
    }, {})
}

export function emptyGroupAnswer(teams: readonly Team[]) {
  return Object.entries(groupedTeams(teams))
    .sort(([left], [right]) => left.localeCompare(right, 'pl'))
    .map(([groupCode, groupTeams]) => ({
      groupCode,
      orderedTeamIds: groupTeams.map((team) => team.id),
    }))
}

export function answerPreview(question: ResolvedBonusQuestion, answerJson: Record<string, unknown> | null, teams: readonly Team[], players: readonly Player[]) {
  if (!answerJson) {
    return 'Brak odpowiedzi'
  }

  switch (question.kind) {
    case 'boolean':
      return answerJson.value === true ? 'Tak' : answerJson.value === false ? 'Nie' : 'Brak odpowiedzi'
    case 'numeric':
    case 'player_numeric':
    case 'team_numeric':
      return typeof answerJson.value === 'number' ? String(answerJson.value) : 'Brak odpowiedzi'
    case 'team_single': {
      const team = teams.find((candidate) => candidate.id === answerJson.teamId)
      return displayTeamName(team)
    }
    case 'player_single': {
      const player = players.find((candidate) => candidate.id === answerJson.playerId)
      return player ? formatPlayerDisplayName(player.name) : 'Brak odpowiedzi'
    }
    case 'team_stage_exit': {
      return typeof answerJson.stageCode === 'string' ? stageLabelFallbacks[answerJson.stageCode] ?? answerJson.stageCode : 'Brak odpowiedzi'
    }
    case 'duel_player':
    case 'duel_team':
    case 'comparison_numeric': {
      const option = duelOptions(question, teams, players).find((candidate) => candidate.key === answerJson.winnerKey)
      return option?.label ?? 'Brak odpowiedzi'
    }
    case 'ranked_top4':
      return Array.isArray(answerJson.orderedTeamIds) ? `${answerJson.orderedTeamIds.length}/4` : 'Brak odpowiedzi'
    case 'ranked_group_table':
      return Array.isArray(answerJson.groups) ? `${answerJson.groups.length} grup` : 'Brak odpowiedzi'
    default:
      return 'Brak odpowiedzi'
  }
}
