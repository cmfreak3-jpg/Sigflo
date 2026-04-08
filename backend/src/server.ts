import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { requireAuth } from './middleware/auth.js';
import { integrationsRouter } from './routes/integrations.js';
import { portfolioRouter } from './routes/portfolio.js';
import { tradeRouter } from './routes/trade.js';
import { log } from './lib/logger.js';

const app = express();
const allowedOrigins = env.FRONTEND_ORIGIN.split(',')
  .map((v) => v.trim())
  .filter(Boolean);

// Railway/Netlify sit behind a reverse proxy and set X-Forwarded-* headers.
// express-rate-limit requires trust proxy to be enabled in that topology.
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Non-browser requests (curl, health probes) may not send Origin.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  }),
);
app.use(express.json({ limit: '200kb' }));

app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/integrations', requireAuth, integrationsRouter);
app.use('/api/portfolio', requireAuth, portfolioRouter);
app.use('/api/trade', requireAuth, tradeRouter);

function serializeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { error: String(error) };
  const out: Record<string, unknown> = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause !== undefined) out.cause = serializeError(cause);
  if (error instanceof AggregateError) {
    out.errors = error.errors.map((item) => serializeError(item));
  }
  return out;
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log('error', 'Unhandled API error.', serializeError(err));
  res.status(500).json({ error: 'Internal server error' });
});

const host = process.env.HOST ?? '0.0.0.0';
app.listen(env.PORT, host, () => {
  log('info', `Backend listening on ${host}:${env.PORT}`);
});
