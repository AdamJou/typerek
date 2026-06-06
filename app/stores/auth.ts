import type { Session, User } from '@supabase/supabase-js'

interface LoginPayload {
  email: string
  password: string
}

interface RegisterPayload extends LoginPayload {
  displayName: string
}

interface RegisterResult {
  requiresEmailConfirmation: boolean
  user: User | null
}

interface UpdateProfilePayload {
  displayName: string
  timezone?: string
}

interface AuthSubscription {
  unsubscribe: () => void
}

export const useAuthStore = defineStore('auth', () => {
  const session = shallowRef<Session | null>(null)
  const user = shallowRef<User | null>(null)
  const profileDisplayName = shallowRef<string | null>(null)
  const profileIsAdmin = shallowRef(false)
  const initialized = shallowRef(false)
  const loading = shallowRef(false)
  const errorMessage = shallowRef('')
  let subscription: AuthSubscription | null = null

  const { supabase, isConfigured } = useSupabase()
  const configured = computed(() => isConfigured)
  const isAuthenticated = computed(() => Boolean(session.value?.user))
  const isAdmin = computed(() => profileIsAdmin.value)
  const displayName = computed(() => profileDisplayName.value ?? user.value?.email ?? 'niezalogowany')

  function requireClient() {
    if (!isConfigured || !supabase.value) {
      throw new Error('Aplikacja nie jest jeszcze gotowa do logowania.')
    }

    return supabase.value
  }

  function setSession(nextSession: Session | null) {
    session.value = nextSession
    user.value = nextSession?.user ?? null

    if (!nextSession) {
      profileDisplayName.value = null
      profileIsAdmin.value = false
    }
  }

  async function loadProfileDisplayName(userId: string | null | undefined) {
    if (!userId || !supabase.value) {
      profileDisplayName.value = null
      profileIsAdmin.value = false
      return
    }

    const { data, error } = await supabase.value
      .from('profiles')
      .select('display_name, is_admin')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      profileDisplayName.value = user.value?.user_metadata?.display_name ?? null
      profileIsAdmin.value = false
      return
    }

    profileDisplayName.value = data?.display_name ?? user.value?.user_metadata?.display_name ?? null
    profileIsAdmin.value = Boolean(data?.is_admin)
  }

  function startListener() {
    if (subscription || !supabase.value) {
      return
    }

    const { data } = supabase.value.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      void loadProfileDisplayName(nextSession?.user.id)
      initialized.value = true
    })

    subscription = data.subscription
  }

  async function init() {
    if (initialized.value) {
      return
    }

    if (!isConfigured || !supabase.value) {
      initialized.value = true
      return
    }

    loading.value = true
    errorMessage.value = ''

    try {
      startListener()
      const { data, error } = await supabase.value.auth.getSession()

      if (error) {
        throw error
      }

      setSession(data.session)
      await loadProfileDisplayName(data.session?.user.id)
      initialized.value = true
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Nie udało się odczytać sesji.'
      setSession(null)
      initialized.value = true
    } finally {
      loading.value = false
    }
  }

  async function login(payload: LoginPayload) {
    const client = requireClient()
    loading.value = true
    errorMessage.value = ''

    try {
      startListener()
      const { data, error } = await client.auth.signInWithPassword(payload)

      if (error) {
        throw error
      }

      setSession(data.session)
      await loadProfileDisplayName(data.session?.user.id)
      initialized.value = true
      return data.user
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Nie udało się zalogować.'
      throw error
    } finally {
      loading.value = false
    }
  }

  async function register(payload: RegisterPayload) {
    const client = requireClient()
    loading.value = true
    errorMessage.value = ''

    try {
      startListener()
      const { data, error } = await client.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
          data: {
            display_name: payload.displayName.trim(),
          },
        },
      })

      if (error) {
        throw error
      }

      setSession(data.session)
      user.value = data.user ?? data.session?.user ?? null
      profileDisplayName.value = payload.displayName.trim()
      profileIsAdmin.value = false
      initialized.value = true
      return {
        requiresEmailConfirmation: !data.session,
        user: data.user,
      } satisfies RegisterResult
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Nie udało się utworzyć konta.'
      throw error
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    const client = requireClient()
    loading.value = true
    errorMessage.value = ''

    try {
      await client.auth.signOut()
      setSession(null)
      profileDisplayName.value = null
      initialized.value = true
    } finally {
      loading.value = false
    }
  }

  async function updateProfile(payload: UpdateProfilePayload) {
    const client = requireClient()
    loading.value = true
    errorMessage.value = ''

    try {
      const { data, error } = await client.rpc('update_profile', {
        p_display_name: payload.displayName.trim(),
        p_timezone: payload.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        p_avatar_url: null,
      })

      if (error) {
        throw error
      }

      profileDisplayName.value = data?.display_name ?? payload.displayName.trim()
      return data
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Nie udało się zapisać profilu.'
      throw error
    } finally {
      loading.value = false
    }
  }

  return {
    session,
    user,
    profileDisplayName,
    initialized,
    loading,
    errorMessage,
    isConfigured: configured,
    isAuthenticated,
    isAdmin,
    displayName,
    displayEmail: displayName,
    init,
    login,
    logout,
    register,
    updateProfile,
  }
})
