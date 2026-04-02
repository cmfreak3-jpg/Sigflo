# Sigflo – Agent Instructions

## Cursor Cloud specific instructions

### Overview

Sigflo is a React + TypeScript + Vite SPA for crypto trading signals. Market data comes from Bybit public API (REST + WebSocket) directly from the browser. The repo also includes an **optional** Express backend in `backend/` for secure exchange integrations (requires PostgreSQL + Supabase) and an optional Netlify serverless function for AI suggestions. No API keys or secrets are required for the core frontend.

### Services

| Service | How to run | Default URL | Required? |
|---|---|---|---|
| Netlify Dev (proxy + serverless functions) | `npm run dev` | `http://localhost:3999` | Recommended — wraps Vite + serves `/api/ai/suggest` |
| Vite Dev Server (UI only) | `npm run dev:vite` | `http://localhost:5173` | Alternative — frontend only, no serverless |
| Backend (Express) | `cd backend && npm install && npm run dev` | `http://localhost:8787` | Optional — exchange integrations only |

**Note:** `npm run dev` runs `netlify dev`, which requires the Netlify CLI to be installed globally (`npm install -g netlify-cli`). It proxies Vite on port 5173 and serves on port 3999. Use `npm run dev:vite` if you only need the UI.

### Key commands

See `package.json` scripts:

- **Dev server (recommended):** `npm run dev` (Netlify Dev on port 3999)
- **Dev server (UI only):** `npm run dev:vite` (Vite on port 5173)
- **Build (tsc + vite):** `npm run build`
- **Lint:** `npm run lint`
- **Preview prod build:** `npm run preview`

### Caveats

- **ESLint config missing:** The repo declares ESLint 9 as a dev dependency but does not include an `eslint.config.js` (required by ESLint v9). Running `npm run lint` will fail until this config is added.
- **No automated tests:** The project has no test framework or test files. Validate changes via `npm run build` (TypeScript type-checking + production build) and manual browser testing.
- The app uses `import.meta.env.DEV` (built-in Vite flag) only — no custom `.env` files are needed for the core frontend.
- **Vite `allowedHosts`:** `vite.config.ts` sets `server.allowedHosts: true` so the dev server works behind the Cursor Cloud VM proxy. Without this, Vite blocks the proxied hostname with a "Blocked request" error.
- **CORS errors in console:** The app tries to call the Bybit REST API directly from the browser, which is blocked by CORS in some environments. It falls back to mock data gracefully — this is expected behavior.
- **Netlify CLI required:** `npm run dev` invokes `netlify dev`. If the CLI is not installed globally, this command will fail. Install with `npm install -g netlify-cli`.
