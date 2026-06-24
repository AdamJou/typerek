<script setup lang="ts">
import { Check, ChevronRight, MapPin, X } from 'lucide-vue-next'
import type { LeagueMember, Match, MatchEvent, MatchPrediction, Player, Team, TournamentStage } from '~/types/domain'
import { displayTeamName, formatPlayerNameParts, getTeamFlag, predictionScoreLabel } from '~/utils/footballUi'
import { canRevealMatchPredictions } from '~/utils/scoring'

const props = defineProps<{
  match: Match
  matchEvents?: readonly MatchEvent[]
  homeTeam?: Team
  awayTeam?: Team
  stage: TournamentStage
  to?: string
  prediction?: MatchPrediction
  matchPredictions?: readonly MatchPrediction[]
  currentMember?: LeagueMember
  players?: readonly Player[]
  firstScorer?: Player | null
  attention?: boolean
  pending?: boolean
  lockedLabel?: string | null
  predictedMembers?: readonly LeagueMember[]
  predictionLabel?: string
  predictionPlaceholder?: string
  actionLabelOverride?: string
}>()

const cardComponent = computed(() => (props.to ? resolveComponent('NuxtLink') : 'article'))
const now = shallowRef(Date.now())
const selectedMember = shallowRef<LeagueMember | null>(null)
const selectedPrediction = shallowRef<MatchPrediction | null>(null)
const selectedPredictionLoading = shallowRef(false)
const selectedPredictionError = shallowRef('')
let selectedPredictionRequestId = 0
let unlockTimer: ReturnType<typeof setTimeout> | null = null

const participantMembers = computed(() => {
  const members = [...(props.predictedMembers ?? [])]

  if (
    props.prediction &&
    props.currentMember &&
    !members.some((member) => member.userId === props.prediction?.userId)
  ) {
    members.push(props.currentMember)
  }

  return members
})
const canRevealPredictions = computed(
  () => canRevealMatchPredictions(props.match, new Date(now.value)),
)
const selectedMemberIndex = computed(() => {
  if (!selectedMember.value) {
    return -1
  }

  return participantMembers.value.findIndex((member) => member.userId === selectedMember.value?.userId)
})
const canShowPreviousPrediction = computed(() => selectedMemberIndex.value > 0)
const canShowNextPrediction = computed(() => {
  return selectedMemberIndex.value >= 0 && selectedMemberIndex.value < participantMembers.value.length - 1
})
const selectedScorerName = computed(() => {
  if (!selectedPrediction.value) {
    return ''
  }

  if (selectedPrediction.value.noScorer) {
    return 'Brak strzelca'
  }

  return props.players?.find((player) => player.id === selectedPrediction.value?.firstScorerPlayerId)?.name ?? 'Strzelec wybrany'
})
const hasActualScore = computed(
  () =>
    props.match.homeScore90 !== null &&
    props.match.awayScore90 !== null &&
    (props.match.status !== 'scheduled' || Boolean(props.match.resultConfirmedAt)),
)
const resultLabel = computed(() => {
  if (hasActualScore.value) {
    return `${props.match.homeScore90}:${props.match.awayScore90}`
  }

  if (props.prediction) {
    return predictionScoreLabel(props.prediction)
  }

  return 'VS'
})

