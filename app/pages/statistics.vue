<script setup lang="ts">
import { BarChart3, LockKeyhole } from 'lucide-vue-next'
import type { BonusStatisticSection, BonusStatisticsSnapshot } from '~/types/domain'
import { resolveBonusStatisticsCards } from '~/utils/statistics'

const route = useRoute()
const router = useRouter()
const {
  bonusQuestions,
  errorMessage,
  hasLeague,
  hasLoaded,
  isLoading,
  league,
  players,
  stages,
  teams,
} = useTyperekData()

const snapshot = shallowRef<BonusStatisticsSnapshot | null>(null)
const snapshotLoading = shallowRef(false)
const snapshotError = shallowRef('')
let requestId = 0

const cards = computed(() =>
  snapshot.value
    ? resolveBonusStatisticsCards(snapshot.value, bonusQuestions, teams, players, stages)
    : [],
)

const categoryDefinitions: Array<{
  key: BonusStatisticSection
  label: string
  eyebrow: string
  title: string
}> = [
  { key: 'featured', label: 'Topka', eyebrow: 'Topka ligi', title: 'Najważniejsze prognozy' },
  { key: 'awards', label: 'Nagrody', eyebrow: 'Najważniejsze wyróżnienia', title: 'Turniejowe nagrody' },
  { key: 'duels', label: 'Pojedynki', eyebrow: 'Ligowe pojedynki', title: 'Kto postawił na kogo?' },
  { key: 'sentiments', label: 'Sentymenty', eyebrow: 'Tak czy nie?', title: 'Nastroje ligi' },
  { key: 'picks', label: 'Wybory', eyebrow: 'Drużyny i zawodnicy', title: 'Najczęstsze wybory' },
  { key: 'forecasts', label: 'Liczby', eyebrow: 'Prognozy liczbowe', title: 'Jakich wyników oczekuje liga?' },
  { key: 'groups', label: 'Grupy', eyebrow: 'Wspólny typ', title: 'Grupy według ligi' },
  { key: 'insights', label: 'Ciekawostki', eyebrow: 'Starszy snapshot', title: 'Sentymenty i ciekawostki' },
]

const categoryItems = computed(() =>
  categoryDefinitions
    .map((category) => ({
      ...category,
      count: cards.value.filter((card) => card.section === category.key).length,
    }))
    .filter((category) => category.count > 0),
)
const activeCategory = computed<BonusStatisticSection>(() => {
  const requestedCategory = String(route.query.category ?? '')
  const requested = categoryItems.value.find((category) => category.key === requestedCategory)

  return requested?.key
    ?? categoryItems.value.find((category) => category.key === 'featured')?.key
    ?? categoryItems.value[0]?.key
    ?? 'featured'
})
const activeCategoryDefinition = computed(() =>
  categoryItems.value.find((category) => category.key === activeCategory.value),
)
const activeCards = computed(() =>
  cards.value.filter((card) => card.section === activeCategory.value),
)

watch(
  [() => route.query.category, () => categoryItems.value.map((category) => category.key).join(',')],
  () => {
    if (categoryItems.value.length === 0 || route.query.category === activeCategory.value) {
      return
    }

    void router.replace({
      query: {
        ...route.query,
        category: activeCategory.value,
      },
    })
  },
  { immediate: true },
)

function selectCategory(category: BonusStatisticSection) {
  void router.replace({
    query: {
      ...route.query,
      category,
    },
  })
}

async function loadSnapshot() {
  const currentRequestId = ++requestId

  if (!hasLoaded.value || !league.id) {
    snapshot.value = null
    snapshotLoading.value = false
    snapshotError.value = ''
    return
  }

  const repository = useTyperekRepository()

  if (!repository) {
    snapshotError.value = 'Brak połączenia z bazą danych.'
    snapshotLoading.value = false
    return
  }

  snapshotLoading.value = true
  snapshotError.value = ''

  try {
    const result = await repository.getBonusStatisticsSnapshot(league.id)

    if (currentRequestId === requestId) {
      snapshot.value = result
    }
  } catch {
    if (currentRequestId === requestId) {
      snapshot.value = null
      snapshotError.value = 'Nie udało się pobrać statystyk typów.'
    }
  } finally {
    if (currentRequestId === requestId) {
      snapshotLoading.value = false
    }
  }
}

watch([() => league.id, hasLoaded], loadSnapshot, { immediate: true })
</script>

