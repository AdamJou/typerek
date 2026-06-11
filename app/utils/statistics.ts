import type {
  BonusQuestion,
  BonusStatisticCard,
  BonusStatisticEntityType,
  BonusStatisticMetric,
  BonusStatisticSection,
  BonusStatisticsSnapshot,
  Player,
  Team,
  TournamentStage,
} from '~/types/domain'
import { duelOptions, resolveBonusQuestion, stageOptions } from '~/utils/bonus'
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
const metrics = new Set<BonusStatisticMetric>(['answer', 'top4_presence'])
const sections = new Set<BonusStatisticSection>(['featured', 'awards', 'duels', 'insights'])

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
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'pl'))

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
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
