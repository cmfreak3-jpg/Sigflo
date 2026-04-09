import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Merge keys missing from `into` (e.g. OPENAI_API_KEY only in `backend/.env`). */
function mergeDotenvFile(filePath: string, into: Record<string, string>) {
  if (!existsSync(filePath)) return;
  try {
    const text = readFileSync(filePath, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && into[key] === undefined) into[key] = val;
    }
  } catch {
    /* ignore */
  }
}

/**
 * Vite `loadEnv(..., '')` ends by copying `process.env` over parsed files, so an empty
 * `OPENAI_API_KEY` in the OS environment wins over `.env.local` → OpenAI sees `Bearer ` (invalid).
 * Re-read these keys from disk in normal precedence (later files override).
 */
const AI_ENV_KEYS = new Set([
  'OPENAI_API_KEY',
  'AI_API_KEY',
  'OPENAI_API_ENDPOINT',
  'AI_ENDPOINT',
  'OPENAI_MODEL',
  'AI_MODEL',
  'NEWS_RSS_FEEDS',
]);

function mergeDotenvWhitelistOverwrite(filePath: string, into: Record<string, string>, allowed: Set<string>) {
  if (!existsSync(filePath)) return;
  try {
    const text = readFileSync(filePath, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!key || !allowed.has(key)) continue;
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      into[key] = val;
    }
  } catch {
    /* ignore */
  }
}

function loadAiSecretsFromDisk(mode: string, rootDir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const chain = [
    path.join(rootDir, 'backend', '.env'),
    path.join(rootDir, '.env'),
    path.join(rootDir, '.env.local'),
    path.join(rootDir, `.env.${mode}`),
    path.join(rootDir, `.env.${mode}.local`),
  ];
  for (const p of chain) {
    mergeDotenvWhitelistOverwrite(p, out, AI_ENV_KEYS);
  }
  return out;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export default defineConfig(({ mode }) => {
  const envFromFiles = { ...loadEnv(mode, __dirname, '') };
  mergeDotenvFile(path.join(__dirname, 'backend', '.env'), envFromFiles);
  const aiSecretsFromDisk = loadAiSecretsFromDisk(mode, __dirname);
  const devAiEnv = (): NodeJS.ProcessEnv => ({ ...process.env, ...envFromFiles, ...aiSecretsFromDisk });

  const baseFromEnv = envFromFiles.VITE_BASE?.trim();
  const resolvedBase =
    baseFromEnv && baseFromEnv !== '/'
      ? baseFromEnv.endsWith('/')
        ? baseFromEnv
        : `${baseFromEnv}/`
      : '/';

  return {
    /** Set `VITE_BASE=/your/subpath/` when hosting under a subfolder (avoids blank screen from 404 JS/CSS). */
    base: resolvedBase,
    plugins: [
      {
        name: 'ai-suggest-dev',
        enforce: 'pre',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const pathname = req.url?.split('?')[0] ?? '';
            if (pathname !== '/api/ai/suggest' && pathname !== '/api/ai/news-scan') {
              next();
              return;
            }

            const out = res as ServerResponse;
            if (req.method === 'OPTIONS') {
              out.statusCode = 204;
              out.end();
              return;
            }
            if (req.method !== 'POST') {
              out.statusCode = 405;
              out.setHeader('Content-Type', 'application/json');
              out.end(JSON.stringify({ error: 'Method not allowed' }));
              return;
            }

            try {
              const body = await readBody(req as IncomingMessage);
              if (pathname === '/api/ai/news-scan') {
                // Netlify ESM helper — no .d.ts; keep dev parity with production function.
                const { runMarketNewsScan } = (await import(
                  // @ts-expect-error TS7016 — untyped .mjs Netlify module
                  './netlify/functions/lib/market-news-scan-core.mjs'
                )) as {
                  runMarketNewsScan: (rawBody: string, env: NodeJS.ProcessEnv) => Promise<unknown>;
                };
                const result = await runMarketNewsScan(body, devAiEnv());
                out.setHeader('Content-Type', 'application/json');
                out.statusCode = 200;
                out.end(JSON.stringify(result));
                return;
              }
              const { runAiSuggest } = await import('./netlify/functions/lib/ai-suggest-core.mjs');
              const result = await runAiSuggest(body, devAiEnv());
              out.setHeader('Content-Type', 'application/json');
              if ('error' in result) {
                out.statusCode = 400;
                out.end(JSON.stringify({ error: result.error }));
              } else {
                out.statusCode = 200;
                out.end(JSON.stringify(result));
              }
            } catch {
              out.statusCode = 500;
              out.setHeader('Content-Type', 'application/json');
              out.end(JSON.stringify({ error: 'AI handler failed' }));
            }
          });
        },
      },
      react(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      allowedHosts: true,
      // Only proxy backend routes. `/api/ai/suggest` is handled above (and by Netlify in production).
      proxy: {
        '/api/integrations': { target: 'http://127.0.0.1:8787', changeOrigin: true },
        '/api/portfolio': { target: 'http://127.0.0.1:8787', changeOrigin: true },
        '/api/trade': { target: 'http://127.0.0.1:8787', changeOrigin: true },
      },
    },
  };
});
