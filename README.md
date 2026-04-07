# sigflo
Smart Trader

## Local development

- Default local run (recommended): `npm run dev`
  - Starts Netlify Dev and proxies the Vite app plus serverless functions.
  - This keeps `/api/ai/suggest` working exactly like production.
- Direct Vite run (UI only): `npm run dev:vite`

### AI env vars for local Netlify Dev

Set these in your local environment (or a local `.env` loaded by Netlify CLI):

- `OPENAI_API_KEY` (required for live AI)
- `OPENAI_MODEL` (optional, defaults to `gpt-4o-mini`)
- `OPENAI_API_ENDPOINT` (optional, defaults to OpenAI chat completions endpoint)

## Bybit/MEXC read-only backend (phase 1)

This repo now includes a backend service in `backend/` for secure exchange integrations.

- Exchange secrets are submitted once and encrypted at rest.
- Secrets are never returned to the frontend.
- Connect flow validates key permissions as read-only and rejects keys with withdrawals enabled.
- Account snapshots are read-only (balances and positions only).

### Run backend locally

1. Copy `backend/.env.example` to `backend/.env` and fill values:
   - `DATABASE_URL`
   - `SUPABASE_JWT_SECRET` (Supabase Dashboard → Project Settings → API → JWT Secret)
   - `CREDENTIAL_ENCRYPTION_KEY` (64-char hex)
2. Run Postgres and apply SQL in `backend/migrations/001_init.sql`.
3. Start backend:
   - `cd backend`
   - `npm install`
   - `npm run dev`

### Frontend to backend wiring

Set frontend env values (for local):

- `VITE_BACKEND_API_BASE=http://localhost:8787/api`
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Supabase project; enable Google provider under Authentication → Providers)
- Optional dev fallback (no Supabase): `VITE_DEV_USER_ID=demo-user` — backend must omit `SUPABASE_JWT_SECRET` and run outside `NODE_ENV=production` to accept `x-user-id`.

In Supabase, add redirect URLs for your app origin (e.g. `http://localhost:3999/profile` when using Netlify Dev; matches `netlify.toml` `[dev] port`).

Signed-in users send `Authorization: Bearer <access_token>`; the backend verifies it with `SUPABASE_JWT_SECRET` and upserts the user row before exchange integrations.

## Deploy (Netlify)

Production config lives in `netlify.toml` (build, functions, SPA redirects, asset caching). Step-by-step env vars and checks: **[docs/NETLIFY.md](docs/NETLIFY.md)**.

Brief checklist:

1. Connect the repo in Netlify; keep default build `npm run build` / publish `dist`.
2. Set `OPENAI_API_KEY` (or `AI_API_KEY`) for serverless AI if you use those features.
3. Set `VITE_SUPABASE_*` and, if applicable, `VITE_BACKEND_API_BASE` for your hosted API.
4. Add **https://sigflo.group** (and `www` if used) to Supabase auth redirect allowlist, plus `http://localhost:3999` for local Netlify Dev.
