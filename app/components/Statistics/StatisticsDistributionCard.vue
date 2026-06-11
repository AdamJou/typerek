<script setup lang="ts">
import type { ResolvedBonusStatisticCard } from '~/utils/statistics'

defineProps<{
  card: ResolvedBonusStatisticCard
  memberCount: number
  compact?: boolean
  featured?: boolean
}>()
</script>

<template>
  <article class="statistics-card panel" :class="{ compact, featured }">
    <header>
      <h2>{{ card.title }}</h2>
    </header>

    <div v-if="card.options.length" class="statistics-options">
      <StatisticsBarRow
        v-for="option in card.options"
        :key="option.key"
        :option="option"
      />
    </div>

    <p v-else class="statistics-empty">Brak udzielonych odpowiedzi.</p>

    <p v-if="card.metric === 'top4_presence'" class="statistics-note">
      Procent oznacza udział odpowiadających, którzy umieścili drużynę w Top 4. Średnia pozycja: 1,00 oznacza pierwsze miejsce.
    </p>
  </article>
</template>

<style scoped>
.statistics-card {
  display: grid;
  align-content: start;
  gap: 18px;
  padding: 18px;
}

.statistics-card header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--app-line);
}

.statistics-card h2,
.statistics-card p {
  margin: 0;
}

.statistics-card h2 {
  max-width: 430px;
  font-size: 19px;
  line-height: 1.25;
}

.statistics-card header span {
  flex: 0 0 auto;
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  white-space: nowrap;
}

.statistics-options {
  display: grid;
  gap: 16px;
}

.statistics-empty,
.statistics-note {
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.5;
}

.statistics-note {
  padding-top: 12px;
  border-top: 1px solid var(--app-line);
}

.statistics-card.compact {
  gap: 14px;
}

.statistics-card.featured {
  border-color: rgba(12, 107, 70, 0.35);
  background:
    linear-gradient(135deg, rgba(12, 107, 70, 0.08), transparent 60%),
    rgba(255, 255, 255, 0.92);
  box-shadow: 0 20px 52px rgba(12, 107, 70, 0.12);
}

.statistics-card.featured h2 {
  color: var(--app-primary-dark);
  font-size: 23px;
}

@media (max-width: 520px) {
  .statistics-card header {
    flex-direction: column;
  }
}
</style>
