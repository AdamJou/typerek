<script setup lang="ts">
import { Database, RefreshCw } from 'lucide-vue-next'

const { supabase, isConfigured } = useSupabase()
const status = shallowRef<'idle' | 'loading' | 'success' | 'error'>('idle')
const message = shallowRef('Połączenie nie zostało jeszcze sprawdzone.')

async function checkConnection() {
  if (!supabase.value) {
    status.value = 'error'
    message.value = 'Brakuje konfiguracji Supabase.'
    return
  }

  status.value = 'loading'
  message.value = 'Sprawdzam połączenie...'

  const { error } = await supabase.value.from('tournaments').select('id').limit(1)

  if (error) {
    status.value = 'error'
    message.value = error.message
    return
  }

  status.value = 'success'
  message.value = 'Połączenie z Supabase działa. Tabela `tournaments` jest dostępna.'
}
</script>

<template>
  <section class="supabase-page">
    <div class="page-heading">
      <h1>Supabase</h1>
      <p>Diagnostyka klienta Supabase bez zastępowania aplikacji przykładem z tabelą `todos`.</p>
    </div>

    <section class="supabase-card panel" :data-status="status">
      <Database :size="26" aria-hidden="true" />
      <div>
        <strong>{{ isConfigured ? 'Konfiguracja wykryta' : 'Brak konfiguracji' }}</strong>
        <span>{{ message }}</span>
      </div>
      <button class="button-primary" type="button" @click="checkConnection">
        <RefreshCw :size="18" aria-hidden="true" />
        Sprawdź
      </button>
    </section>
  </section>
</template>

<style scoped>
.supabase-page,
.page-heading {
  display: grid;
  gap: 16px;
}

.page-heading h1,
.page-heading p {
  margin: 0;
}

.page-heading h1 {
  font-size: clamp(32px, 8vw, 48px);
  line-height: 1;
}

.page-heading p {
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 700;
}

.supabase-card {
  display: grid;
  gap: 14px;
  padding: 16px;
}

.supabase-card svg {
  color: var(--app-primary);
}

.supabase-card div {
  display: grid;
  gap: 6px;
}

.supabase-card strong {
  font-size: 18px;
}

.supabase-card span {
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.45;
}
</style>
