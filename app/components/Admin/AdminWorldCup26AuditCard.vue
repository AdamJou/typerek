<script setup lang="ts">
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Loader2,
  SearchCheck,
} from 'lucide-vue-next'
import type {
  WorldCup26AuditDetails,
  WorldCup26AuditStatus,
  WorldCup26AuditSummary,
  WorldCup26TeamMapping,
} from '~/types/worldcup26'

const props = defineProps<{
  summary: WorldCup26AuditSummary
  details?: WorldCup26AuditDetails
  loading?: boolean
  error?: string
}>()

const emit = defineEmits<{
  loadDetails: [eventId: string]
}>()

const audit = computed(() => props.details ?? props.summary)
const rawJson = computed(() =>
  JSON.stringify(props.details?.rawDetails ?? props.summary.raw, null, 2),
)
const statusLabel = computed(() => ({
  complete: 'Kompletne',
  partial: 'Częściowe',
  unmapped: 'Niezmapowane',
})[audit.value.auditStatus])
const localResultLabel = computed(() => {
  if (audit.value.localResult.state === 'confirmed') {
    return `Potwierdzony ${scoreLabel(audit.value.localResult.homeScore, audit.value.localResult.awayScore)}`
  }

  if (audit.value.localResult.state === 'saved') {
    return `Zapisany ${scoreLabel(audit.value.localResult.homeScore, audit.value.localResult.awayScore)}`
  }

  return 'Brak wyniku w aplikacji'
})

function statusIcon(status: WorldCup26AuditStatus) {
  return status === 'complete'
    ? CheckCircle2
    : status === 'partial'
      ? AlertTriangle
      : CircleHelp
}

function teamMappingLabel(team: WorldCup26TeamMapping) {
  if (team.status === 'matched') {
    return team.internalTeamName ?? 'Dopasowano'
  }

  if (team.status === 'ambiguous') {
    return `Niejednoznaczne (${team.candidates.length})`
  }

  return 'Brak dopasowania'
}

function scoreLabel(homeScore: number | null, awayScore: number | null) {
  return homeScore === null || awayScore === null ? 'brak' : `${homeScore}:${awayScore}`
}
</script>

<template>
  <article class="audit-card panel">
    <header class="audit-card-header">
      <div class="audit-title">
        <span>WorldCup26 #{{ summary.externalEventId }}</span>
        <h2>{{ summary.eventName }}</h2>
      </div>

      <div class="audit-status" :class="`is-${audit.auditStatus}`">
        <component :is="statusIcon(audit.auditStatus)" :size="16" aria-hidden="true" />
        {{ statusLabel }}
      </div>
    </header>

    <div class="provider-result">
      <div>
        <span>{{ summary.homeTeam.externalName ?? 'Gospodarze' }}</span>
        <strong>{{ summary.homeScore ?? '–' }}</strong>
      </div>
      <small>{{ summary.providerStatus ?? 'brak statusu' }}</small>
      <div>
        <strong>{{ summary.awayScore ?? '–' }}</strong>
        <span>{{ summary.awayTeam.externalName ?? 'Goście' }}</span>
      </div>
    </div>

    <div class="mapping-grid">
      <section class="mapping-block">
        <span>Drużyny w aplikacji</span>
        <p>
          <strong>{{ teamMappingLabel(summary.homeTeam) }}</strong>
          <small>vs</small>
          <strong>{{ teamMappingLabel(summary.awayTeam) }}</strong>
        </p>
      </section>

      <section class="mapping-block">
        <span>Dopasowany mecz</span>
        <p>
          <strong v-if="summary.match.status === 'matched'">
            {{ summary.match.matchNumber ? `Mecz ${summary.match.matchNumber}` : summary.match.internalMatchId }}
          </strong>
          <strong v-else>Brak jednoznacznego meczu</strong>
          <small v-if="summary.match.matchedBy">
            {{ summary.match.matchedBy === 'match_number' ? 'numer i drużyny' : 'para drużyn' }}
          </small>
        </p>
      </section>

      <section class="mapping-block">
        <span>Wynik lokalny</span>
        <p><strong>{{ localResultLabel }}</strong></p>
      </section>
    </div>

    <div v-if="details" class="details-section">
      <div class="coverage-grid">
        <div>
          <span>Gospodarze</span>
          <strong>{{ details.goalCoverage.returnedHome }}/{{ details.goalCoverage.expectedHome }}</strong>
          <small>pozycji na liście strzelców</small>
        </div>
        <div>
          <span>Goście</span>
          <strong>{{ details.goalCoverage.returnedAway }}/{{ details.goalCoverage.expectedAway }}</strong>
          <small>pozycji na liście strzelców</small>
        </div>
        <div>
          <span>Pierwszy strzelec</span>
          <strong>{{ details.firstScorerCertain ? 'Pewny' : 'Niepewny' }}</strong>
          <small>{{ details.goals[0]?.externalPlayerName ?? 'brak gola' }}</small>
        </div>
      </div>

      <section class="goals-section">
        <div class="section-title">
          <span>Kolejność goli</span>
          <strong>{{ details.goals.length }}</strong>
        </div>

        <div v-if="details.goals.length" class="goal-list">
          <article v-for="goal in details.goals" :key="goal.goalId" class="goal-row">
            <span class="goal-order">#{{ goal.sequence }}</span>
            <strong class="goal-minute">{{ goal.minuteLabel }}</strong>
            <div class="goal-copy">
              <strong>{{ goal.externalPlayerName || 'Nieznany strzelec' }}</strong>
              <small>
                {{ goal.player.internalPlayerName ?? 'brak dopasowania w aplikacji' }}
                <template v-if="goal.penalty"> · karny</template>
                <template v-if="goal.ownGoal"> · samobój</template>
              </small>
            </div>
            <span class="goal-team">{{ goal.externalTeamName ?? goal.teamSide }}</span>
          </article>
        </div>

        <p v-else class="empty-copy">Mecz nie zawiera bramek.</p>
      </section>
    </div>

    <div v-if="audit.warnings.length" class="warning-list">
      <p v-for="warning in audit.warnings" :key="warning">
        <AlertTriangle :size="15" aria-hidden="true" />
        {{ warning }}
      </p>
    </div>

    <p v-if="error" class="request-error">{{ error }}</p>

    <div class="audit-actions">
      <button
        class="button-primary"
        type="button"
        :disabled="loading"
        @click="emit('loadDetails', summary.externalEventId)"
      >
        <Loader2 v-if="loading" class="spin" :size="17" aria-hidden="true" />
        <SearchCheck v-else :size="17" aria-hidden="true" />
        {{ details ? 'Odśwież analizę strzelców' : 'Sprawdź strzelców i kolejność' }}
      </button>

      <details class="raw-details">
        <summary>
          <ChevronDown :size="16" aria-hidden="true" />
          Surowy JSON
        </summary>
        <pre>{{ rawJson }}</pre>
      </details>
    </div>
  </article>
