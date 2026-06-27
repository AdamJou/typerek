<script setup lang="ts">
import { aggregateRanking, isKnockoutStage, shouldUseGeneralRankingTieBreakers } from '~/utils/scoring'

const route = useRoute()
const { members, rankingBreakdowns, stages } = useTyperekData()
const activeStage = computed(() => stages.find((stage) => stage.id === route.params.stage))
const rows = computed(() =>
  aggregateRanking(rankingBreakdowns.value, members, activeStage.value?.id, {
    useGeneralTieBreakers: shouldUseGeneralRankingTieBreakers(activeStage.value),
  }),
)
</script>

<template>
  <section class="stage-ranking-page">
    <BackLink to="/rankings" label="Wróć do rankingu" />

    <div class="page-heading">
      <h1>{{ activeStage?.name ?? 'Ranking etapu' }}</h1>
      <p>Punkty zdobyte w wybranym etapie turnieju.</p>
    </div>

    <RankingTable :rows="rows" mode="stage" :show-advancement="isKnockoutStage(activeStage)" />
  </section>
</template>

<style scoped>
.stage-ranking-page,
.page-heading {
  display: grid;
  gap: 16px;
}

.page-heading h1,
.page-heading p {
  margin: 0;
}

.page-heading h1 {
  font-size: clamp(32px, 8vw, 48px);
  line-height: 1;
}

.page-heading p {
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 700;
}
</style>
