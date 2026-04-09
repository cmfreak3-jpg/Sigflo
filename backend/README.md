# Sigflo backend (Express)

Optional API for **exchange integrations**, **portfolio sync**, and **trade** routes. The main Sigflo SPA can run without it; the browser talks to Bybit public APIs directly for charts. This service holds encrypted API keys in Postgres and calls exchange APIs server-side.

## Requirements

- **Node.js** ≥ 20  
- **PostgreSQL** (local or hosted, e.g. Supabase pooler URI)

## Setup

1. Copy env template and fill values:

   ```bash
   cp .env.example .env
   ```

2. **`CREDENTIAL_ENCRYPTION_KEY`** must be **64 hex characters** (32 bytes). Example:

   ```bash
   openssl rand -hex 32
   ```

3. **`DATABASE_URL`** must be a Postgres connection string (`postgres://` or `postgresql://`). Use the database URI from Supabase (or local Postgres), not the `https://…supabase.co` project URL—that value belongs in **`SUPABASE_URL`**.

4. Install and run:

   ```bash
   npm install
   npm run dev
   ```

   Default listen: **`0.0.0.0:8787`** (override with `PORT` / `HOST`).

## Scripts

| Command        | Purpose                          |
|----------------|----------------------------------|
| `npm run dev`  | `tsx watch` — hot reload         |
| `npm run build`| Compile to `dist/`               |
| `npm start`    | Run compiled `dist/server.js`    |
| `npm test`     | Node test runner (`*.test.ts`)   |

## Environment variables

See **`.env.example`** for the full list. Important fields:

| Variable | Role |
|----------|------|
| `FRONTEND_ORIGIN` | Comma-separated browser origins allowed by CORS (e.g. `https://sigflo.group,http://localhost:5173`). |
| `DATABASE_URL` | Postgres connection string. |
| `CREDENTIAL_ENCRYPTION_KEY` | 64-char hex; encrypts stored API secrets. |
| `SUPABASE_JWT_SECRET` | Verifies `Authorization: Bearer` from the SPA (Supabase session). |
| `SUPABASE_URL` | Supabase project HTTPS URL; used for JWKS when JWTs are RS256. |

Optional: `DATABASE_SSL_REJECT_UNAUTHORIZED`, `NODE_ENV`, `PORT`, `HOST`.

## Authentication

- **Production / normal:** SPA sends **`Authorization: Bearer <supabase access_token>`**. Configure **`SUPABASE_JWT_SECRET`** and/or **`SUPABASE_URL`**.
- **Local dev without JWT:** If **`SUPABASE_JWT_SECRET` is unset** and **`NODE_ENV` is not `production`**, the server accepts **`x-user-id`** (and optional **`x-user-email`**). The Vite app can set **`VITE_DEV_USER_ID`** so the client sends that header.

If JWT secret is set but the client sends no Bearer token, you will see **`Auth rejected: missing bearer token.`** in logs.

## API surface

Mounted under **`/api`** (rate-limited):

- **`/api/integrations`** — connect/disconnect exchanges, encrypted credentials  
- **`/api/portfolio`** — balances, positions, closed trades (exchange adapters)  
- **`/api/trade`** — place orders via exchange adapters  

**`GET /health`** — no auth, for load balancers.

## Frontend wiring

From the **repo root**, point the SPA at this API (omit to use same-origin `/api` with a reverse proxy):

```env
VITE_BACKEND_API_BASE=http://127.0.0.1:8787
```

Use the **origin only** (no `/api` suffix); the client appends `/api` itself. In production, set the same variable on Netlify (or your host) to your deployed API URL.

## Deployment

This app is **not** deployed by the root **Netlify** static build. Host it on **Railway**, **Render**, **Fly.io**, etc., with `DATABASE_URL` and secrets set in the provider UI. Set **`FRONTEND_ORIGIN`** to your real site origin(s). Enable **trust proxy** is already configured for platforms that set `X-Forwarded-For`.

## Troubleshooting

### Bybit portfolio sync: HTML / CloudFront 403 (not JSON)

The server calls **`https://api.bybit.com`**. An **HTML** 403 usually means Bybit’s **edge** blocked the request before normal API JSON (not a Sigflo bug in signature logic).

1. **IP allowlist:** If the key restricts IPs, add your host’s **outbound public IP** (e.g. Railway egress). “No IP restriction” rules out allowlist-only failures.
2. **Region / provider:** If it still fails, try another **cloud region** (e.g. US ↔ EU). Many providers’ egress ranges are blocked or restricted at the exchange edge.
3. **Quick check from the same host:**  
   `curl -sS -D - "https://api.bybit.com/v5/market/time" -o /dev/null | head -20`  
   If this returns **403** and **HTML**, the issue is **reachability from that machine/region**, not your stored API key.

### CORS errors in the browser

Add your exact SPA origin (scheme + host + port) to **`FRONTEND_ORIGIN`**.

### Database TLS (Supabase)

Remote hosts often use TLS; the app relaxes certificate verification for common hosted Postgres setups unless **`DATABASE_SSL_REJECT_UNAUTHORIZED`** is set explicitly—see `src/db/index.ts` if you need stricter verify.
