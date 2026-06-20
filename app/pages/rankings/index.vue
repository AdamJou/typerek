<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'
import { aggregateRanking, shouldUseGeneralRankingTieBreakers } from '~/utils/scoring'

const { currentStage, matches, members, ranking, rankingBreakdowns, stages } = useTyperekData()

const activeStageId = shallowRef('')

const orderedStages = computed(() => [...stages].sort((left, right) => left.sortOrder - right.sortOrder))
const selectedStageId = computed(() => activeStageId.value || currentStage.value?.id || orderedStages.value[0]?.id || '')
const selectedStage = computed(() => orderedStages.value.find((stage) => stage.id === selectedStageId.value) ?? null)
const selectedStageRanking = computed(() =>
  aggregateRanking(rankingBreakdowns.value, members, selectedStageId.value || undefined, {
    useGeneralTieBreakers: shouldUseGeneralRankingTieBreakers(selectedStage.value),
  }),
)
const selectedStageMatchCount = computed(() => matches.filter((match) => match.stageId === selectedStageId.value).length)

watch(
  [currentStage, orderedStages],
  ([nextCurrentStage, nextStages]) => {
    if (activeStageId.value || !nextStages.length) {
      return
    }

    activeStageId.value = nextCurrentStage?.id ?? nextStages[0]!.id
  },
  { immediate: true },
)

watch(
  [selectedStageId, orderedStages],
  ([stageId, nextStages]) => {
    if (!nextStages.length) {
      activeStageId.value = ''
      return
    }

    if (!stageId || !nextStages.some((stage) => stage.id === stageId)) {
      activeStageId.value = currentStage.value?.id ?? nextStages[0]!.id
    }
  },
  { immediate: true },
)
</script>

<template>
  <section class="rankings-page">
    <BackLink to="/league" label="Wróć do ligi" />

    <div class="page-heading">
      <h1>Ranking</h1>
    </div>

    <section class="section-block">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Etap na żywo</span>
          <h2>{{ selectedStage?.name ?? 'Aktualny etap' }}</h2>
          <p v-if="selectedStage">{{ selectedStage.shortName }} · {{ selectedStageMatchCount }} meczów</p>
        </div>
        <label class="stage-filter">
          <span>Faza</span>
          <span class="select-shell">
            <select v-model="activeStageId">
              <option v-for="stage in orderedStages" :key="stage.id" :value="stage.id">{{ stage.name }}</option>
            </select>
            <ChevronDown :size="16" aria-hidden="true" />
          </span>
        </label>
      </div>

      <RankingPodium :rows="selectedStageRanking" />
      <RankingTable :rows="selectedStageRanking" mode="stage" />
    </section>

    <section class="section-block">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Cały turniej</span>
          <h2>Generalka</h2>
          <p>Łączna klasyfikacja ligi po wszystkich rozliczonych etapach.</p>
        </div>
      </div>

      <RankingPodium :rows="ranking" />
      <RankingTable :rows="ranking" />
    </section>
  </section>
</template>

<style scoped>
.rankings-page,
.page-heading,
.section-block {
  display: grid;
  gap: 16px;
}

.page-heading h1,
.page-heading p,
.section-heading h2,
.section-heading p {
  margin: 0;
}

.page-heading h1 {
  font-size: clamp(32px, 8vw, 48px);
  line-height: 1;
}

.page-heading p,
.section-heading p {
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 700;
}

.section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
}

.section-heading > div {
  display: grid;
  gap: 4px;
}

.section-heading h2 {
  font-size: 28px;
  line-height: 1;
}

.eyebrow,
.stage-filter > span:first-child {
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}

.stage-filter {
  display: grid;
  min-width: 260px;
  gap: 6px;
}

.select-shell {
  position: relative;
  display: flex;
  height: 42px;
  min-width: 0;
  align-items: center;
  overflow: hidden;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: linear-gradient(180deg, #ffffff, #f8fbf7);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
  color: var(--app-ink);
}

.select-shell:focus-within {
  border-color: var(--app-primary);
  box-shadow: 0 0 0 3px rgba(19, 125, 78, 0.12);
}

.select-shell select {
  width: 100%;
  min-width: 0;
  height: 100%;
  appearance: none;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--app-ink);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 900;
  line-height: 1;
  padding: 0 34px 0 12px;
}

.select-shell svg {
  position: absolute;
  right: 10px;
  color: var(--app-primary-dark);
  pointer-events: none;
}

@media (max-width: 760px) {
  .section-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .section-heading h2 {
    font-size: 24px;
  }

  .stage-filter {
    min-width: 0;
  }
}
</style>
