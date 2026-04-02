import crypto from 'node:crypto';

export function signHmacSha256(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export async function getJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return (await res.json()) as T;
}
