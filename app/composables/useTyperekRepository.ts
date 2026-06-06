import { TyperekRepository } from '~/repositories/TyperekRepository'

export function useTyperekRepository() {
  const { supabase } = useSupabase()

  if (!supabase.value) {
    return null
  }

  return new TyperekRepository(supabase.value)
}