const homeName = computed(() => displayTeamName(props.homeTeam, props.match.homePlaceholder ?? 'Do ustalenia'))
const awayName = computed(() => displayTeamName(props.awayTeam, props.match.awayPlaceholder ?? 'Do ustalenia'))
const homeFlag = computed(() => getTeamFlag(props.homeTeam))
const awayFlag = computed(() => getTeamFlag(props.awayTeam))
const groupLabel = computed(() => (props.match.groupCode ? `Grupa ${props.match.groupCode}` : props.stage.shortName))
const roundLabel = computed(() => props.match.roundName ?? props.stage.name)
const actionLabel = computed(() => {
  if (props.actionLabelOverride) {
    return props.actionLabelOverride
  }

  if (props.prediction) {
    return 'Zobacz typ'
  }

  if (props.pending || props.attention) {
    return 'Typuj mecz'
  }

  if (props.lockedLabel) {
    return props.lockedLabel
  }

  return 'Szczegóły meczu'
})
const predictionScorerName = computed(() => {
  if (!props.prediction) {
    return null
  }

  if (props.prediction.noScorer) {
    return { givenInitial: '', surname: 'Brak strzelca' }
  }

  const fullName = props.firstScorer?.name

  if (!fullName) {
    return { givenInitial: '', surname: 'Strzelec wybrany' }
  }

  return formatPlayerNameParts(fullName)
})
const goalEvents = computed(() => {
  const allEvents = props.matchEvents ?? []
  const hasManualOverride = allEvents.some((event) => event.provider === 'manual')
  const events = allEvents
    .filter((event) => event.eventType === 'goal')
    .sort((a, b) => a.minute - b.minute || a.createdAt.localeCompare(b.createdAt))

  return hasManualOverride ? events.filter((event) => event.provider === 'manual') : events
})
const normalGoalScorerIds = computed(
  () =>
    new Set(
      goalEvents.value
        .filter((event) => !isOwnGoal(event))
        .map((event) => event.playerId)
        .filter((playerId): playerId is string => Boolean(playerId)),
    ),
)
const homeGoalEvents = computed(() => goalEvents.value.filter((event) => event.teamId === props.match.homeTeamId))
const awayGoalEvents = computed(() => goalEvents.value.filter((event) => event.teamId === props.match.awayTeamId))
const shouldShowActualScorers = computed(() => hasActualScore.value && (goalEvents.value.length > 0 || props.match.noScorerConfirmed))
const predictionResultState = computed<'exact' | 'outcome' | 'miss' | null>(() => {
  if (!props.prediction || !hasActualScore.value || props.match.homeScore90 === null || props.match.awayScore90 === null) {
    return null
  }

  if (props.prediction.predictedHomeScore === props.match.homeScore90 && props.prediction.predictedAwayScore === props.match.awayScore90) {
    return 'exact'
  }

  return resultSign(props.prediction.predictedHomeScore, props.prediction.predictedAwayScore) ===
    resultSign(props.match.homeScore90, props.match.awayScore90)
    ? 'outcome'
    : 'miss'
})
const predictionScorerState = computed<'hit' | 'miss' | null>(() => {
  if (!props.prediction || !hasActualScore.value || props.match.homeScore90 === null || props.match.awayScore90 === null) {
    return null
  }

  const wasGoalless = props.match.homeScore90 === 0 && props.match.awayScore90 === 0

  if (props.prediction.noScorer) {
    return wasGoalless ? 'hit' : 'miss'
  }

  if (!props.prediction.firstScorerPlayerId) {
    return 'miss'
  }

  if (normalGoalScorerIds.value.size > 0) {
    return normalGoalScorerIds.value.has(props.prediction.firstScorerPlayerId) ? 'hit' : 'miss'
  }

  return props.prediction.firstScorerPlayerId === props.match.firstScorerPlayerId ? 'hit' : 'miss'
})

function resultSign(homeScore: number, awayScore: number) {
  if (homeScore > awayScore) {
    return 'home'
  }

  if (homeScore < awayScore) {
    return 'away'
  }

  return 'draw'
}

function goalScorerNameParts(event: MatchEvent) {
  if (!event.playerName) {
    return {
      givenInitial: '',
      surname: 'Nieznany strzelec',
      suffix: isOwnGoal(event) ? '(sam.)' : '',
    }
  }

  return formatPlayerNameParts(event.playerName, isOwnGoal(event) ? '(sam.)' : '')
}

function isOwnGoal(event: MatchEvent) {
  return event.detail === 'manual_own_goal' || event.detail === 'own_goal'
}

function schedulePredictionUnlock() {
  const delay = new Date(props.match.startsAtUtc).getTime() - Date.now()

  if (delay <= 0) {
    now.value = Date.now()
    return
  }

  unlockTimer = setTimeout(() => {
    now.value = Date.now()
    schedulePredictionUnlock()
  }, Math.min(delay + 100, 2_147_483_647))
}

async function openPrediction(member: LeagueMember) {
  if (!canRevealPredictions.value) {
    return
  }

  const requestId = ++selectedPredictionRequestId

  selectedMember.value = member
  selectedPredictionLoading.value = false
  selectedPrediction.value =
    props.matchPredictions?.find((prediction) => prediction.userId === member.userId) ??
    (props.prediction?.userId === member.userId ? props.prediction : null)
  selectedPredictionError.value = ''

  if (selectedPrediction.value) {
    return
  }

  selectedPredictionLoading.value = true

  try {
    const repository = useTyperekRepository()

    if (!repository) {
      throw new Error('Brak połączenia z bazą danych.')
    }

    const prediction = await repository.getRevealedMatchPrediction(props.match.id, member.userId)

    if (requestId !== selectedPredictionRequestId) {
      return
    }

    selectedPrediction.value = prediction
  } catch {
    if (requestId !== selectedPredictionRequestId) {
      return
    }

    selectedPredictionError.value = 'Nie udało się pobrać typu tego gracza.'
  } finally {
    if (requestId === selectedPredictionRequestId) {
      selectedPredictionLoading.value = false
    }
  }
}