<template>
  <section class="statistics-page">
    <BackLink to="/league" label="Wróć do ligi" />

    <header class="statistics-hero">
      <div class="statistics-hero-icon" aria-hidden="true">
        <BarChart3 :size="30" />
      </div>
      <div>
        <span>Statystyki typów bonusowych</span>
        <h1>Jak typowała liga?</h1>
        <p>Rozkład odpowiedzi uczestników.</p>
      </div>
    </header>

    <p v-if="isLoading && !hasLoaded" class="state-panel panel">Pobieram dane ligi...</p>
    <p v-else-if="errorMessage" class="state-panel panel">{{ errorMessage }}</p>

    <section v-else-if="hasLeague" class="statistics-content">
      <p v-if="snapshotLoading" class="state-panel panel">Pobieram statystyki...</p>
      <p v-else-if="snapshotError" class="state-panel panel">{{ snapshotError }}</p>

      <template v-else-if="snapshot">
        <div v-if="cards.length" class="statistics-sections">
          <StatisticsCategoryTabs
            :items="categoryItems"
            :active-key="activeCategory"
            @select="selectCategory"
          />

          <section v-if="activeCategoryDefinition" class="statistics-section">
            <div class="section-heading">
              <span>{{ activeCategoryDefinition.eyebrow }}</span>
              <h2>{{ activeCategoryDefinition.title }}</h2>
            </div>

            <div
              v-if="activeCategory !== 'groups'"
              class="statistics-grid"
              :class="{
                'featured-grid': activeCategory === 'featured',
                comparisons: activeCategory === 'duels',
              }"
            >
              <StatisticsDistributionCard
                v-for="card in activeCards"
                :key="card.questionSlug"
                :card="card"
                :member-count="snapshot.memberCount"
                :featured="card.questionSlug === 'q02-world-cup-winner'"
                :compact="activeCategory === 'duels'"
              />
            </div>

            <div v-else class="group-consensus-list">
              <StatisticsGroupConsensusCard
                v-for="card in activeCards"
                :key="card.questionSlug"
                :card="card"
                :member-count="snapshot.memberCount"
                :teams="teams"
              />
            </div>
          </section>
        </div>

        <div v-else class="empty-state panel">
          <LockKeyhole :size="26" aria-hidden="true" />
          <h2>Brak zamkniętych pytań</h2>
          <p>Snapshot istnieje, ale nie zawiera jeszcze statystyk wybranych pytań.</p>
        </div>
      </template>

      <div v-else class="empty-state panel">
        <LockKeyhole :size="26" aria-hidden="true" />
        <h2>Statystyki nie są jeszcze dostępne</h2>
        <p>Pojawią się po wdrożeniu jednorazowego snapshotu odpowiedzi.</p>
      </div>
    </section>

    <div v-else-if="hasLoaded" class="empty-state panel">
      <h2>Dołącz do ligi</h2>
      <p>Statystyki są widoczne wyłącznie dla aktywnych uczestników ligi.</p>
      <NuxtLink class="button-secondary" to="/join">Dołącz do ligi</NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.statistics-page,
.statistics-content,
.statistics-sections,
.statistics-section,
.group-consensus-list {
  display: grid;
  gap: 18px;
}

.statistics-hero {
  display: flex;
  align-items: center;
  gap: 18px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(12, 107, 70, 0.96), rgba(20, 33, 27, 0.96));
  padding: 24px;
  color: white;
}

.statistics-hero-icon {
  display: inline-flex;
  width: 58px;
  height: 58px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  flex: 0 0 auto;
}

.statistics-hero > div:last-child {
  display: grid;
  gap: 5px;
}

.statistics-hero span,
.section-heading span {
  color: rgba(255, 255, 255, 0.72);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}

.statistics-hero h1,
.statistics-hero p,
.section-heading h2,
.empty-state h2,
.empty-state p {
  margin: 0;
}

.statistics-hero h1 {
  font-size: clamp(30px, 7vw, 46px);
  line-height: 1;
}

.statistics-hero p {
  color: rgba(255, 255, 255, 0.78);
  font-size: 14px;
  font-weight: 700;
}

.section-heading {
  display: grid;
  gap: 4px;
}

.section-heading span {
  color: var(--app-muted);
}

.section-heading h2 {
  font-size: 26px;
}

.statistics-grid {
  display: grid;
  gap: 14px;
}

.empty-state {
  display: grid;
  justify-items: start;
  gap: 10px;
  padding: 22px;
}

.empty-state svg {
  color: var(--app-primary);
}

.empty-state p,
.state-panel {
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
}

.state-panel {
  margin: 0;
  padding: 14px;
}

@media (min-width: 780px) {
  .statistics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .statistics-grid.featured-grid {
    grid-template-columns: 1fr;
  }

  .statistics-grid.comparisons {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 620px) {
  .statistics-hero {
    align-items: start;
    flex-direction: column;
  }
}
</style>
