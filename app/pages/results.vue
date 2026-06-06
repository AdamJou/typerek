<script setup lang="ts">
const { hasLeague, matchEvents, matches, members, players, predictions, ranking, scoreBreakdowns, stages, teams } = useTyperekData()
</script>

<template>
  <section class="results-page">
    <BackLink to="/league" label="Wróć do ligi" />

    <div class="page-heading">
      <h1>Wyniki</h1>
      <p>Potwierdzone rezultaty, typy graczy i rozpiska punktów z podziałem na kolejki.</p>
    </div>

    <ResultsSection
      v-if="hasLeague"
      :matches="matches"
      :stages="stages"
      :teams="teams"
      :members="members"
      :players="players"
      :predictions="predictions"
      :score-breakdowns="scoreBreakdowns"
      :match-events="matchEvents"
      :ranking="ranking"
      hide-heading
    />
  </section>
</template>

<style scoped>
.results-page,
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
