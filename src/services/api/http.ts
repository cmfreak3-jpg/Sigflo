import { supabase } from '@/lib/supabase';

/**
 * Backend mounts integrations and portfolio under `/api/...` (see backend `server.ts`).
 * Must end with `/api` (no trailing slash). Common mistake: `http://localhost:8787` → 404 on `/integrations/...`.
 */
function resolveApiBase(): string {
  const raw = import.meta.env.VITE_BACKEND_API_BASE?.trim();
  if (raw) {
    const base = raw.replace(/\/+$/, '');
    if (/^https?:\/\/[^/]+$/i.test(base)) {
      return `${base}/api`;
    }
    return base;
  }
  if (import.meta.env.DEV) {
    return '/api';
  }
  return 'http://localhost:8787/api';
}

const API_BASE = resolveApiBase();
const DEV_USER_ID = import.meta.env.VITE_DEV_USER_ID?.trim();

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  if (!headers.Authorization && DEV_USER_ID) {
    headers['x-user-id'] = DEV_USER_ID;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
