import { computed, nextTick, onMounted, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'

export type MatchesListMode = 'upcoming' | 'pending' | 'all' | 'bulk'
export type MatchDetailReturnSource = 'league' | 'matches'

interface MatchesListSnapshot {
  mode: MatchesListMode
  stageId: string
  scrollY: number
  matchId: string
  savedAt: number
}

interface MatchDetailReturnSnapshot {
  source: MatchDetailReturnSource
  scrollY: number
  matchId: string
  savedAt: number
}

const MATCHES_LIST_STORAGE_KEY = 'typerek:matches-list-state'
const MATCH_DETAIL_RETURN_STORAGE_KEY = 'typerek:match-detail-return-state'
const MAX_STATE_AGE_MS = 30 * 60 * 1000
const RESTORE_OFFSET_PX = 84
const modes = new Set<MatchesListMode>(['upcoming', 'pending', 'all', 'bulk'])
const returnSources = new Set<MatchDetailReturnSource>(['league', 'matches'])

export function useMatchesListState(
  activeMode: Ref<MatchesListMode>,
  activeStageId: Ref<string>,
  hasLoaded: Readonly<Ref<boolean>>,
) {
  const pendingSnapshot = shallowRef<MatchesListSnapshot | null>(import.meta.client ? readMatchesListState() : null)
  const hasRestored = shallowRef(false)

  if (pendingSnapshot.value) {
    activeMode.value = pendingSnapshot.value.mode
    activeStageId.value = pendingSnapshot.value.stageId
  }

  function saveMatchesListState(matchId: string) {
    if (!import.meta.client) {
      return
    }

    writeMatchesListState({
      mode: activeMode.value,
      stageId: activeStageId.value,
      scrollY: window.scrollY,
      matchId,
      savedAt: Date.now(),
    })
    writeMatchDetailReturnState({
      source: 'matches',
      scrollY: window.scrollY,
      matchId,
      savedAt: Date.now(),
    })
  }

  async function restoreMatchesListState() {
    if (!import.meta.client || !hasLoaded.value || hasRestored.value || !pendingSnapshot.value) {
      return
    }

    hasRestored.value = true
    await nextTick()

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToSavedPosition(pendingSnapshot.value!)
        sessionStorage.removeItem(MATCHES_LIST_STORAGE_KEY)
        pendingSnapshot.value = null
      })
    })
  }

  watch(hasLoaded, () => {
    void restoreMatchesListState()
  }, { immediate: true })

  onMounted(() => {
    void restoreMatchesListState()
  })

  return {
    saveMatchesListState,
  }
}

export function useLeagueMatchReturnState(hasLoaded: Readonly<Ref<boolean>>) {
  const pendingSnapshot = shallowRef<MatchDetailReturnSnapshot | null>(
    import.meta.client ? readMatchDetailReturnState('league') : null,
  )
  const hasRestored = shallowRef(false)

  function saveLeagueMatchReturnState(matchId: string) {
    if (!import.meta.client) {
      return
    }

    writeMatchDetailReturnState({
      source: 'league',
      scrollY: window.scrollY,
      matchId,
      savedAt: Date.now(),
    })
  }

  async function restoreLeagueMatchReturnState() {
    if (!import.meta.client || !hasLoaded.value || hasRestored.value || !pendingSnapshot.value) {
      return
    }

    hasRestored.value = true
    await nextTick()

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToSavedPosition(pendingSnapshot.value!)
        sessionStorage.removeItem(MATCH_DETAIL_RETURN_STORAGE_KEY)
        pendingSnapshot.value = null
      })
    })
  }

  watch(hasLoaded, () => {
    void restoreLeagueMatchReturnState()
  }, { immediate: true })

  onMounted(() => {
    void restoreLeagueMatchReturnState()
  })

  return {
    saveLeagueMatchReturnState,
  }
}

