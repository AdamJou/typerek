<script setup lang="ts">
import { Download, FileText, LoaderCircle } from 'lucide-vue-next'

const props = defineProps<{
  leagueId: string
  leagueName: string
}>()

const isExporting = shallowRef(false)
const statusMessage = shallowRef('')
const errorMessage = shallowRef('')

async function downloadExport() {
  if (!props.leagueId || isExporting.value) {
    return
  }

  const { supabase } = useSupabase()

  if (!supabase.value) {
    errorMessage.value = 'Brak połączenia z bazą danych.'
    return
  }

  isExporting.value = true
  statusMessage.value = ''
  errorMessage.value = ''

  try {
    const { data, error } = await supabase.value.auth.getSession()

    if (error || !data.session?.access_token) {
      throw new Error('Sesja administratora wygasła. Zaloguj się ponownie.')
    }

    const response = await fetch(`/api/admin/bonus-export?leagueId=${encodeURIComponent(props.leagueId)}`, {
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
      },
    })

    if (!response.ok) {
      throw new Error(await exportErrorMessage(response))
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')

    anchor.href = url
    anchor.download = responseFilename(response) ?? 'typerek-odpowiedzi.txt'
    anchor.hidden = true
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    statusMessage.value = 'Plik TXT został pobrany.'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Nie udało się przygotować eksportu.'
  } finally {
    isExporting.value = false
  }
}

function responseFilename(response: Response) {
  const disposition = response.headers.get('content-disposition')
  return disposition?.match(/filename="([^"]+)"/i)?.[1] ?? null
}

async function exportErrorMessage(response: Response) {
  const responseText = await response.text()

  if (response.status === 401) {
    return 'Sesja administratora wygasła. Zaloguj się ponownie.'
  }

  if (response.status === 403) {
    return 'Eksport jest dostępny tylko dla administratora.'
  }

  if (response.status === 404) {
    return 'Nie znaleziono ligi do eksportu.'
  }

  return responseText || 'Nie udało się przygotować eksportu.'
}
</script>

<template>
  <section class="export-card panel">
    <div class="export-icon" aria-hidden="true">
      <FileText :size="24" />
    </div>

    <div class="export-copy">
      <span class="eyebrow">Eksport TXT</span>
      <h2>Odpowiedzi uczestników</h2>
      <p>
        Pobierz czytelny plik z każdym uczestnikiem ligi {{ props.leagueName || 'Typerek' }}
        oraz jego odpowiedziami na wszystkie pytania bonusowe.
      </p>
      <p v-if="statusMessage" class="export-status" role="status">{{ statusMessage }}</p>
      <p v-if="errorMessage" class="export-error" role="alert">{{ errorMessage }}</p>
    </div>

    <button
      class="button-primary export-button"
      type="button"
      :disabled="!props.leagueId || isExporting"
      @click="downloadExport"
    >
      <LoaderCircle v-if="isExporting" class="spinning" :size="18" aria-hidden="true" />
      <Download v-else :size="18" aria-hidden="true" />
      {{ isExporting ? 'Przygotowuję...' : 'Pobierz TXT' }}
    </button>
  </section>
</template>

<style scoped>
.export-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 18px;
}

.export-icon {
  display: inline-flex;
  width: 48px;
  height: 48px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--app-surface-strong);
  color: var(--app-primary);
}

.export-copy {
  display: grid;
  gap: 4px;
}

.export-copy h2,
.export-copy p {
  margin: 0;
}

.export-copy h2 {
  font-size: 20px;
}

.export-copy p {
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.45;
}

.export-copy .export-status {
  color: var(--app-primary-dark);
}

.export-copy .export-error {
  color: var(--app-danger);
}

.eyebrow {
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}

.export-button {
  min-width: 150px;
}

.export-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.spinning {
  animation: spin 900ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 720px) {
  .export-card {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .export-button {
    grid-column: 1 / -1;
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinning {
    animation: none;
  }
}
</style>
