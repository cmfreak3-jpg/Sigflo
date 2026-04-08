import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.coerce.number().default(8787),
  /** Comma-separated frontend origins allowed by CORS. */
  FRONTEND_ORIGIN: z.string().default('http://localhost:3999'),
  DATABASE_URL: z.string().min(1),
  /**
   * Optional override for pg TLS: `true` / `1` = verify chain; `false` / `0` = skip verify.
   * If unset, `db/index.ts` defaults: relaxed verify for Supabase hosts, strict for most others.
   */
  DATABASE_SSL_REJECT_UNAUTHORIZED: z.string().optional(),
  /** Supabase project URL, e.g. https://xxxx.supabase.co (used for JWKS + issuer). */
  SUPABASE_URL: z.string().url().optional(),
  /** Supabase project JWT secret (Settings → API → JWT Secret). Used to verify access tokens. */
  SUPABASE_JWT_SECRET: z.string().min(1).optional(),
  CREDENTIAL_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
});

export const env = envSchema.parse(process.env);
