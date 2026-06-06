import { ApiFootballProvider } from '../../utils/sports-providers/api-football-provider'
import { FootballDataProvider } from '../../utils/sports-providers/football-data-provider'
import { ManualProvider } from '../../utils/sports-providers/manual-provider'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ provider?: 'api-football' | 'football-data' | 'manual' }>(event)
  const config = useRuntimeConfig()
  const providerName = body.provider ?? 'manual'
  const provider =
    providerName === 'api-football'
      ? new ApiFootballProvider(config.apiFootballKey)
      : providerName === 'football-data'
        ? new FootballDataProvider(config.footballDataKey)
        : new ManualProvider()

  const coverage = await provider.getCoverage({
    id: 'wc-2026',
    slug: 'world-cup-2026',
    seasonYear: 2026,
  })

  return {
    provider: provider.name,
    coverage,
    message: 'Endpoint techniczny. Produkcyjne zapisy powinny iść przez Supabase Edge Function/RPC z audit logiem.',
  }
})
