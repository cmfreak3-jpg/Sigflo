/**
 * Netlify Dev runs functions in a separate process; it loads `.env` but not always `.env.local`.
 * Vite's `loadEnv` never runs for `/api/ai/*` because redirects send those paths to functions first.
 * Merge root `.env.local` / `.env` / `backend/.env` into `process.env` only for keys not already set.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseEnvFile(text) {
  for (const line of text.split(/\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

let didLoad = false;

export function ensureRootEnvLoaded() {
  if (didLoad) return;
  didLoad = true;
  const root = resolve(__dirname, '../../..');
  const candidates = [
    resolve(root, '.env.local'),
    resolve(root, '.env'),
    resolve(root, 'backend', '.env'),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try {
      parseEnvFile(readFileSync(p, 'utf8'));
    } catch {
      /* ignore unreadable env files */
    }
  }
}
