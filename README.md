# Typerek MŚ 2026

Prywatna, polskojęzyczna aplikacja mobile-first do typowania wyników Mistrzostw Świata 2026.

## Deployment

The application is deployed to Cloudflare Pages using the free plan.

- Build command: `npm run build`
- Output directory: `dist`
- Production branch: `main`
- Runtime preset: `cloudflare_pages`

Required build variables:

- `NUXT_PUBLIC_SUPABASE_URL`
- `NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Optional server secret for API-Football synchronization:

- `NUXT_API_FOOTBALL_KEY`

Deploy manually after building:

```powershell
npx wrangler pages deploy dist --project-name typerek-ms-2026 --branch main
```

Supabase Auth must allow the production callback:

- Site URL: `https://typerek-ms-2026.pages.dev`
- Redirect URL: `https://typerek-ms-2026.pages.dev/auth/login`
