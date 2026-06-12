import { createClient } from '@supabase/supabase-js'
import type { H3Event } from 'h3'

interface AdminProfileRow {
  user_id: string
  is_admin: boolean | null
}

export async function requireAdminReadClient(event: H3Event) {
  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl || ''
  const publishableKey = config.public.supabasePublishableKey || config.public.supabaseKey || ''
  const authorization = getHeader(event, 'authorization')
  const accessToken = authorization?.replace(/^Bearer\s+/i, '')

  if (!supabaseUrl || !publishableKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'supabase_admin_not_configured',
    })
  }

  if (!accessToken) {
    throw createError({
      statusCode: 401,
      statusMessage: 'not_authenticated',
    })
  }

  const client = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })
  const { data: userData, error: userError } = await client.auth.getUser(accessToken)

  if (userError || !userData.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'not_authenticated',
    })
  }

  const { data: profileData, error: profileError } = await client
    .from('profiles')
    .select('user_id, is_admin')
    .eq('user_id', userData.user.id)
    .maybeSingle()

  if (profileError) {
    throw profileError
  }

  if (!(profileData as AdminProfileRow | null)?.is_admin) {
    throw createError({
      statusCode: 403,
      statusMessage: 'admin_required',
    })
  }

  return client
}
