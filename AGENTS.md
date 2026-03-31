# Sigflo – Agent Instructions

## Cursor Cloud specific instructions

### Overview

Sigflo is a frontend-only React + TypeScript + Vite SPA for crypto trading signals. There is **no backend** — all market data comes from Bybit public API (REST + WebSocket) directly from the browser. No API keys or secrets are required.

### Services

| Service | How to run | Default URL |
|---|---|---|
| Vite Dev Server | `npm run dev` | `http://localhost:5173` |

### Key commands

See `package.json` scripts:

- **Dev server:** `npm run dev`
- **Build (tsc + vite):** `npm run build`
- **Lint:** `npm run lint`
- **Preview prod build:** `npm run preview`

### Caveats

- **ESLint config missing:** The repo declares ESLint 9 as a dev dependency but does not include an `eslint.config.js` (required by ESLint v9). Running `npm run lint` will fail until this config is added.
- **No automated tests:** The project has no test framework or test files. Validate changes via `npm run build` (TypeScript type-checking + production build) and manual browser testing.
- The app uses `import.meta.env.DEV` (built-in Vite flag) only — no custom `.env` files are needed.
