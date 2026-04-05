import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export default defineConfig(({ mode }) => {
  const envFromFiles = loadEnv(mode, __dirname, '');
  const devAiEnv = (): NodeJS.ProcessEnv => ({ ...process.env, ...envFromFiles });

  return {
    /** Production build for https://liminl.net/sigflo/ (SiteGround). Local dev stays at `/`. */
    base: mode === 'production' ? '/sigflo/' : '/',
    plugins: [
      {
        name: 'ai-suggest-dev',
        enforce: 'pre',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const pathname = req.url?.split('?')[0] ?? '';
            if (pathname !== '/api/ai/suggest') {
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
              const { runAiSuggest } = await import('./netlify/functions/lib/ai-suggest-core.mjs');
              const body = await readBody(req as IncomingMessage);
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
              out.end(JSON.stringify({ error: 'AI suggest handler failed' }));
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
      },
    },
  };
});
