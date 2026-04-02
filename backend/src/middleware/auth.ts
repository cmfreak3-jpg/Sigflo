import type { Request, Response, NextFunction } from 'express';
import { jwtVerify } from 'jose';
import { env } from '../config/env.js';
import { log } from '../lib/logger.js';
import { upsertUser } from '../repositories/usersRepo.js';

export type UserContext = {
  userId: string;
  email?: string;
};

export type AuthedRequest = Request & {
  user?: UserContext;
};

function bearerToken(req: Request): string | null {
  const raw = req.header('authorization')?.trim();
  if (!raw?.toLowerCase().startsWith('bearer ')) return null;
  return raw.slice(7).trim() || null;
}

async function verifySupabaseJwt(token: string): Promise<{ sub: string; email?: string } | null> {
  if (!env.SUPABASE_JWT_SECRET) return null;
  try {
    const secret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    const sub = typeof payload.sub === 'string' ? payload.sub : null;
    if (!sub) return null;
    const email = typeof payload.email === 'string' ? payload.email : undefined;
    return { sub, email };
  } catch {
    return null;
  }
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const token = bearerToken(req);

    if (token && env.SUPABASE_JWT_SECRET) {
      const verified = await verifySupabaseJwt(token);
      if (!verified) {
        res.status(401).json({ error: 'Invalid or expired session.' });
        return;
      }
      const email = verified.email ?? `${verified.sub}@users.supabase`;
      await upsertUser(verified.sub, email);
      req.user = { userId: verified.sub, email: verified.email };
      next();
      return;
    }

    // Dev fallback when Supabase JWT secret is not configured (local only).
    if (!env.SUPABASE_JWT_SECRET && env.NODE_ENV !== 'production') {
      const userId = req.header('x-user-id')?.trim();
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const email = req.header('x-user-email')?.trim() || `${userId}@dev.local`;
      await upsertUser(userId, email);
      req.user = { userId, email: req.header('x-user-email')?.trim() };
      next();
      return;
    }

    log('warn', 'Auth rejected: missing bearer token.');
    res.status(401).json({ error: 'Sign in required.' });
  } catch (error) {
    next(error);
  }
}