export function useMatchDetailReturnLink() {
  const source = shallowRef<MatchDetailReturnSource>('matches')

  onMounted(() => {
    source.value = readMatchDetailReturnState()?.source ?? 'matches'
  })

  return computed(() => {
    if (source.value === 'league') {
      return {
        to: '/league',
        label: 'Wróć do ligi',
      }
    }

    return {
      to: '/matches',
      label: 'Wróć do meczów',
    }
  })
}

function readMatchesListState() {
  try {
    const rawState = sessionStorage.getItem(MATCHES_LIST_STORAGE_KEY)

    if (!rawState) {
      return null
    }

    const parsedState = JSON.parse(rawState) as Partial<MatchesListSnapshot>

    if (
      !parsedState ||
      typeof parsedState !== 'object' ||
      !parsedState.mode ||
      !modes.has(parsedState.mode) ||
      typeof parsedState.savedAt !== 'number' ||
      Date.now() - parsedState.savedAt > MAX_STATE_AGE_MS
    ) {
      sessionStorage.removeItem(MATCHES_LIST_STORAGE_KEY)
      return null
    }

    return {
      mode: parsedState.mode,
      stageId: typeof parsedState.stageId === 'string' ? parsedState.stageId : '',
      scrollY: typeof parsedState.scrollY === 'number' && Number.isFinite(parsedState.scrollY) ? parsedState.scrollY : 0,
      matchId: typeof parsedState.matchId === 'string' ? parsedState.matchId : '',
      savedAt: parsedState.savedAt,
    }
  } catch {
    sessionStorage.removeItem(MATCHES_LIST_STORAGE_KEY)
    return null
  }
}

function writeMatchesListState(snapshot: MatchesListSnapshot) {
  try {
    sessionStorage.setItem(MATCHES_LIST_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    sessionStorage.removeItem(MATCHES_LIST_STORAGE_KEY)
  }
}

function readMatchDetailReturnState(expectedSource?: MatchDetailReturnSource) {
  try {
    const rawState = sessionStorage.getItem(MATCH_DETAIL_RETURN_STORAGE_KEY)

    if (!rawState) {
      return null
    }

    const parsedState = JSON.parse(rawState) as Partial<MatchDetailReturnSnapshot>

    if (
      !parsedState ||
      typeof parsedState !== 'object' ||
      !parsedState.source ||
      !returnSources.has(parsedState.source) ||
      typeof parsedState.savedAt !== 'number' ||
      Date.now() - parsedState.savedAt > MAX_STATE_AGE_MS
    ) {
      sessionStorage.removeItem(MATCH_DETAIL_RETURN_STORAGE_KEY)
      return null
    }

    if (expectedSource && parsedState.source !== expectedSource) {
      return null
    }

    return {
      source: parsedState.source,
      scrollY: typeof parsedState.scrollY === 'number' && Number.isFinite(parsedState.scrollY) ? parsedState.scrollY : 0,
      matchId: typeof parsedState.matchId === 'string' ? parsedState.matchId : '',
      savedAt: parsedState.savedAt,
    }
  } catch {
    sessionStorage.removeItem(MATCH_DETAIL_RETURN_STORAGE_KEY)
    return null
  }
}

function writeMatchDetailReturnState(snapshot: MatchDetailReturnSnapshot) {
  try {
    sessionStorage.setItem(MATCH_DETAIL_RETURN_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    sessionStorage.removeItem(MATCH_DETAIL_RETURN_STORAGE_KEY)
  }
}

function scrollToSavedPosition(snapshot: MatchesListSnapshot) {
  const target = findMatchElement(snapshot.matchId)

  if (target) {
    const top = target.getBoundingClientRect().top + window.scrollY - RESTORE_OFFSET_PX
    window.scrollTo({ top: Math.max(0, top), behavior: 'auto' })
    return
  }

  window.scrollTo({ top: Math.max(0, snapshot.scrollY), behavior: 'auto' })
}

function findMatchElement(matchId: string) {
  if (!matchId) {
    return null
  }

  return [...document.querySelectorAll<HTMLElement>('[data-match-id]')].find((element) => element.dataset.matchId === matchId) ?? null
}
