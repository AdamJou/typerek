import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const apiFootballKey = Deno.env.get('API_FOOTBALL_KEY') ?? Deno.env.get('NUXT_API_FOOTBALL_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: 'Missing Supabase service credentials.' }, { status: 500 })
  }

  if (!apiFootballKey) {
    return Response.json({
      provider: 'manual',
      status: 'warning',
      requestCount: 0,
      message: 'API_FOOTBALL_KEY is not configured. Use manual fallback or run the free-key spike first.',
    })
  }

  return Response.json({
    provider: 'api-football',
    status: 'planned',
    requestCount: 0,
    message: 'Edge Function scaffold is ready. Wire provider calls after the free API key has been verified.',
  })
})
