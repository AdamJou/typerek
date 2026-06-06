import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { shallowRef } from 'vue'

let client: SupabaseClient | null = null

export function useSupabase() {
  const config = useRuntimeConfig()
  const supabaseUrl =
    config.public.supabaseUrl ||
    import.meta.env.NUXT_PUBLIC_SUPABASE_URL ||
    import.meta.env.VITE_SUPABASE_URL ||
    ''
  const supabaseKey =
    config.public.supabasePublishableKey ||
    config.public.supabaseKey ||
    import.meta.env.NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    ''
  const isConfigured = Boolean(supabaseUrl && supabaseKey)
  const supabase = shallowRef<SupabaseClient | null>(null)

  if (isConfigured && !client) {
    client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'typerek-auth',
      },
    })
  }

  supabase.value = client

  return {
    supabase,
    isConfigured,
  }
}
