import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.coerce.number().default(8787),
  /**
   * Comma-separated frontend origins allowed by CORS.
   * Empty / unset uses a safe dev default so Railway env typos do not yield zero origins (browser CORS fails for all routes).
   */
  FRONTEND_ORIGIN: z
    .string()
    .optional()
    .transform((v) => (v == null || v.trim() === '' ? 'http://localhost:3999' : v.trim())),
  DATABASE_URL: z.string().min(1),
  /**
   * Optional override for pg TLS: `true` / `1` = verify chain; `false` / `0` = skip verify.
   * If unset, `db/index.ts` sets relaxed verify for remote hosts by default.
   */
  DATABASE_SSL_REJECT_UNAUTHORIZED: z.string().optional(),
  /** Supabase project URL, e.g. https://xxxx.supabase.co (used for JWKS + issuer). */
  SUPABASE_URL: z.string().url().optional(),
  /** Supabase project JWT secret (Settings → API → JWT Secret). Used to verify access tokens. */
  SUPABASE_JWT_SECRET: z.string().min(1).optional(),
  CREDENTIAL_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('[sigflo-backend] Invalid environment variables:');
  console.error(parsed.error.flatten());
  process.exit(1);
}

export const env = parsed.data;