</template>

<style scoped>
.audit-card,
.details-section,
.goals-section,
.goal-list,
.warning-list {
  display: grid;
  gap: 14px;
}

.audit-card {
  padding: 18px;
}

.audit-card-header,
.provider-result,
.audit-actions,
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.audit-card-header {
  align-items: start;
  border-bottom: 1px solid var(--app-line);
  padding-bottom: 14px;
}

.audit-title {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.audit-title span,
.mapping-block > span,
.coverage-grid span,
.section-title span {
  color: var(--app-muted);
  font-size: 10px;
  font-weight: 950;
  text-transform: uppercase;
}

.audit-title h2,
.mapping-block p,
.warning-list p,
.empty-copy {
  margin: 0;
}

.audit-title h2 {
  font-size: 20px;
  line-height: 1.2;
}

.audit-status {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  gap: 6px;
  border-radius: 7px;
  padding: 0 9px;
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}

.audit-status.is-complete {
  background: #e2f4e8;
  color: #11623c;
}

.audit-status.is-partial {
  background: #fff3d5;
  color: #765813;
}

.audit-status.is-unmapped {
  background: #f9e2e2;
  color: #932f2f;
}

.provider-result {
  border-radius: 8px;
  background: #12281f;
  padding: 13px 15px;
  color: white;
}

.provider-result > div {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.provider-result span {
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.provider-result strong {
  font-size: 25px;
}

.provider-result small {
  color: rgba(255, 255, 255, 0.62);
  font-size: 10px;
  font-weight: 950;
  text-transform: uppercase;
}

.mapping-grid,
.coverage-grid {
  display: grid;
  gap: 8px;
}

.mapping-block,
.coverage-grid > div {
  display: grid;
  align-content: start;
  gap: 5px;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: #fbfdf9;
  padding: 11px;
}

.mapping-block p {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.mapping-block small,
.coverage-grid small,
.goal-copy small {
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 750;
}

.coverage-grid strong {
  color: var(--app-primary-dark);
  font-size: 20px;
}

.section-title {
  border-bottom: 1px solid var(--app-line);
  padding-bottom: 8px;
}

.section-title strong {
  display: inline-flex;
  min-width: 25px;
  height: 25px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #e8f0e9;
  color: var(--app-primary-dark);
  font-size: 11px;
}

.goal-row {
  display: grid;
  grid-template-columns: 28px 50px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  padding: 9px;
}

.goal-order {
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 900;
}

.goal-minute {
  color: var(--app-primary-dark);
  font-size: 13px;
}

.goal-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.goal-copy > strong {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.goal-team {
  color: var(--app-muted);
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
}

.warning-list p,
.request-error {
  display: flex;
  align-items: start;
  gap: 7px;
  border-radius: 8px;
  padding: 9px 10px;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.4;
}

.warning-list p {
  background: #fff5dc;
  color: #765813;
}

.warning-list svg {
  flex: 0 0 auto;
}

.request-error {
  margin: 0;
  background: #f9e2e2;
  color: #932f2f;
}

.audit-actions {
  align-items: start;
}

.audit-actions .button-primary,
.raw-details summary {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.raw-details {
  max-width: 100%;
}

.raw-details summary {
  min-height: 38px;
  color: var(--app-primary-dark);
  cursor: pointer;
  font-size: 12px;
  font-weight: 900;
  list-style: none;
}

.raw-details[open] summary svg {
  transform: rotate(180deg);
}

.raw-details pre {
  max-height: 420px;
  overflow: auto;
  border-radius: 8px;
  background: #10221b;
  padding: 12px;
  color: #dcece2;
  font-size: 11px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}

.empty-copy {
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 800;
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (min-width: 760px) {
  .mapping-grid,
  .coverage-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 620px) {
  .audit-card-header,
  .provider-result,
  .audit-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .provider-result > div {
    justify-content: space-between;
  }

  .goal-row {
    grid-template-columns: 28px 46px minmax(0, 1fr);
  }

  .goal-team {
    grid-column: 3;
  }
}
</style>
