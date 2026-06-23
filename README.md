# Nestava — Real Estate Software

All-in-one platform for real estate agents: due diligence (Buyer Defense Report), CRM, marketing, sites, prospecting, mortgage tools, and transactions — one login, one data layer.

## This repo
- **`index.html`** — the Nestava app (all 9 surfaces, interactive). Vercel serves this as a static site at the root URL. Currently runs on seeded/mock data; flips to the live API once env vars are set.
- **`/backend`** — the Layer 2 API + data layer (Hono + Drizzle), vendor adapters, compliance, report engine, and the SQL that defines the database.
- **`/backend/sql`** — `schema.sql` (tables) + `rls.sql` (tenant row-level security) + `seed.sql` (demo data). Already applied to the Supabase **Nestava-prod** project.

## Status
- ✅ Database live on Supabase (Nestava-prod) — schema + RLS + demo data.
- ✅ App deployable as a static site (this repo) on Vercel.
- ⏳ Next: connect the app to the API, wire Supabase Auth + Square (billing, later), and swap mock data adapters to live sources.

## Deploy (Vercel)
This is a static site at the root — no build step. In the Vercel project: connect this repo, Framework Preset = **Other**, Root Directory = **/**. Environment variables to add when wiring the live API:
- `SUPABASE_URL=https://xvyqpdkzckmnwpeglffc.supabase.co`
- `SUPABASE_ANON_KEY=` (Supabase → Project Settings → API)
- `SUPABASE_SERVICE_ROLE_KEY=` (server-side only; never exposed to the browser)

See `/backend/README.md` for the API + full architecture.
