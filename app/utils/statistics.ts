import type {
  BonusQuestion,
  BonusStatisticCard,
  BonusStatisticEntityType,
  BonusStatisticGroup,
  BonusStatisticMetric,
  BonusStatisticSection,
  BonusStatisticsSnapshot,
  Player,
  Team,
  TournamentStage,
} from '~/types/domain'
import { duelOptions, normalizeBonusText, resolveBonusQuestion, stageOptions } from '~/utils/bonus'
import { displayTeamName, formatPlayerDisplayName, getTeamFlag, type TeamFlagAsset } from '~/utils/footballUi'

export interface BonusStatisticsSnapshotRowInput {
  leagueId: string
  generatedAt: string
  memberCount: number
  statisticsJson: unknown
}

export interface ResolvedBonusStatisticOption {
  key: string
  label: string
  count: number
  percentage: number
  averagePosition: number | null
  flag: TeamFlagAsset | null
}

export interface ResolvedBonusStatisticCard extends Omit<BonusStatisticCard, 'options'> {
  options: ResolvedBonusStatisticOption[]
}

const entityTypes = new Set<BonusStatisticEntityType>(['team', 'player', 'choice'])
const metrics = new Set<BonusStatisticMetric>([
  'answer',
  'top4_presence',
  'numeric_distribution',
  'group_consensus',
])
const sections = new Set<BonusStatisticSection>([
  'featured',
  'awards',
  'duels',
  'sentiments',
  'picks',
  'forecasts',
  'groups',
  'insights',
])
const sentimentQuestionSlugs = new Set([
  'q04-curacao-group-points',
  'q12-neymar-over-240-minutes',
  'q20-modric-goal',
  'q22-son-over-1-goal',
  'q33-chris-wood-goal',
  'q36-australia-win-any-match',
  'q39-ekstraklasa-goal-or-assist',
])

export function normalizeBonusStatisticsSnapshot(
  row: BonusStatisticsSnapshotRowInput,
): BonusStatisticsSnapshot {
  const root = isRecord(row.statisticsJson) ? row.statisticsJson : {}
  const version = toNonNegativeInteger(root.version) || 1
  const cards = Array.isArray(root.cards)
    ? root.cards.map(normalizeCard).filter((card): card is BonusStatisticCard => Boolean(card))
    : []

  return {
    leagueId: row.leagueId,
    generatedAt: row.generatedAt,
    memberCount: toNonNegativeInteger(row.memberCount),
    version,
    cards,
  }
}

export function statisticPercentage(count: number, respondentCount: number) {
  if (respondentCount <= 0) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round((count / respondentCount) * 100)))
}

export function resolveBonusStatisticsCards(
  snapshot: BonusStatisticsSnapshot,
  questions: readonly BonusQuestion[],
  teams: readonly Team[],
  players: readonly Player[],
  stages: readonly TournamentStage[] = [],
): ResolvedBonusStatisticCard[] {
  const questionBySlug = new Map(
    questions
      .map(resolveBonusQuestion)
      .map((question) => [question.slug, question] as const),
  )
  const teamById = new Map(teams.map((team) => [team.id, team]))
  const playerById = new Map(players.map((player) => [player.id, player]))
  const stageLabels = new Map(stageOptions(stages).map((stage) => [stage.value, stage.label]))

  return snapshot.cards.map((card) => {
    const question = questionBySlug.get(card.questionSlug)
    const choiceLabels = new Map(
      question
        ? duelOptions(question, teams, players).map((option) => [option.key, option.label] as const)
        : [],
    )
    const answerLabels = new Map<string, string>([
      ['true', 'Tak'],
      ['false', 'Nie'],
      ...stageLabels,
      ...choiceLabels,
    ])

    const options = card.options
      .map<ResolvedBonusStatisticOption>((option) => {
        const player = card.entityType === 'player' ? playerById.get(option.key) : undefined
        const team = card.entityType === 'team'
          ? teamById.get(option.key)
          : player
            ? teamById.get(player.teamId)
            : undefined

        return {
          ...option,
          label: player
            ? formatPlayerDisplayName(player.name)
            : team
              ? displayTeamName(team)
              : answerLabels.get(option.key) ?? option.key,
          percentage: statisticPercentage(option.count, card.respondentCount),
          averagePosition: option.averagePosition ?? null,
          flag: team ? getTeamFlag(team) : null,
        }
      })
      .sort((left, right) => {
        if (card.metric === 'numeric_distribution') {
          return Number(left.key) - Number(right.key)
        }

        return right.count - left.count || left.label.localeCompare(right.label, 'pl')
      })

    return {
      ...card,
      options,
    }
  })
}

