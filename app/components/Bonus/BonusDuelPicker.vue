<script setup lang="ts">
const model = defineModel<string | null>({ required: true })

defineProps<{
  options: ReadonlyArray<{
    key: string
    label: string
    meta?: string
  }>
  disabled?: boolean
}>()
</script>

<template>
  <div class="duel-grid">
    <button
      v-for="option in options"
      :key="option.key"
      class="duel-card"
      type="button"
      :disabled="disabled"
      :data-selected="option.key === model"
      @click="model = option.key"
    >
      <strong>{{ option.label }}</strong>
      <span v-if="option.meta">{{ option.meta }}</span>
    </button>
  </div>
</template>

<style scoped>
.duel-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.duel-card {
  display: grid;
  gap: 4px;
  min-height: 76px;
  align-content: center;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: linear-gradient(180deg, #ffffff, #f7faf7);
  color: var(--app-ink);
  padding: 14px;
  text-align: left;
}

.duel-card[data-selected='true'] {
  border-color: rgba(19, 125, 78, 0.35);
  background: rgba(19, 125, 78, 0.08);
}

.duel-card strong {
  font-size: 15px;
  font-weight: 900;
}

.duel-card span {
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 700;
}

@media (max-width: 560px) {
  .duel-grid {
    grid-template-columns: 1fr;
  }
}
</style>