function openAdjacentPrediction(direction: -1 | 1) {
  const nextIndex = selectedMemberIndex.value + direction
  const nextMember = participantMembers.value.at(nextIndex)

  if (!nextMember) {
    return
  }

  void openPrediction(nextMember)
}

function closePredictionModal() {
  selectedPredictionRequestId += 1
  selectedMember.value = null
  selectedPrediction.value = null
  selectedPredictionError.value = ''
  selectedPredictionLoading.value = false
}

onMounted(schedulePredictionUnlock)

onBeforeUnmount(() => {
  if (unlockTimer) {
    clearTimeout(unlockTimer)
  }
})
</script>

<template>
  <component
    :is="cardComponent"
    class="match-card panel"
    :class="{
      'is-attention': props.attention,
      'is-pending': props.pending,
      'is-predicted': props.prediction,
      'is-locked': props.lockedLabel,
      'has-actual-score': hasActualScore,
    }"
    :to="props.to"
  >
    <div class="match-card-head">
      <div class="match-card-meta-main">
        <KickoffTime :starts-at-utc="props.match.startsAtUtc" />
        <span v-if="props.match.venue" class="venue">
          <MapPin :size="14" aria-hidden="true" />
          {{ props.match.venue }}
        </span>
      </div>

      <div class="match-card-badges">
        <span v-if="props.attention" class="state-badge attention-badge">Typuj dziś</span>
        <span v-else-if="props.pending" class="state-badge pending-badge">Czeka na typ</span>
        <span v-else-if="props.lockedLabel" class="state-badge locked-badge">{{ props.lockedLabel }}</span>
        <span v-if="props.prediction" class="state-badge predicted-badge">Otypowane</span>
        <span class="group-badge">{{ groupLabel }}</span>
      </div>
    </div>

    <div class="match-card-subline">
      <span>{{ props.match.matchNumber ? `Mecz ${props.match.matchNumber}` : roundLabel }}</span>
      <MatchStatusBadge v-if="props.match.status !== 'scheduled'" :status="props.match.status" />
    </div>

    <div class="match-card-teams">
      <div class="team team-home">
        <span class="flag" aria-hidden="true">
          <img v-if="homeFlag.src" :src="homeFlag.src" alt="" class="flag-image" loading="lazy" decoding="async" />
          <span v-else class="flag-fallback">{{ homeFlag.emoji }}</span>
        </span>
        <span class="team-name">{{ homeName }}</span>
      </div>

      <strong class="score" :class="{ 'is-final': hasActualScore }">{{ resultLabel }}</strong>

      <div class="team team-away">
        <span class="flag" aria-hidden="true">
          <img v-if="awayFlag.src" :src="awayFlag.src" alt="" class="flag-image" loading="lazy" decoding="async" />
          <span v-else class="flag-fallback">{{ awayFlag.emoji }}</span>
        </span>
        <span class="team-name">{{ awayName }}</span>
      </div>
    </div>

    <div v-if="shouldShowActualScorers" class="actual-scorers">
      <div class="actual-team">
        <span class="actual-team-name">{{ homeName }}</span>
        <p v-if="homeGoalEvents.length">
          <span v-for="event in homeGoalEvents" :key="event.id" class="actual-scorer-name">
            <span v-if="goalScorerNameParts(event).givenInitial" class="scorer-given-names">{{ goalScorerNameParts(event).givenInitial }}</span>
            <strong class="scorer-surname">{{ goalScorerNameParts(event).surname }}</strong>
            <span v-if="goalScorerNameParts(event).suffix" class="scorer-suffix">{{ goalScorerNameParts(event).suffix }}</span>
          </span>
        </p>
        <p v-else><strong>-</strong></p>
      </div>
      <div class="actual-team actual-team-away">
        <span class="actual-team-name">{{ awayName }}</span>
        <p v-if="awayGoalEvents.length">
          <span v-for="event in awayGoalEvents" :key="event.id" class="actual-scorer-name">
            <span v-if="goalScorerNameParts(event).givenInitial" class="scorer-given-names">{{ goalScorerNameParts(event).givenInitial }}</span>
            <strong class="scorer-surname">{{ goalScorerNameParts(event).surname }}</strong>
            <span v-if="goalScorerNameParts(event).suffix" class="scorer-suffix">{{ goalScorerNameParts(event).suffix }}</span>
          </span>
        </p>
        <p v-else><strong>-</strong></p>
      </div>
    </div>

    <PredictionParticipants
      v-if="participantMembers.length"
      :members="participantMembers"
      :interactive="canRevealPredictions"
      @select="openPrediction"
    />

    <div
      v-if="props.prediction"
      class="prediction-strip"
      :class="{
        'is-exact': predictionResultState === 'exact',
        'is-outcome': predictionResultState === 'outcome',
        'is-miss': predictionResultState === 'miss',
      }"
    >
      <span class="prediction-label">{{ props.predictionLabel ?? 'Twój typ' }}</span>
      <strong class="prediction-score">{{ predictionScoreLabel(props.prediction) }}</strong>
      <div class="prediction-scorer">
        <img src="~/assets/css/shooting.png" alt="" class="scorer-icon" aria-hidden="true" />
        <span v-if="predictionScorerName?.givenInitial" class="scorer-given-names">{{ predictionScorerName.givenInitial }}</span>
        <strong>{{ predictionScorerName?.surname }}</strong>
        <span
          v-if="predictionScorerState"
          class="scorer-result"
          :class="{ 'is-hit': predictionScorerState === 'hit', 'is-miss': predictionScorerState === 'miss' }"
          :aria-label="predictionScorerState === 'hit' ? 'Trafiony strzelec' : 'Nietrafiony strzelec'"
        >
          <Check v-if="predictionScorerState === 'hit'" :size="15" aria-hidden="true" />
          <X v-else :size="15" aria-hidden="true" />
        </span>
      </div>
    </div>

    <div v-else-if="props.predictionPlaceholder" class="prediction-strip prediction-strip-empty">
      <span class="prediction-label">{{ props.predictionLabel ?? 'Typ' }}</span>
      <strong class="prediction-score">{{ props.predictionPlaceholder }}</strong>
    </div>

    <div v-if="props.to" class="match-card-action">
      <span>{{ actionLabel }}</span>
      <ChevronRight :size="18" aria-hidden="true" />
    </div>

    <PredictionDetailsModal
      v-if="selectedMember"
      :member="selectedMember"
      :prediction="selectedPrediction"
      :scorer-name="selectedScorerName"
      :loading="selectedPredictionLoading"
      :error-message="selectedPredictionError"
      :can-go-previous="canShowPreviousPrediction"
      :can-go-next="canShowNextPrediction"
      @close="closePredictionModal"
      @previous="openAdjacentPrediction(-1)"
      @next="openAdjacentPrediction(1)"
    />
  </component>
