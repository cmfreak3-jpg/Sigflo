import crypto from 'node:crypto';

export function signHmacSha256(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Parses JSON; on HTTP errors includes response body when present (Bybit often returns
 * `retCode` / `retMsg` even for 403 — plain `Request failed: 403` hides IP allowlist / key issues).
 */
export async function getJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  const res = await fetch(url, { method: 'GET', headers });
  const text = await res.text();
  if (!res.ok) {
    let detail = text.trim().slice(0, 400);
    try {
      const j = JSON.parse(text) as { retMsg?: string; retCode?: number; message?: string };
      if (j.retMsg != null) {
        detail = `retCode=${j.retCode ?? '?'} ${j.retMsg}`;
      } else if (j.message != null) {
        detail = String(j.message);
      }
    } catch {
      /* not JSON */
    }
    throw new Error(`Request failed: HTTP ${res.status}${detail ? ` — ${detail}` : ''}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON from ${url.slice(0, 80)}…`);
  }
}
