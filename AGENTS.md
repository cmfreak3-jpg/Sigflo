# Sigflo – Agent Instructions

## Cursor Cloud specific instructions

### Overview

Sigflo is a React + TypeScript + Vite SPA for crypto trading signals. Core market data comes from Bybit public API (REST + WebSocket) directly from the browser. An optional Express backend in `backend/` handles exchange integrations (requires PostgreSQL). No API keys or secrets are required for the core frontend.

### Services

| Service | How to run | Default URL | Required? |
|---|---|---|---|
| Vite Dev Server | `npm run dev:vite` | `http://localhost:5173` | **Yes** |
| Express Backend | `npm run dev:backend` | `http://127.0.0.1:8787` | No (exchange integrations only) |
| Netlify Dev | `npm run dev` (needs `netlify-cli`) | `http://localhost:3999` | No (wraps Vite + serverless functions) |
| Netlify production | Git-linked site; build `npm run build`, publish `dist` | **https://sigflo.group** | Hosting + `/api/ai/*` functions; see `docs/NETLIFY.md` |

### Key commands

See `package.json` scripts:

- **Dev server (Vite only):** `npm run dev:vite`
- **Dev server (Netlify Dev, needs global `netlify-cli`):** `npm run dev`
- **Build (tsc + vite):** `npm run build`
- **Lint:** `npm run lint`
- **Preview prod build:** `npm run preview`

### Caveats

- **ESLint:** `npm run lint` works (ESLint 9 flat config in `eslint.config.js`). Expect ~30 warnings (react-hooks/exhaustive-deps, react-refresh); 0 errors.
- **No automated tests:** The project has no test framework or test files. Validate changes via `npm run build` (TypeScript type-checking + production build) and manual browser testing.
- Optional env vars are documented in `.env.example` (`VITE_SUPABASE_*`, `VITE_BACKEND_API_BASE`, `VITE_USE_MOCK_TRADE_DATA`, etc.). Production trade levels use the live market feed unless `VITE_USE_MOCK_TRADE_DATA=true`.
- **Vite `allowedHosts`:** `vite.config.ts` sets `server.allowedHosts: 'all'` so the dev server works behind the Cursor Cloud VM proxy. Without this, Vite blocks the proxied hostname with a "Blocked request" error.
- **CORS errors in console:** The app tries to call the Bybit REST API directly from the browser, which is blocked by CORS in some environments. It falls back to mock data gracefully — this is expected behavior.

### Netlify production deploy

- **Auto-deploy:** pushing to `main` triggers a build on Netlify automatically (see `docs/NETLIFY.md`).
- **CLI deploy (requires secrets `NETLIFY_AUTH_TOKEN` + `NETLIFY_SITE_ID`):**
  ```bash
  npm run build
  npx netlify-cli deploy --prod --dir=dist --functions=netlify/functions
  ```
  The CLI picks up `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` from the environment. Production URL: **https://www.sigflo.group**.
- Full env-var reference and one-time setup: see `docs/NETLIFY.md`.

### Trade chart plot height (do not duplicate)

Trade screen chart **expanded/collapsed** plot heights (px) live in **`src/config/tradeChartHeights.ts`** only. `ChartHeader`, `TradeScreen`, and `PriceChartCard` import those constants — **do not** reintroduce hardcoded `260`/`120`/`116`/`56` etc. in those files (values drifted repeatedly in the past).
