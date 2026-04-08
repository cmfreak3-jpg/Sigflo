/**
 * Join a path with Vite `base` so fetches work when the app is hosted under a subpath.
 * Netlify must define matching redirects (e.g. `/app/api/ai/suggest` → function).
 */
export function withAppBase(path: string): string {
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

/** Env override: absolute URL unchanged; relative paths get `base` prefix. */
export function resolveAppApiPath(override: string | undefined, defaultPath: string): string {
  const raw = override?.trim();
  if (!raw) return withAppBase(defaultPath);
  if (/^https?:\/\//i.test(raw)) return raw;
  return withAppBase(raw.startsWith('/') ? raw : `/${raw}`);
}
