import { Pool } from 'pg';
import { env } from '../config/env.js';

/**
 * Node `pg` + Supabase pooler often throws "self-signed certificate in certificate chain"
 * unless `rejectUnauthorized` is false. Default that for Supabase URLs; allow override via env.
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

  if (url.includes('supabase.co') || url.includes('pooler.supabase.com')) {
    return { rejectUnauthorized: false };
  }

  return { rejectUnauthorized: true };
}

const ssl = pgSslOption();

export const db = new Pool({
  connectionString: env.DATABASE_URL,
  ...(ssl ? { ssl } : {}),
});