</template>

<style scoped>
.match-card {
  position: relative;
  display: grid;
  gap: 14px;
  overflow: hidden;
  box-sizing: border-box;
  width: 100%;
  padding: 16px;
  color: inherit;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.match-card:hover {
  border-color: rgba(12, 107, 70, 0.38);
  box-shadow: 0 18px 46px rgba(26, 42, 34, 0.12);
}

.match-card.is-attention {
  border-color: rgba(215, 180, 106, 0.9);
  box-shadow: 0 18px 46px rgba(215, 180, 106, 0.18);
}

.match-card.is-pending {
  border-color: rgba(215, 180, 106, 0.72);
}

.match-card.is-predicted {
  border-color: rgba(12, 107, 70, 0.28);
}

.match-card.is-locked {
  border-color: rgba(180, 190, 184, 0.7);
}

.match-card.has-actual-score {
  border-color: rgba(12, 107, 70, 0.32);
}

.match-card-head,
.match-card-subline,
.match-card-action {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.match-card-meta-main {
  display: grid;
  min-width: 0;
  gap: 6px;
}

.venue {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 800;
}

.match-card-badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.group-badge,
.state-badge {
  display: inline-flex;
  min-height: 26px;
  align-items: center;
  border-radius: 7px;
  padding: 0 9px;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  white-space: nowrap;
}

.group-badge {
  background: #eef4ef;
  color: var(--app-primary-dark);
}

.attention-badge {
  background: #fff2cf;
  color: #765813;
}

.pending-badge {
  background: #f7ead0;
  color: #765813;
}

.predicted-badge {
  background: #e4f3e8;
  color: var(--app-primary-dark);
}

.locked-badge {
  background: #edf0ec;
  color: var(--app-muted);
}

.match-card-subline {
  align-items: center;
  border-top: 1px solid rgba(223, 230, 221, 0.8);
  padding-top: 12px;
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}

.match-card-teams {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding-block: 4px;
}

.team {
  display: grid;
  min-width: 0;
  gap: 8px;
}

.team-away {
  justify-items: end;
  text-align: right;
}

.flag {
  display: inline-flex;
  width: 48px;
  height: 36px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 7px;
  line-height: 1;
}

.flag-image {
  display: block;
  width: calc(100% + 4px);
  height: calc(100% + 4px);
  margin: -2px;
  object-fit: cover;
}

.flag-fallback {
  font-size: 24px;
  line-height: 1;
}

.team-name {
  min-height: 2.3em;
  overflow: hidden;
  font-size: 17px;
  font-weight: 950;
  line-height: 1.15;
  text-wrap: balance;
}

.score {
  position: relative;
  display: inline-flex;
  min-width: 62px;
  height: 48px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent),
    #13231b;
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.24);
  color: white;
  font-size: 18px;
  font-weight: 950;
  letter-spacing: 0.04em;
}

