<script setup lang="ts">
import type { BonusStatisticSection } from '~/types/domain'

defineProps<{
  items: Array<{
    key: BonusStatisticSection
    label: string
    count: number
  }>
  activeKey: BonusStatisticSection
}>()

const emit = defineEmits<{
  select: [key: BonusStatisticSection]
}>()
</script>

<template>
  <nav class="category-tabs" aria-label="Kategorie statystyk">
    <button
      v-for="item in items"
      :key="item.key"
      class="category-tab"
      :class="{ active: item.key === activeKey }"
      type="button"
      :aria-current="item.key === activeKey ? 'page' : undefined"
      @click="emit('select', item.key)"
    >
      <span>{{ item.label }}</span>
      <strong>{{ item.count }}</strong>
    </button>
  </nav>
</template>

<style scoped>
.category-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 2px 2px 8px;
  scrollbar-width: thin;
}

.category-tab {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  gap: 9px;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.8);
  padding: 0 12px;
  color: var(--app-muted);
  flex: 0 0 auto;
  font-size: 13px;
  font-weight: 900;
}

.category-tab strong {
  display: inline-flex;
  min-width: 23px;
  height: 23px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #edf3ed;
  color: var(--app-primary-dark);
  font-size: 11px;
}

.category-tab:hover,
.category-tab:focus-visible,
.category-tab.active {
  border-color: var(--app-primary);
  background: var(--app-primary);
  color: white;
}

.category-tab.active strong,
.category-tab:hover strong,
.category-tab:focus-visible strong {
  background: rgba(255, 255, 255, 0.18);
  color: white;
}
</style>
