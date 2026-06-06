<script setup lang="ts">
import { Trophy } from 'lucide-vue-next'
</script>

<template>
  <span class="logo">
    <span class="logo-mark" aria-hidden="true">
      <Trophy :size="18" />
    </span>
    <span class="logo-copy">
      <strong>Typerek</strong>
      <small>MŚ 2026</small>
    </span>
  </span>
</template>

<style scoped>
.logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--app-ink);
}

.logo-mark {
  display: inline-flex;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  background: var(--app-primary);
  color: white;
}

.logo-copy {
  display: grid;
  gap: 1px;
}

.logo-copy strong {
  font-size: 16px;
  line-height: 1;
}

.logo-copy small {
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}
</style>
