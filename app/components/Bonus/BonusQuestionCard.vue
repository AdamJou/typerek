<script setup lang="ts">
import { LockKeyhole } from 'lucide-vue-next'
import type { BonusPrediction } from '~/types/domain'
import { formatShortDate } from '~/utils/date'
import type { ResolvedBonusQuestion } from '~/utils/bonus'

defineProps<{
  question: ResolvedBonusQuestion
  prediction?: BonusPrediction | null
  locked: boolean
  answered: boolean
}>()
</script>

<template>
  <article class="bonus-card panel" :data-locked="locked" :data-answered="answered">
    <div class="bonus-card-header">
      <div class="bonus-title-stack">
        <h2>{{ question.title }}</h2>
        <p v-if="question.configJson.note">{{ question.configJson.note }}</p>
      </div>
      <span class="points-pill">{{ question.points }} pkt</span>
    </div>


    <div class="bonus-body">
      <slot />
    </div>

    <div class="bonus-footer">
      <strong class="ready" v-if="answered">Odpowiedź gotowa</strong>
      <strong class="not-ready" v-else >Brak odpowiedzi</strong>
      <span>{{ locked ? 'Typowanie zamknięte' : (prediction?.updatedAt ? `Ostatni zapis: ${formatShortDate(prediction.updatedAt)}` : 'Jeszcze nic nie zapisano') }}</span>
    </div>
  </article>
</template>

<style scoped>
.bonus-card,
.bonus-title-stack,
.bonus-body,
.bonus-footer {
  display: grid;
  gap: 14px;
}

.bonus-card {
  overflow: visible;
  padding: 18px;
}

.bonus-card[data-locked='true'] {
  opacity: 0.88;
}

.bonus-card-header,
.bonus-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: start;
  justify-content: space-between;
  gap: 10px;
}

.bonus-title-stack {
  min-width: 0;
  gap: 6px;
}

.bonus-card h2,
.bonus-title-stack p {
  margin: 0;
}

.bonus-card h2 {
  font-size: 20px;
  line-height: 1.25;
}

.bonus-title-stack p,
.bonus-footer span {
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.45;
}

.points-pill,
.meta-chip {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  gap: 6px;
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

.bonus-footer {
  gap: 4px;
  border-top: 1px solid var(--app-line);
  padding-top: 14px;
}

.bonus-body {
  overflow: visible;
}

.bonus-footer strong {
  font-size: 14px;
  font-weight: 900;
}
.ready{
  color: var(--app-primary);
}
.not-ready{
  color: var(--app-muted);
}
</style>
