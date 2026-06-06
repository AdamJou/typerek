<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'

defineProps<{
  to: string
  label: string
}>()
</script>

<template>
  <NuxtLink class="back-link" :to="to">
    <ArrowLeft :size="18" aria-hidden="true" />
    <span>{{ label }}</span>
  </NuxtLink>
</template>

<style scoped>
.back-link {
  display: inline-flex;
  width: fit-content;
  min-height: 38px;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(189, 209, 195, 0.9);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.82);
  padding: 0 12px;
  color: var(--app-primary-dark);
  font-size: 13px;
  font-weight: 900;
  line-height: 1;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    transform 160ms ease;
}

.back-link:hover {
  border-color: rgba(12, 107, 70, 0.32);
  background: #edf5ef;
}

.back-link:active {
  transform: translateY(1px);
}

.back-link:focus-visible {
  outline: 3px solid rgba(12, 107, 70, 0.18);
  outline-offset: 2px;
}
</style>
