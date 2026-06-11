import type {
  BonusPrediction,
  BonusQuestion,
  BonusQuestionOption,
  LeagueMember,
  Player,
  Team,
  TournamentStage,
} from '../types/domain'
import {
  duelOptions,
  isBonusAnswerFilled,
  questionSectionLabel,
  resolveBonusQuestion,
  stageOptions,
  type ResolvedBonusQuestion,
} from './bonus'
import { displayTeamName, formatPlayerDisplayName } from './footballUi'

interface BonusAnswersExportInput {
  leagueName: string
  generatedAt: string
  members: readonly Pick<LeagueMember, 'userId' | 'displayName'>[]
  questions: readonly BonusQuestion[]
  predictions: readonly BonusPrediction[]
  options: readonly BonusQuestionOption[]
  teams: readonly Team[]
  players: readonly Player[]
  stages: readonly TournamentStage[]
}

export function buildBonusAnswersExport(input: BonusAnswersExportInput) {
  const questions = [...input.questions]
    .map(resolveBonusQuestion)
    .sort((left, right) => {
      const leftOrder = left.displayOrder ?? Number.MAX_SAFE_INTEGER
      const rightOrder = right.displayOrder ?? Number.MAX_SAFE_INTEGER

      return leftOrder - rightOrder || left.title.localeCompare(right.title, 'pl')
    })
  const members = [...input.members].sort((left, right) => left.displayName.localeCompare(right.displayName, 'pl'))
  const predictionByMemberAndQuestion = new Map(
    input.predictions.map((prediction) => [`${prediction.userId}:${prediction.questionId}`, prediction]),
  )
  const lines = [
    'TYPOWANIE - ODPOWIEDZI BONUSOWE',
    `Liga: ${input.leagueName}`,
    `Wygenerowano: ${formatExportDate(input.generatedAt)}`,
    `Uczestnicy: ${members.length}`,
    `Pytania: ${questions.length}`,
    '',
  ]

  for (const [memberIndex, member] of members.entries()) {
    const answeredCount = questions.filter((question) => {
      const prediction = predictionByMemberAndQuestion.get(`${member.userId}:${question.id}`)
      return isBonusAnswerFilled(question, prediction?.answerJson)
    }).length

    lines.push('='.repeat(72))
    lines.push(`UCZESTNIK: ${member.displayName}`)
    lines.push(`Odpowiedzi: ${answeredCount}/${questions.length}`)
    lines.push('-'.repeat(72))

    for (const [questionIndex, question] of questions.entries()) {
      const prediction = predictionByMemberAndQuestion.get(`${member.userId}:${question.id}`)
      const answer = formatBonusAnswer(
        question,
        prediction ?? null,
        input.options,
        input.teams,
        input.players,
        input.stages,
      )

      lines.push(`${questionIndex + 1}. [${questionSectionLabel(question.section)}] ${question.title} (${question.points} pkt)`)
      lines.push(...formatAnswerLines(answer))
      lines.push('')
    }

    if (memberIndex < members.length - 1) {
      lines.push('')
    }
  }

  return `${lines.join('\n').trimEnd()}\n`
}

export function bonusAnswersExportFilename(leagueName: string, generatedAt = new Date().toISOString()) {
  const safeLeagueName =
    leagueName
      .replace(/[łŁ]/g, 'l')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'liga'
  const date = generatedAt.slice(0, 10)

  return `typerek-${safeLeagueName}-odpowiedzi-${date}.txt`
}

function formatBonusAnswer(
  question: ResolvedBonusQuestion,
  prediction: BonusPrediction | null,
  options: readonly BonusQuestionOption[],
  teams: readonly Team[],
  players: readonly Player[],
  stages: readonly TournamentStage[],
) {
  const answer = prediction?.answerJson ?? null

  if (!isBonusAnswerFilled(question, answer)) {
    const legacyOptionId =
      prediction?.optionId ?? (typeof answer?.optionId === 'string' ? answer.optionId : null)
    const legacyOption = options.find(
      (option) => option.questionId === question.id && option.id === legacyOptionId,
    )

    return legacyOption?.label ?? 'Brak odpowiedzi'
  }

  switch (question.kind) {
    case 'boolean':
      return answer?.value === true ? 'Tak' : 'Nie'
    case 'numeric':
    case 'player_numeric':
    case 'team_numeric':
      return String(answer?.value)
    case 'team_single':
      return teamLabel(String(answer?.teamId), teams)
    case 'player_single':
      return playerLabel(String(answer?.playerId), players)
    case 'team_stage_exit':
      return (
        stageOptions(stages).find((stage) => stage.value === answer?.stageCode)?.label ??
        String(answer?.stageCode)
      )
    case 'duel_player':
    case 'duel_team':
    case 'comparison_numeric':
      return (
        duelOptions(question, teams, players).find((option) => option.key === answer?.winnerKey)?.label ??
        String(answer?.winnerKey)
      )
    case 'ranked_top4':
      return (answer?.orderedTeamIds as string[])
        .map((teamId, index) => `${index + 1}. ${teamLabel(teamId, teams)}`)
        .join('\n')
    case 'ranked_group_table':
      return [...(answer?.groups as Array<{ groupCode: string; orderedTeamIds: string[] }>)]
        .sort((left, right) => left.groupCode.localeCompare(right.groupCode, 'pl'))
        .map(
          (group) =>
            `Grupa ${group.groupCode}: ${group.orderedTeamIds
              .map((teamId, index) => `${index + 1}. ${teamLabel(teamId, teams)}`)
              .join(' | ')}`,
        )
        .join('\n')
    default:
      return 'Brak odpowiedzi'
  }
}

function teamLabel(teamId: string, teams: readonly Team[]) {
  const team = teams.find((candidate) => candidate.id === teamId)
  return team ? displayTeamName(team) : `Nieznana drużyna (${teamId})`
}

function playerLabel(playerId: string, players: readonly Player[]) {
  const player = players.find((candidate) => candidate.id === playerId)
  return player ? formatPlayerDisplayName(player.name) : `Nieznany zawodnik (${playerId})`
}

function formatAnswerLines(answer: string) {
  const answerLines = answer.split('\n')
  return answerLines.map((line, index) => `${index === 0 ? '   Odpowiedź: ' : '               '}${line}`)
}

function formatExportDate(value: string) {
  const date = new Date(value)

  if (!Number.isFinite(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Warsaw',
  }).format(date)
}
