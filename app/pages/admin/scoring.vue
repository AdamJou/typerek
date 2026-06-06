<script setup lang="ts">
import { Save } from 'lucide-vue-next'
import { defaultScoringRules } from '~/utils/scoring'

const resultPoints = shallowRef(defaultScoringRules.resultPoints)
const exactScoreBonus = shallowRef(defaultScoringRules.exactScoreBonus)
const firstScorerPoints = shallowRef(defaultScoringRules.firstScorerPoints)
const firstScorerBonusPoints = shallowRef(defaultScoringRules.firstScorerBonusPoints)
</script>

<template>
  <section class="admin-page">
    <div class="page-heading">
      <h1>Punktacja</h1>
      <p>Reguły są konfigurowalne i nie są zaszyte w komponentach frontendu.</p>
    </div>

    <form class="scoring-form panel">
      <label>
        <span class="eyeless-label">Rezultat W/D/L</span>
        <input v-model.number="resultPoints" class="input" type="number" min="0" />
      </label>
      <label>
        <span class="eyeless-label">Bonus za dokładny wynik</span>
        <input v-model.number="exactScoreBonus" class="input" type="number" min="0" />
      </label>
      <label>
        <span class="eyeless-label">Strzelec gola</span>
        <input v-model.number="firstScorerPoints" class="input" type="number" min="0" />
      </label>
      <label>
        <span class="eyeless-label">Bonus za pierwszą bramkę</span>
        <input v-model.number="firstScorerBonusPoints" class="input" type="number" min="0" />
      </label>
      <button class="button-primary" type="button">
        <Save :size="18" aria-hidden="true" />
        Zapisz punktację
      </button>
    </form>
  </section>
</template>

<style scoped>
.admin-page,
.page-heading,
.scoring-form {
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

.scoring-form {
  max-width: 620px;
  padding: 16px;
}

@media (min-width: 720px) {
  .scoring-form {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .scoring-form button {
    grid-column: 1 / -1;
    justify-self: start;
  }
}
</style>
