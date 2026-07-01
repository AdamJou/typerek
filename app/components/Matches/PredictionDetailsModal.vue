<script setup lang="ts">
import { ChevronLeft, ChevronRight, X } from 'lucide-vue-next'
import type { LeagueMember, MatchPrediction } from '~/types/domain'
import { predictionScoreLabel } from '~/utils/footballUi'

const props = defineProps<{
  member: LeagueMember
  prediction: MatchPrediction | null
  scorerName: string
  predictedAdvancedTeamName?: string | null
  loading: boolean
  errorMessage: string
  canGoPrevious: boolean
  canGoNext: boolean
}>()

const emit = defineEmits<{
  close: []
  previous: []
  next: []
}>()

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
    return
  }

  if (event.key === 'ArrowLeft' && props.canGoPrevious) {
    emit('previous')
    return
  }

  if (event.key === 'ArrowRight' && props.canGoNext) {
    emit('next')
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="prediction-modal-backdrop" role="presentation" @click.self="emit('close')">
      <section
        class="prediction-modal panel"
        role="dialog"
        aria-modal="true"
        :aria-label="`Typ gracza ${props.member.displayName}`"
      >
        <header class="prediction-modal-head">
          <div class="prediction-modal-title">
            <div>
              <span>Typ gracza</span>
              <h2>{{ props.member.displayName }}</h2>
            </div>

            <div class="modal-navigation" aria-label="Nawigacja typów graczy">
              <button
                class="modal-nav-button"
                type="button"
                aria-label="Poprzedni typ"
                :disabled="!props.canGoPrevious"
                @click="emit('previous')"
              >
                <ChevronLeft :size="18" aria-hidden="true" />
              </button>
              <button
                class="modal-nav-button"
                type="button"
                aria-label="Następny typ"
                :disabled="!props.canGoNext"
                @click="emit('next')"
              >
                <ChevronRight :size="18" aria-hidden="true" />
              </button>
            </div>
          </div>
          <button class="modal-close" type="button" aria-label="Zamknij" @click="emit('close')">
            <X :size="20" aria-hidden="true" />
          </button>
        </header>

        <p v-if="props.loading" class="modal-state">Pobieram typ...</p>
        <p v-else-if="props.errorMessage" class="modal-state is-error">{{ props.errorMessage }}</p>

        <div
          v-else-if="props.prediction"
          class="prediction-details"
          :class="{ 'has-advancement': props.predictedAdvancedTeamName }"
        >
          <div>
            <span>Wynik</span>
            <strong>{{ predictionScoreLabel(props.prediction) }}</strong>
          </div>
          <div>
            <span>Pierwszy strzelec</span>
            <strong>{{ props.scorerName }}</strong>
          </div>
          <div v-if="props.predictedAdvancedTeamName" class="prediction-advancement">
            <span>Awans po remisie</span>
            <strong>{{ props.predictedAdvancedTeamName }}</strong>
          </div>
        </div>

        <p v-else class="modal-state">Nie znaleziono typu tego gracza.</p>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.prediction-modal-backdrop {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(10, 22, 16, 0.58);
  padding: 18px;
  backdrop-filter: blur(4px);
}

.prediction-modal {
  display: grid;
  width: min(420px, 100%);
  gap: 18px;
  background: white;
  padding: 20px;
}

.prediction-modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.prediction-modal-title {
  display: grid;
  gap: 12px;
}

.prediction-modal-title > div:first-child {
  display: grid;
  gap: 4px;
}

.prediction-modal-head span,
.prediction-details span {
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}

.prediction-modal-head h2,
.modal-state {
  margin: 0;
}

.prediction-modal-head h2 {
  font-size: 24px;
  line-height: 1.1;
}

.modal-navigation {
  display: flex;
  gap: 8px;
}

.modal-nav-button,
.modal-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--app-line);
  background: white;
  color: var(--app-muted);
}

.modal-nav-button {
  width: 36px;
  height: 36px;
  border-radius: 50%;
}

.modal-close {
  flex: 0 0 38px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
}

.modal-nav-button:hover,
.modal-nav-button:focus-visible,
.modal-close:hover,
.modal-close:focus-visible {
  border-color: var(--app-primary);
  color: var(--app-primary);
  outline: 0;
}

.modal-nav-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.modal-nav-button:disabled:hover,
.modal-nav-button:disabled:focus-visible {
  border-color: var(--app-line);
  color: var(--app-muted);
}

.prediction-details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.prediction-details div {
  display: grid;
  gap: 7px;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: var(--app-bg);
  padding: 14px;
}

.prediction-details.has-advancement .prediction-advancement {
  grid-column: 1 / -1;
  border-color: rgba(12, 107, 70, 0.26);
  background: #edf8ef;
}

.prediction-details strong {
  overflow-wrap: anywhere;
  font-size: 18px;
  line-height: 1.2;
}

.modal-state {
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 800;
}

.modal-state.is-error {
  color: var(--app-danger);
}

@media (max-width: 420px) {
  .prediction-modal-head {
    align-items: stretch;
  }

  .prediction-details {
    grid-template-columns: 1fr;
  }
}
</style>
