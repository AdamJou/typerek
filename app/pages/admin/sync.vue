<script setup lang="ts">
import { ClipboardPenLine, ListChecks } from 'lucide-vue-next'

const message = shallowRef('')


</script>

<template>
  <section class="admin-page">
 
    <NuxtLink class="settings-card panel" to="/admin/matches">
      <ClipboardPenLine :size="22" aria-hidden="true" />
      <span>
        <strong>Wyniki meczów</strong>
        <small>Ręczne wpisanie wyniku i pierwszego strzelca.</small>
      </span>
    </NuxtLink>

    <NuxtLink class="settings-card panel" to="/admin/bonus">
      <ListChecks :size="22" aria-hidden="true" />
      <span>
        <strong>Pytania bonusowe</strong>
        <small>Dodawanie i usuwanie pytań zgodnych z aktualnymi typami.</small>
      </span>
    </NuxtLink>

    <p v-if="message" class="admin-message">{{ message }}</p>
  </section>
</template>

<style scoped>
.admin-page,
.page-heading {
  display: grid;
  gap: 16px;
}

.page-heading h1,
.page-heading p,
.admin-message {
  margin: 0;
}

.page-heading h1 {
  font-size: clamp(32px, 8vw, 48px);
  line-height: 1;
}

.page-heading p,
.admin-message {
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 700;
}

.admin-message {
  border: 1px solid #f0d58e;
  border-radius: 7px;
  background: #fff7df;
  padding: 12px;
  color: #735712;
}

.settings-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  color: var(--app-ink);
}

.settings-card svg {
  flex: 0 0 auto;
  color: var(--app-primary);
}

.settings-card span {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.settings-card strong {
  font-size: 15px;
  font-weight: 950;
}

.settings-card small {
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 750;
}
</style>
