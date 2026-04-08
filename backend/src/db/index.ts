import { Pool } from 'pg';
import { env } from '../config/env.js';

/**
 * `pg` merges `parse(connectionString)` *after* your Pool options. If the URL contains
 * `sslmode=require`, pg-connection-string sets `ssl: {}`, which overwrites an explicit
 * `ssl: { rejectUnauthorized: false }` and restores default TLS verification — causing
 * "self-signed certificate in certificate chain" against Supabase/Railway poolers.
 * Strip `sslmode` from the URL and set TLS via our `ssl` option only.
 */
function stripSslQueryParams(connectionString: string): string {
  try {
    const u = new URL(connectionString, 'postgres://localhost');
    u.searchParams.delete('sslmode');
    u.searchParams.delete('ssl');
    return u.toString();
  } catch {
    return connectionString;
  }
}

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
const connectionString = stripSslQueryParams(env.DATABASE_URL);

export const db = new Pool({
  connectionString,
  ...(ssl ? { ssl } : {}),
});
