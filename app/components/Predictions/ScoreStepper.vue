<script setup lang="ts">
import { Minus, Plus } from 'lucide-vue-next'

const model = defineModel<number>({ required: true })

defineProps<{
  label?: string
  teamName?: string
  flagSrc?: string | null
  flagEmoji?: string
}>()

function decrement() {
  model.value = Math.max(0, model.value - 1)
}

function increment() {
  model.value += 1
}
</script>

<template>
  <div class="score-stepper">
    <div class="score-stepper-heading">
      <span v-if="flagSrc || flagEmoji" class="score-stepper-flag" aria-hidden="true">
        <img v-if="flagSrc" :src="flagSrc" alt="" class="score-stepper-flag-image" loading="lazy" decoding="async" />
        <span v-else class="score-stepper-flag-fallback">{{ flagEmoji }}</span>
      </span>
      <span>
        <small>{{ label }}</small>
        <strong v-if="teamName">{{ teamName }}</strong>
      </span>
    </div>

    <div class="score-stepper-controls">
      <button type="button" class="score-stepper-button" :aria-label="`Zmniejsz ${label}`" @click="decrement">
        <Minus :size="18" aria-hidden="true" />
      </button>
      <output class="score-stepper-value">{{ model }}</output>
      <button type="button" class="score-stepper-button" :aria-label="`Zwiększ ${label}`" @click="increment">
        <Plus :size="18" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.score-stepper {
  display: grid;
  gap: 12px;
  border: 1px solid rgba(207, 222, 210, 0.95);
  border-radius: 8px;
  background:
    linear-gradient(180deg, #ffffff, #f8fbf7);
  padding: 13px;
}

.score-stepper-heading {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.score-stepper-heading span:last-child {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.score-stepper-heading small {
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}

.score-stepper-heading strong {
  overflow: hidden;
  font-size: 15px;
  font-weight: 950;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score-stepper-flag {
  display: inline-flex;
  width: 34px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  overflow: hidden;
}

.score-stepper-flag-image {
  display: block;
  width: calc(100% + 4px);
  height: calc(100% + 4px);
  margin: -2px;
  object-fit: cover;
}

.score-stepper-flag-fallback {
  font-size: 18px;
  line-height: 1;
}

.score-stepper-controls {
  display: grid;
  grid-template-columns: 56px minmax(64px, 1fr) 56px;
  align-items: center;
  overflow: hidden;
  border: 1px solid #cfded2;
  border-radius: 8px;
  background: white;
}

.score-stepper-button {
  display: inline-flex;
  min-height: 56px;
  align-items: center;
  justify-content: center;
  border: 0;
  background: #eef6f0;
  color: var(--app-primary-dark);
  transition: background-color 150ms ease, transform 150ms ease;
}

.score-stepper-button:hover {
  background: #dfeee3;
}

.score-stepper-button:active {
  transform: scale(0.96);
}

.score-stepper-value {
  display: inline-flex;
  min-height: 56px;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 950;
  line-height: 1;
}
</style>
