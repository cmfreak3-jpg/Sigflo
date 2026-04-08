import { Pool } from 'pg';
import { env } from '../config/env.js';

/**
 * Node `pg` often hits "self-signed certificate in certificate chain" against hosted Postgres
 * (Supabase pooler, proxies, etc.) when `rejectUnauthorized` defaults to true.
 *
 * - Localhost Postgres: no `ssl` object (typical dev).
 * - Remote URLs: default `rejectUnauthorized: false` unless `DATABASE_SSL_REJECT_UNAUTHORIZED=true`.
 */
function pgSslOption(): { rejectUnauthorized: boolean } | undefined {
  const url = env.DATABASE_URL;
  const flag = env.DATABASE_SSL_REJECT_UNAUTHORIZED?.trim().toLowerCase();
  if (flag === 'true' || flag === '1') {
    return { rejectUnauthorized: true };
  }
  if (flag === 'false' || flag === '0') {
    return { rejectUnauthorized: false };
  }

  const looksLocal = /(^|@)(localhost|127\.0\.0\.1)(:|\/)/.test(url);
  if (looksLocal && !url.includes('sslmode=require') && !url.includes('sslmode=verify-full')) {
    return undefined;
  }

  return { rejectUnauthorized: false };
}

const ssl = pgSslOption();

export const db = new Pool({
  connectionString: env.DATABASE_URL,
  ...(ssl ? { ssl } : {}),
});
