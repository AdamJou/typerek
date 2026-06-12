import type {
  TheSportsDbAuditDetails,
  TheSportsDbEventDetailsResponse,
  TheSportsDbResultsResponse,
} from '~/types/thesportsdb'

export function useTheSportsDbAudit() {
  const { session } = useAuth()
  const results = shallowRef<TheSportsDbResultsResponse | null>(null)
  const isLoadingResults = shallowRef(false)
  const resultsError = shallowRef('')
  const detailsByEventId = reactive<Record<string, TheSportsDbAuditDetails>>({})
  const detailsLoadingByEventId = reactive<Record<string, boolean>>({})
  const detailsErrorByEventId = reactive<Record<string, string>>({})

  async function loadResults() {
    resultsError.value = ''
    isLoadingResults.value = true

    try {
      const response = await $fetch<TheSportsDbResultsResponse>('/api/admin/thesportsdb/results', {
        headers: authorizationHeaders(),
      })

      results.value = response
      clearRecord(detailsByEventId)
      clearRecord(detailsLoadingByEventId)
      clearRecord(detailsErrorByEventId)
    } catch (error) {
      resultsError.value = auditErrorMessage(error)
    } finally {
      isLoadingResults.value = false
    }
  }

  async function loadEventDetails(eventId: string) {
    detailsErrorByEventId[eventId] = ''
    detailsLoadingByEventId[eventId] = true

    try {
      const response = await $fetch<TheSportsDbEventDetailsResponse>(
        `/api/admin/thesportsdb/events/${encodeURIComponent(eventId)}`,
        {
          headers: authorizationHeaders(),
        },
      )

      detailsByEventId[eventId] = response.audit
    } catch (error) {
      detailsErrorByEventId[eventId] = auditErrorMessage(error)
    } finally {
      detailsLoadingByEventId[eventId] = false
    }
  }

  function authorizationHeaders() {
    const accessToken = session.value?.access_token

    if (!accessToken) {
      throw new Error('not_authenticated')
    }

    return {
      Authorization: `Bearer ${accessToken}`,
    }
  }

  return {
    results: readonly(results),
    isLoadingResults: readonly(isLoadingResults),
    resultsError: readonly(resultsError),
    detailsByEventId: readonly(detailsByEventId),
    detailsLoadingByEventId: readonly(detailsLoadingByEventId),
    detailsErrorByEventId: readonly(detailsErrorByEventId),
    loadResults,
    loadEventDetails,
  }
}

function clearRecord(record: Record<string, unknown>) {
  for (const key of Object.keys(record)) {
    delete record[key]
  }
}

function auditErrorMessage(error: unknown) {
  const message = extractErrorMessage(error)

  if (message.includes('admin_required')) {
    return 'Tylko administrator może uruchomić audyt TheSportsDB.'
  }

  if (message.includes('not_authenticated')) {
    return 'Sesja wygasła. Zaloguj się ponownie.'
  }

  if (message.includes('thesportsdb_event_not_found')) {
    return 'TheSportsDB nie zwrócił szczegółów tego meczu.'
  }

  if (message.includes('invalid_thesportsdb_event_id')) {
    return 'Nieprawidłowy identyfikator meczu TheSportsDB.'
  }

  return message || 'Nie udało się pobrać danych z TheSportsDB.'
}

function extractErrorMessage(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return String(error ?? '')
  }

  if ('data' in error && typeof error.data === 'object' && error.data !== null && 'statusMessage' in error.data) {
    return String(error.data.statusMessage)
  }

  if ('statusMessage' in error) {
    return String(error.statusMessage)
  }

  if ('message' in error) {
    return String(error.message)
  }

  return ''
}
