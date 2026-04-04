# Sigflo – Agent Instructions

## Cursor Cloud specific instructions

### Overview

Sigflo is a frontend-only React + TypeScript + Vite SPA for crypto trading signals. There is **no backend** — all market data comes from Bybit public API (REST + WebSocket) directly from the browser. No API keys or secrets are required.

### Services

| Service | How to run | Default URL |
|---|---|---|
| Vite Dev Server (UI only) | `npm run dev:vite` | `http://localhost:5173` |
| Netlify Dev (UI + AI function) | `npm run dev` | `http://localhost:3999` |

### Key commands

See `package.json` scripts:

- **Dev server (UI only, recommended for Cloud):** `npm run dev:vite`
- **Dev server (full Netlify Dev):** `npm run dev` — requires `netlify` CLI (`npm i -g netlify-cli`)
- **Build (tsc + vite):** `npm run build`
- **Lint:** `npm run lint`
- **Preview prod build:** `npm run preview`

### Caveats

- **ESLint config missing:** The repo declares ESLint 9 as a dev dependency but does not include an `eslint.config.js` (required by ESLint v9). Running `npm run lint` will fail until this config is added.
- **No automated tests:** The project has no test framework or test files. Validate changes via `npm run build` (TypeScript type-checking + production build) and manual browser testing.
- The app uses `import.meta.env.DEV` (built-in Vite flag) only — no custom `.env` files are needed.
- **Vite `allowedHosts`:** `vite.config.ts` sets `server.allowedHosts: 'all'` so the dev server works behind the Cursor Cloud VM proxy. Without this, Vite blocks the proxied hostname with a "Blocked request" error.
- **CORS errors in console:** The app tries to call the Bybit REST API directly from the browser, which is blocked by CORS in some environments. It falls back to mock data gracefully — this is expected behavior.