function normalizeCard(value: unknown): BonusStatisticCard | null {
  if (!isRecord(value)) {
    return null
  }

  const questionSlug = typeof value.questionSlug === 'string' ? value.questionSlug.trim() : ''
  const title = typeof value.title === 'string' ? value.title.trim() : ''
  const entityType = typeof value.entityType === 'string' && entityTypes.has(value.entityType as BonusStatisticEntityType)
    ? value.entityType as BonusStatisticEntityType
    : null
  const metric = typeof value.metric === 'string' && metrics.has(value.metric as BonusStatisticMetric)
    ? value.metric as BonusStatisticMetric
    : null
  const section = typeof value.section === 'string' && sections.has(value.section as BonusStatisticSection)
    ? value.section as BonusStatisticSection
    : inferStatisticSection(questionSlug)

  if (!questionSlug || !title || !entityType || !metric) {
    return null
  }

  return {
    questionSlug,
    title,
    entityType,
    metric,
    section,
    respondentCount: toNonNegativeInteger(value.respondentCount),
    averageValue: toOptionalNumber(value.averageValue),
    medianValue: toOptionalNumber(value.medianValue),
    options: Array.isArray(value.options)
      ? value.options.flatMap((option) => {
          if (!isRecord(option) || typeof option.key !== 'string' || !option.key.trim()) {
            return []
          }

          const count = toNonNegativeInteger(option.count)
          const averagePosition = toPositiveNumber(option.averagePosition)

          return count > 0
            ? [{
                key: option.key.trim(),
                count,
                averagePosition,
              }]
            : []
        })
      : [],
    groups: Array.isArray(value.groups)
      ? value.groups
          .map(normalizeGroup)
          .filter((group): group is BonusStatisticGroup => Boolean(group))
          .sort((left, right) => left.groupCode.localeCompare(right.groupCode, 'pl'))
      : [],
  }
}

export function classifyBonusStatisticSection(
  question: Pick<BonusQuestion, 'slug' | 'title' | 'kind'>,
): BonusStatisticSection {
  const slug = question.slug ?? ''
  const title = normalizeBonusText(question.title)

  if (['q02-world-cup-winner', 'q24-top-four'].includes(slug)) {
    return 'featured'
  }

  if (
    ['q05-top-scorer', 'q06-top-assists', 'q07-golden-glove'].includes(slug)
    || title.includes('mvp')
  ) {
    return 'awards'
  }

  if (question.kind === 'ranked_group_table') {
    return 'groups'
  }

  if (
    question.kind === 'boolean'
    || sentimentQuestionSlugs.has(slug)
    || (title.includes('haaland') && title.includes('uzbekistan'))
  ) {
    return 'sentiments'
  }

  if (['duel_player', 'duel_team', 'comparison_numeric'].includes(question.kind ?? '')) {
    return 'duels'
  }

  if (['team_single', 'player_single', 'team_stage_exit'].includes(question.kind ?? '')) {
    return 'picks'
  }

  return 'forecasts'
}

function inferStatisticSection(questionSlug: string): BonusStatisticSection {
  if (['q02-world-cup-winner', 'q24-top-four'].includes(questionSlug)) {
    return 'featured'
  }

  if (['q05-top-scorer', 'q06-top-assists', 'q07-golden-glove'].includes(questionSlug)) {
    return 'awards'
  }

  if (['q25-ronaldo-vs-messi-stage', 'q19-mbappe-vs-yamal', 'q08-own-goals-vs-red-cards'].includes(questionSlug)) {
    return 'duels'
  }

  return 'insights'
}

function normalizeGroup(value: unknown): BonusStatisticGroup | null {
  if (!isRecord(value) || typeof value.groupCode !== 'string' || !value.groupCode.trim()) {
    return null
  }

  return {
    groupCode: value.groupCode.trim(),
    respondentCount: toNonNegativeInteger(value.respondentCount),
    teams: Array.isArray(value.teams)
      ? value.teams.flatMap((team) => {
          if (!isRecord(team) || typeof team.key !== 'string' || !team.key.trim()) {
            return []
          }

          const averagePosition = toPositiveNumber(team.averagePosition)

          if (averagePosition === null) {
            return []
          }

          const positionVotes = Array.from({ length: 4 }, (_, index) =>
            toNonNegativeInteger(
              Array.isArray(team.positionVotes) ? team.positionVotes[index] : 0,
            ),
          )

          return [{
            key: team.key.trim(),
            averagePosition,
            positionVotes,
          }]
        })
          .sort((left, right) =>
            left.averagePosition - right.averagePosition
            || right.positionVotes[0]! - left.positionVotes[0]!
            || right.positionVotes[1]! - left.positionVotes[1]!
            || right.positionVotes[2]! - left.positionVotes[2]!
            || right.positionVotes[3]! - left.positionVotes[3]!
            || left.key.localeCompare(right.key, 'pl'),
          )
      : [],
  }
}

function toNonNegativeInteger(value: unknown) {
  const numericValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(numericValue) ? Math.max(0, Math.trunc(numericValue)) : 0
}

function toPositiveNumber(value: unknown) {
  const numericValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(numericValue) && numericValue > 0
    ? Math.round(numericValue * 100) / 100
    : null
}

function toOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numericValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(numericValue)
    ? Math.round(numericValue * 100) / 100
    : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
