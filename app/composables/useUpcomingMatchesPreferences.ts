import { computed } from 'vue'

interface UpcomingMatchesPreferences {
  showTodayOnly: boolean
}

const DEFAULT_PREFERENCES: UpcomingMatchesPreferences = {
  showTodayOnly: false,
}

const COOKIE_NAME = 'typerek-dashboard-upcoming-preferences'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export function useUpcomingMatchesPreferences() {
  const preferences = useCookie<Partial<UpcomingMatchesPreferences>>(COOKIE_NAME, {
    default: () => ({ ...DEFAULT_PREFERENCES }),
    maxAge: COOKIE_MAX_AGE_SECONDS,
    sameSite: 'lax',
  })
  const normalizedPreferences = computed(() => normalizePreferences(preferences.value))

  function updatePreference<Key extends keyof UpcomingMatchesPreferences>(key: Key, value: UpcomingMatchesPreferences[Key]) {
    preferences.value = {
      ...normalizedPreferences.value,
      [key]: value,
    }
  }

  const showUpcomingTodayOnly = computed({
    get: () => normalizedPreferences.value.showTodayOnly,
    set: (value: boolean) => updatePreference('showTodayOnly', value),
  })

  return {
    showUpcomingTodayOnly,
  }
}

function normalizePreferences(value: Partial<UpcomingMatchesPreferences> | null | undefined): UpcomingMatchesPreferences {
  return {
    showTodayOnly: typeof value?.showTodayOnly === 'boolean' ? value.showTodayOnly : DEFAULT_PREFERENCES.showTodayOnly,
  }
}
