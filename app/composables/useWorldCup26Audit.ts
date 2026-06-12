import type {
  WorldCup26AuditDetails,
  WorldCup26EventDetailsResponse,
  WorldCup26ResultsResponse,
} from '~/types/worldcup26'

export function useWorldCup26Audit() {
  const { session } = useAuth()
  const results = shallowRef<WorldCup26ResultsResponse | null>(null)
  const isLoadingResults = shallowRef(false)
  const resultsError = shallowRef('')
  const detailsByEventId = reactive<Record<string, WorldCup26AuditDetails>>({})
  const detailsLoadingByEventId = reactive<Record<string, boolean>>({})
  const detailsErrorByEventId = reactive<Record<string, string>>({})

  async function loadResults() {
    resultsError.value = ''
    isLoadingResults.value = true

    try {
      const response = await $fetch<WorldCup26ResultsResponse>('/api/admin/worldcup26/results', {
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
      const response = await $fetch<WorldCup26EventDetailsResponse>(
        `/api/admin/worldcup26/events/${encodeURIComponent(eventId)}`,
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
    return 'Tylko administrator może uruchomić audyt WorldCup26.'
  }

  if (message.includes('not_authenticated')) {
    return 'Sesja wygasła. Zaloguj się ponownie.'
  }

  if (message.includes('worldcup26_event_not_found')) {
    return 'WorldCup26 nie zwrócił tego meczu.'
  }

  if (message.includes('invalid_worldcup26_event_id')) {
    return 'Nieprawidłowy numer meczu WorldCup26.'
  }

  if (message.includes('worldcup26_invalid')) {
    return 'WorldCup26 zwrócił nieprawidłowy format danych.'
  }

  return message || 'Nie udało się pobrać danych z WorldCup26.'
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
