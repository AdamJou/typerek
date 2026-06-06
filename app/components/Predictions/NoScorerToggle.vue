<script setup lang="ts">
const model = defineModel<boolean>({ required: true })
</script>

<template>
  <label class="no-scorer-toggle" :class="{ 'is-checked': model }">
    <input v-model="model" type="checkbox" />
    <span>Brak strzelca</span>
    <small>(0:0)</small>
  </label>
</template>

<style scoped>
.no-scorer-toggle {
  display: inline-flex;
  width: fit-content;
  height: 52px;
  min-height: 42px;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--app-line);
  border-radius: 999px;
  background: white;
  padding: 0 12px;
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 900;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    color 160ms ease;
}

.no-scorer-toggle:hover {
  border-color: rgba(12, 107, 70, 0.24);
  background: #f8fbf7;
}

.no-scorer-toggle.is-checked {
  border-color: #b9d5bf;
  background: #edf7ef;
  color: var(--app-primary-dark);
}

.no-scorer-toggle input {
  width: 16px;
  height: 16px;
  accent-color: var(--app-primary);
}

.no-scorer-toggle small {
  color: inherit;
  font-size: 11px;
  font-weight: 800;
  opacity: 0.75;
}
</style>
