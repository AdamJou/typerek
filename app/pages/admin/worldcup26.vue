<script setup lang="ts">
import { DatabaseZap, Loader2, RefreshCw, ShieldAlert } from 'lucide-vue-next'

const {
  detailsByEventId,
  detailsErrorByEventId,
  detailsLoadingByEventId,
  isLoadingResults,
  loadEventDetails,
  loadResults,
  results,
  resultsError,
} = useWorldCup26Audit()
</script>

<template>
  <section class="audit-page">
    <BackLink to="/admin/sync" label="Wróć do ustawień" />

    <header class="audit-hero">
      <div class="audit-hero-icon" aria-hidden="true">
        <DatabaseZap :size="28" />
      </div>
      <div>
        <span>Tryb tylko do odczytu</span>
        <h1>Audyt WorldCup26</h1>
        <p>Sprawdź wynik, kompletność strzelców i kolejność goli bez zapisu do bazy.</p>
      </div>
    </header>

    <section class="audit-controls panel">
      <div>
        <h2>Zakończone mecze</h2>
        <p>Dane są pobierane wyłącznie po kliknięciu. Analizę zawodników uruchamiasz osobno dla każdego meczu.</p>
      </div>

      <button class="button-primary" type="button" :disabled="isLoadingResults" @click="loadResults">
        <Loader2 v-if="isLoadingResults" class="spin" :size="18" aria-hidden="true" />
        <RefreshCw v-else :size="18" aria-hidden="true" />
        {{ results ? 'Odśwież zakończone mecze' : 'Sprawdź zakończone mecze' }}
      </button>
    </section>

    <p v-if="resultsError" class="error-panel panel">{{ resultsError }}</p>

    <template v-if="results">
      <section class="coverage-panel panel">
        <div>
          <span>Zwrócone mecze</span>
          <strong>{{ results.totalEvents }}/{{ results.expectedTournamentMatches }}</strong>
        </div>
        <div>
          <span>Zakończone</span>
          <strong>{{ results.results.length }}</strong>
        </div>
        <div>
          <span>Pokrycie turnieju</span>
          <strong>{{ results.coverageComplete ? 'Pełne' : 'Niepełne' }}</strong>
        </div>
      </section>

      <div v-if="results.warnings.length" class="global-warnings">
        <p v-for="warning in results.warnings" :key="warning">
          <ShieldAlert :size="17" aria-hidden="true" />
          {{ warning }}
        </p>
      </div>

      <div v-if="results.results.length" class="audit-list">
        <AdminWorldCup26AuditCard
          v-for="summary in results.results"
          :key="summary.externalEventId"
          :summary="summary"
          :details="detailsByEventId[summary.externalEventId]"
          :loading="detailsLoadingByEventId[summary.externalEventId]"
          :error="detailsErrorByEventId[summary.externalEventId]"
          @load-details="loadEventDetails"
        />
      </div>

      <p v-else class="empty-panel panel">Brak zakończonych meczów do audytu.</p>
    </template>

    <section v-else-if="!isLoadingResults" class="initial-panel panel">
      <DatabaseZap :size="26" aria-hidden="true" />
      <h2>Audyt nie został jeszcze uruchomiony</h2>
      <p>Kliknij przycisk powyżej. Strona nie zapisuje wyników i nie uruchamia naliczania punktów.</p>
    </section>
  </section>
</template>

<style scoped>
.audit-page,
.audit-list,
.global-warnings {
  display: grid;
  gap: 16px;
}

.audit-hero,
.audit-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.audit-hero {
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(12, 107, 70, 0.97), rgba(18, 36, 29, 0.97));
  padding: 23px;
  color: white;
}

.audit-hero-icon {
  display: inline-flex;
  width: 54px;
  height: 54px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  flex: 0 0 auto;
}

.audit-hero > div:last-child,
.audit-controls > div {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.audit-hero > div:last-child {
  flex: 1;
}

.audit-hero span {
  color: rgba(255, 255, 255, 0.68);
  font-size: 10px;
  font-weight: 950;
  text-transform: uppercase;
}

.audit-hero h1,
.audit-hero p,
.audit-controls h2,
.audit-controls p,
.initial-panel h2,
.initial-panel p,
.global-warnings p {
  margin: 0;
}

.audit-hero h1 {
  font-size: clamp(30px, 7vw, 44px);
  line-height: 1;
}

.audit-hero p {
  color: rgba(255, 255, 255, 0.78);
  font-size: 13px;
  font-weight: 750;
}

.audit-controls {
  padding: 17px;
}

.audit-controls h2 {
  font-size: 19px;
}

.audit-controls p,
.initial-panel p {
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 750;
  line-height: 1.45;
}

.audit-controls .button-primary {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex: 0 0 auto;
}

.coverage-panel {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 14px;
}

.coverage-panel > div {
  display: grid;
  gap: 3px;
  border-right: 1px solid var(--app-line);
  padding-inline: 10px;
}

.coverage-panel > div:last-child {
  border-right: 0;
}

.coverage-panel span {
  color: var(--app-muted);
  font-size: 10px;
  font-weight: 950;
  text-transform: uppercase;
}

.coverage-panel strong {
  color: var(--app-primary-dark);
  font-size: 19px;
}

.global-warnings p,
.error-panel {
  border-radius: 8px;
  padding: 11px 12px;
  font-size: 13px;
  font-weight: 850;
}

.global-warnings p {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff3d5;
  color: #765813;
}

.error-panel {
  margin: 0;
  background: #f9e2e2;
  color: #932f2f;
}

.initial-panel {
  display: grid;
  justify-items: start;
  gap: 8px;
  padding: 20px;
}

.initial-panel svg {
  color: var(--app-primary);
}

.empty-panel {
  margin: 0;
  padding: 16px;
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 850;
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 680px) {
  .audit-hero,
  .audit-controls {
    align-items: stretch;
    flex-direction: column;
  }

  .coverage-panel {
    grid-template-columns: 1fr;
  }

  .coverage-panel > div {
    border-right: 0;
    border-bottom: 1px solid var(--app-line);
    padding-block: 8px;
  }

  .coverage-panel > div:last-child {
    border-bottom: 0;
  }
}
</style>
