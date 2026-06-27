<script setup lang="ts">
import { ArrowRight, Check, X } from 'lucide-vue-next'

const emit = defineEmits<{
  close: []
}>()

const closeButton = useTemplateRef<HTMLButtonElement>('closeButton')

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  closeButton.value?.focus()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="advancement-modal-backdrop" role="presentation" @click.self="emit('close')">
      <section
        class="advancement-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="advancement-modal-title"
        aria-describedby="advancement-modal-intro"
      >
        <header class="advancement-modal-head">
          <div>
            <span>Punktacja w fazie pucharowej</span>
            <h2 id="advancement-modal-title">Jak zdobyć punkty za awans?</h2>
          </div>
          <button ref="closeButton" class="modal-close" type="button" aria-label="Zamknij zasady awansu" @click="emit('close')">
            <X :size="20" aria-hidden="true" />
          </button>
        </header>

        <p id="advancement-modal-intro" class="modal-intro">
          Wynik i strzelec zawsze dotyczą 90 minut. Awans oznacza drużynę, która przechodzi dalej po dogrywce lub karnych.
        </p>

        <div class="scenario-list">
          <article class="scenario-card is-primary">
            <strong class="scenario-points">+2 pkt</strong>
            <div>
              <h3>Typujesz remis i trafiasz awans</h3>
              <p>Typ: 1:1 i awans B <ArrowRight :size="14" aria-hidden="true" /> po 90 minutach jest remis, a B awansuje.</p>
            </div>
          </article>

          <article class="scenario-card">
            <strong class="scenario-points">+1 pkt</strong>
            <div>
              <h3>Typujesz remis, ale wskazana drużyna wygrywa w 90 minut</h3>
              <p>Typ: 1:1 i awans B <ArrowRight :size="14" aria-hidden="true" /> wynik to np. 0:1, więc B awansuje.</p>
            </div>
          </article>

          <article class="scenario-card">
            <strong class="scenario-points">+1 pkt</strong>
            <div>
              <h3>Typujesz zwycięstwo drużyny i ona awansuje</h3>
              <p>Typ: 2:1 dla A automatycznie oznacza typ na awans A. Jeśli A awansuje, dostajesz +1 — niezależnie, czy wygra w 90 minut, dogrywce lub karnych.</p>
            </div>
          </article>
        </div>

        <div class="no-bonus-note">
          <Check :size="18" aria-hidden="true" />
          <p><strong>Bez punktów za awans:</strong> tylko wtedy, gdy awansuje inna drużyna niż wynika z Twojego typu lub ręcznego wyboru przy remisie.</p>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.advancement-modal-backdrop {
  position: fixed;
  z-index: 1100;
  inset: 0;
  display: grid;
  place-items: center;
  overflow-y: auto;
  background: rgba(7, 23, 16, 0.68);
  padding: 18px;
  backdrop-filter: blur(5px);
}

.advancement-modal {
  display: grid;
  width: min(620px, 100%);
  max-height: calc(100dvh - 36px);
  gap: 18px;
  overflow-y: auto;
  border: 1px solid rgba(12, 107, 70, 0.16);
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 28px 80px rgba(3, 19, 12, 0.3);
  padding: 22px;
  color: var(--app-ink);
}

.advancement-modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.advancement-modal-head > div {
  display: grid;
  gap: 5px;
}

.advancement-modal-head span {
  color: var(--app-primary);
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.advancement-modal-head h2,
.modal-intro,
.scenario-card h3,
.scenario-card p,
.no-bonus-note p {
  margin: 0;
}

.advancement-modal-head h2 {
  font-size: clamp(24px, 5vw, 32px);
  line-height: 1.08;
}

.modal-close {
  display: inline-flex;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--app-line);
  border-radius: 50%;
  background: white;
  color: var(--app-muted);
}

.modal-close:focus-visible {
  outline: 3px solid rgba(12, 107, 70, 0.2);
  outline-offset: 2px;
}

.modal-intro {
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 750;
  line-height: 1.5;
}

.scenario-list {
  display: grid;
  gap: 9px;
}

.scenario-card {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  border: 1px solid var(--app-line);
  border-radius: 10px;
  background: #f8faf7;
  padding: 14px;
}

.scenario-card.is-primary {
  border-color: rgba(12, 107, 70, 0.28);
  background: #edf8f0;
}

.scenario-points {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  background: var(--app-primary-dark);
  padding: 0 8px;
  color: white;
  font-size: 14px;
  white-space: nowrap;
}

.scenario-card > div {
  display: grid;
  gap: 5px;
}

.scenario-card h3 {
  font-size: 14px;
  line-height: 1.3;
}

.scenario-card p {
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.45;
}

.scenario-card p :deep(svg) {
  display: inline;
  vertical-align: -2px;
}

.no-bonus-note {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  border-radius: 9px;
  background: #fff7e4;
  padding: 13px;
  color: #665224;
}

.no-bonus-note p {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.45;
}

@media (max-width: 520px) {
  .advancement-modal {
    padding: 18px;
  }

  .scenario-card {
    grid-template-columns: 1fr;
  }

  .scenario-points {
    justify-self: start;
  }
}
</style>
