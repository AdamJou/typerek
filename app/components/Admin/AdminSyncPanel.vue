<script setup lang="ts">
import { Play, RefreshCw } from 'lucide-vue-next'
import type { SynchronizationLog } from '~/types/domain'

defineProps<{
  logs: readonly SynchronizationLog[]
}>()

const emit = defineEmits<{
  sync: []
  recalculate: []
}>()
</script>

<template>
  <section class="admin-sync panel">
    <div class="admin-sync-header">
      <div>
        <h2>Aktualizacja danych</h2>
        <p>Odśwież terminarz i wyniki albo przelicz punkty po ręcznej korekcie.</p>
      </div>
      <div class="admin-sync-actions">
        <button class="button-primary" type="button" @click="emit('sync')">
          <RefreshCw :size="18" aria-hidden="true" />
          Odśwież dane
        </button>
        <button class="button-secondary" type="button" @click="emit('recalculate')">
          <Play :size="18" aria-hidden="true" />
          Przelicz punkty
        </button>
      </div>
    </div>

    <div class="sync-log-list">
      <article v-for="log in logs" :key="log.id" class="sync-log-row">
        <strong>{{ log.provider }}</strong>
        <span>{{ log.status }}</span>
        <small>{{ log.requestCount }} żądań</small>
        <p>{{ log.message }}</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.admin-sync {
  display: grid;
  gap: 18px;
  padding: 18px;
}

.admin-sync-header {
  display: grid;
  gap: 16px;
}

.admin-sync h2,
.admin-sync p {
  margin: 0;
}

.admin-sync h2 {
  font-size: 20px;
}

.admin-sync p {
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 700;
}

.admin-sync-actions {
  display: grid;
  gap: 10px;
}

.sync-log-list {
  display: grid;
  gap: 10px;
}

.sync-log-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 8px 12px;
  border: 1px solid var(--app-line);
  border-radius: 7px;
  background: white;
  padding: 12px;
}

.sync-log-row p {
  grid-column: 1 / -1;
}

.sync-log-row span,
.sync-log-row small {
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}

@media (min-width: 780px) {
  .admin-sync-header {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
  }

  .admin-sync-actions {
    grid-template-columns: repeat(2, auto);
  }
}
</style>