.score.is-final::after {
  position: absolute;
  right: 10px;
  bottom: 6px;
  left: 10px;
  height: 3px;
  border-radius: 999px;
  background: #d7b46a;
  content: '';
}

.actual-scorers {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  border: 1px solid #d7e7da;
  border-radius: 8px;
  background: #fbfdf9;
  padding: 10px;
}

.actual-team {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.actual-team-away {
  text-align: right;
}

.actual-team-name {
  overflow: hidden;
  color: var(--app-muted);
  font-size: 10px;
  font-weight: 950;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.actual-team p {
  display: grid;
  gap: 3px;
  margin: 0;
}

.actual-scorer-name {
  display: inline-flex;
  min-width: 0;
  align-items: baseline;
  gap: 4px;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
}

.scorer-surname {
  min-width: 0;
  overflow: hidden;
  font-weight: 950;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scorer-suffix {
  flex: 0 0 auto;
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 600;
}

.prediction-strip {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: #fbfdf9;
  padding: 10px 12px;
  max-width: 100%;
}

.prediction-strip.is-exact {
  border-color: #b9dfc1;
  background: #f0faf2;
}

.prediction-strip.is-outcome {
  border-color: #ead493;
  background: #fff8df;
}

.prediction-strip.is-miss {
  border-color: #e7b5ad;
  background: #fff1ef;
}

.prediction-strip-empty {
  grid-template-columns: auto minmax(0, 1fr);
  background: var(--app-bg);
}

.prediction-strip-empty .prediction-score {
  color: var(--app-muted);
}

.prediction-label {
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}

.prediction-score {
  color: var(--app-ink);
  font-size: 17px;
  font-weight: 950;
}

.prediction-strip.is-exact .prediction-score {
  color: var(--app-primary-dark);
}

.prediction-strip.is-outcome .prediction-score {
  color: #8a650b;
}

.prediction-strip.is-miss .prediction-score {
  color: var(--app-danger);
}

.prediction-scorer {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.scorer-icon {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.scorer-given-names {
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.prediction-scorer strong {
  min-width: 0;
  overflow: hidden;
  color: var(--app-ink);
  font-size: 15px;
  font-weight: 950;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scorer-result {
  display: inline-flex;
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: white;
}

.scorer-result.is-hit {
  background: var(--app-primary);
}

.scorer-result.is-miss {
  background: var(--app-danger);
}

.match-card-action {
  box-sizing: border-box;
  align-items: center;
  width: 100%;
  min-height: 54px;
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.12), transparent),
    var(--app-primary);
  padding: 12px 13px;
  color: white;
  font-size: 14px;
  font-weight: 950;
  transition:
    background-color 160ms ease,
    transform 160ms ease,
    box-shadow 160ms ease;
}

.match-card-action:hover {
  background: var(--app-primary-dark);
  box-shadow: 0 10px 24px rgba(12, 107, 70, 0.18);
}

.match-card.is-locked .match-card-action {
  background: #edf0ec;
  color: var(--app-muted);
  box-shadow: none;
}

.match-card.is-locked .match-card-action:hover {
  background: #e4e9e2;
}

.match-card-action:active {
  transform: translateY(1px);
}

.match-card:active {
  transform: translateY(0);
}

@media (max-width: 520px) {
  .match-card {
    padding: 14px;
  }

  .match-card-teams {
    gap: 8px;
  }

  .flag {
    width: 42px;
    height: 32px;
  }

  .team-name {
    font-size: 15px;
  }

  .score {
    min-width: 54px;
  }

  .prediction-strip {
    grid-template-columns: auto auto;
  }

  .prediction-scorer {
    grid-column: 1 / -1;
  }
}
</style>
