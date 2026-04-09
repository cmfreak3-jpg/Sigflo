import { supabase } from '@/lib/supabase';
import { sanitizeUserFacingHttpErrorMessage } from '@/lib/httpErrorMessage';

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
  /** Same-origin `/api` — Vite dev proxy, Netlify/Vercel rewrites, or reverse proxy to the Express backend. */
  return '/api';
}

const API_BASE = resolveApiBase();
const DEV_USER_ID = import.meta.env.VITE_DEV_USER_ID?.trim();

function looksLikeHtmlPayload(s: string): boolean {
  const t = s.trim();
  if (t.length === 0) return false;
  if (/^<\s*!doctype/i.test(t) || /^<\s*html/i.test(t)) return true;
  if (t.includes('<!DOCTYPE') || t.includes('<!doctype')) return true;
  if (t.includes('CloudFront') && t.includes('could not be satisfied')) return true;
  if (t.includes('<HTML') || t.includes('<html')) return true;
  return false;
}

function cdnBlockedMessage(status: number): string {
  return `HTTP ${status} — CDN blocked this request (e.g. CloudFront/WAF) before your API. Fix: set Netlify (or build) env VITE_BACKEND_API_BASE to your API origin (e.g. https://YOUR-SERVICE.up.railway.app with no /api suffix), redeploy, and ensure that host does not return HTML for /api/* — or proxy /api on the same domain as the SPA.`;
}

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
    const ct = res.headers.get('content-type') ?? '';
    let message = `Request failed: HTTP ${res.status}`;
    try {
      if (ct.includes('application/json')) {
        const body = (await res.json()) as { error?: string; message?: string };
        const errText = typeof body.error === 'string' ? body.error : typeof body.message === 'string' ? body.message : '';
        if (errText) {
          message = looksLikeHtmlPayload(errText) ? cdnBlockedMessage(res.status) : errText;
        }
      } else {
        const text = await res.text();
        const trimmed = text.trim();
        if (looksLikeHtmlPayload(trimmed)) {
          message = cdnBlockedMessage(res.status);
        } else if (trimmed.length > 0 && trimmed.length < 400) {
          message = `Request failed: HTTP ${res.status} — ${trimmed}`;
        }
      }
    } catch {
      // keep default message
    }
    throw new Error(sanitizeUserFacingHttpErrorMessage(message));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
