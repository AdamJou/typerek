<script setup lang="ts">
import { CircleAlert, Database, ListChecks, LockKeyhole } from 'lucide-vue-next'
import { BONUS_QUESTION_CATALOG } from '~/data/bonusQuestionCatalog'
import { formatShortDate } from '~/utils/date'
import { questionKindLabel, resolveBonusGlobalLockAt, resolveBonusQuestion } from '~/utils/bonus'

const { bonusQuestions, bonusResolutions, matches, players, stages, teams, tournament } = useTyperekData()

const resolvedQuestions = computed(() => bonusQuestions.map((question) => resolveBonusQuestion(question)))
const resolutionsByQuestionId = computed(() => new Map(bonusResolutions.map((resolution) => [resolution.questionId, resolution])))

const catalogStats = computed(() => ({
  total: BONUS_QUESTION_CATALOG.length,
  auto: BONUS_QUESTION_CATALOG.filter((question) => question.sourceStatus === 'auto').length,
  partial: BONUS_QUESTION_CATALOG.filter((question) => question.sourceStatus === 'partial').length,
  manual: BONUS_QUESTION_CATALOG.filter((question) => question.sourceStatus === 'manual').length,
}))

const dbQuestionCount = computed(() => resolvedQuestions.value.length)
const bonusGlobalLockAt = computed(() => resolveBonusGlobalLockAt(matches, teams, tournament))
const tournamentLockLabel = computed(() => {
  const lockAt = bonusGlobalLockAt.value
  return lockAt ? formatShortDate(lockAt) : 'brak daty'
})
</script>

<template>
  <section class="admin-page">
    <BackLink to="/league" label="Wróć do ligi" />

    <div class="page-heading">
      <h1>Bonusy · admin</h1>
      <p>
        Katalog pytań, typy odpowiedzi i status źródeł danych dla pełnego systemu bonusów. Deadline wszystkich pytań: {{ tournamentLockLabel }}.
      </p>
    </div>

    <div class="stats-grid">
      <article class="stat-card panel">
        <ListChecks :size="20" aria-hidden="true" />
        <strong>{{ catalogStats.total }}</strong>
        <span>szablonów pytań</span>
      </article>
      <article class="stat-card panel">
        <Database :size="20" aria-hidden="true" />
        <strong>{{ dbQuestionCount }}</strong>
        <span>pytań w bazie</span>
      </article>
      <article class="stat-card panel">
        <LockKeyhole :size="20" aria-hidden="true" />
        <strong>{{ catalogStats.auto + catalogStats.partial }}</strong>
        <span>obsługiwanych automatem / częściowo</span>
      </article>
      <article class="stat-card panel">
        <CircleAlert :size="20" aria-hidden="true" />
        <strong>{{ catalogStats.manual }}</strong>
        <span>wymaga feedu lub manual override</span>
      </article>
    </div>

    <section class="section-block">
      <AdminBonusQuestionManager
        :questions="resolvedQuestions"
        :resolutions-by-question-id="resolutionsByQuestionId"
        :default-deadline-at="bonusGlobalLockAt"
        :teams="teams"
        :players="players"
        :stages="stages"
      />
    </section>

    <section class="section-block">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Generator</span>
          <h2>Katalog 1–40 + grupy</h2>
        </div>
      </div>

      <div class="catalog-grid">
        <article v-for="question in BONUS_QUESTION_CATALOG" :key="question.slug" class="catalog-card panel">
          <div class="card-topline">
            <strong>{{ question.title }}</strong>
            <span class="points-pill">{{ question.points }} pkt</span>
          </div>
          <div class="meta-grid">
            <span class="meta-chip">{{ questionKindLabel(question.kind) }}</span>
            <span class="meta-chip">{{ question.section }}</span>
            <span class="meta-chip">{{ question.sourceKind }}</span>
            <span class="meta-chip" :data-status="question.sourceStatus">{{ question.sourceStatus }}</span>
          </div>
          <p class="source-note">{{ question.sourceNote }}</p>
        </article>
      </div>
    </section>
  </section>
</template>

<style scoped>
.admin-page,
.page-heading,
.section-block,
.catalog-grid {
  display: grid;
  gap: 16px;
}

.page-heading h1,
.page-heading p,
.section-heading h2 {
  margin: 0;
}

.page-heading h1 {
  font-size: clamp(32px, 8vw, 48px);
  line-height: 1;
}

.page-heading p,
.empty-panel {
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.45;
}

.stats-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.stat-card,
.catalog-card {
  display: grid;
  gap: 12px;
  padding: 16px;
}

.stat-card strong {
  font-size: 24px;
  line-height: 1;
}

.stat-card span,
.eyebrow {
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}

.section-heading h2 {
  font-size: 24px;
}

.points-pill,
.meta-chip {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  border-radius: 999px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 900;
}

.points-pill {
  background: #fff3d7;
  color: #856111;
}

.meta-chip {
  border: 1px solid var(--app-line);
  background: #f7faf7;
  color: var(--app-muted);
}

.meta-chip[data-status='auto'] {
  color: var(--app-primary-dark);
}

.meta-chip[data-status='manual'] {
  color: #7a4b16;
}

.catalog-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.empty-panel {
  margin: 0;
  padding: 14px;
}

@media (max-width: 920px) {
  .stats-grid,
  .catalog-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .stats-grid,
  .catalog-grid {
    grid-template-columns: 1fr;
  }
}
</style>
