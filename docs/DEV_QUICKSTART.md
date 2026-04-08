# Sigflo Dev Quickstart

## Run locally

Use two terminals:

1) Frontend + Netlify wrappers:

```bash
npm run dev
```

2) Backend API:

```bash
npm run dev:backend
```

Open:

- `http://localhost:3999/feed` (Netlify dev entrypoint)

## Key local env values

In `.env.local`:

- `VITE_BACKEND_API_BASE=http://127.0.0.1:8787`
- `VITE_SUPABASE_URL=...`
- `VITE_SUPABASE_ANON_KEY=...`

Notes:

- Do not omit `http://` or `https://` on API base values.
- For normal local dev, keep `VITE_BASE` unset unless specifically testing subpath deploy behavior.

## Backend CORS (local + prod)

Backend uses `FRONTEND_ORIGIN` from env and supports comma-separated origins.

Example:

```env
FRONTEND_ORIGIN=https://sigflo.group,https://sigflo.netlify.app,http://localhost:3999,http://localhost:5173
```

Where to set:

- Local backend: `backend/.env`
- Railway backend: service Variables

After changing env values, restart/redeploy backend.

## Common issues

### White/black screen at `/feed`

- Hard refresh (`Ctrl+Shift+R`), disable cache in DevTools, retry.
- Ensure `npm run dev` is running and `http://localhost:3999/feed` is used.

### `Last sync failed: Failed to fetch`

- Usually API base/CORS mismatch.
- Verify frontend points to a reachable backend.

### CORS error

- Ensure request origin is included in backend `FRONTEND_ORIGIN`.
- If using Railway, confirm latest backend code is deployed.

### `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`

- Backend must trust proxy when behind Railway/Netlify.
- This is handled in `backend/src/server.ts` with:
  - `app.set('trust proxy', 1);`

