import tailwindcss from '@tailwindcss/vite'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const localEnv = readLocalEnvFile()

function readLocalEnvFile() {
  const path = resolve(process.cwd(), '.env.local')

  if (!existsSync(path)) {
    return {} as Record<string, string>
  }

  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .reduce<Record<string, string>>((env, line) => {
      const separatorIndex = line.indexOf('=')

      if (separatorIndex === -1) {
        return env
      }

      const key = line.slice(0, separatorIndex).trim()
      const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '')

      if (key) {
        env[key] = value
      }

      return env
    }, {})
}

function envValue(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key] ?? localEnv[key]

    if (value) {
      return value
    }
  }

  return ''
}

export default defineNuxtConfig({
  compatibilityDate: '2026-06-03',
  ssr: false,
  srcDir: 'app',
  css: ['~/assets/css/main.css'],
  components: [{ path: '~/components', pathPrefix: false }],
  modules: ['@pinia/nuxt'],
  vite: {
    plugins: [tailwindcss()],
  },
  nitro: {
    preset: 'cloudflare_pages',
  },
  runtimeConfig: {
    apiFootballKey: '',
    footballDataKey: '',
    public: {
      supabaseUrl: envValue('NUXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'),
      supabaseKey: envValue('NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_KEY'),
      supabasePublishableKey: envValue('NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_KEY'),
      appName: 'Typerek MŚ 2026',
    },
  },
  app: {
    head: {
      title: 'Typerek MŚ 2026',
      meta: [
        {
          name: 'description',
          content: 'Prywatny typer piłkarski dla znajomych na Mistrzostwa Świata 2026.',
        },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
      link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
    },
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
})
