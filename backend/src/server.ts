import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { requireAuth } from './middleware/auth.js';
import { integrationsRouter } from './routes/integrations.js';
import { portfolioRouter } from './routes/portfolio.js';
import { log } from './lib/logger.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_ORIGIN }));
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

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log('error', 'Unhandled API error.', { error: String(err) });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(env.PORT, () => {
  log('info', `Backend listening on :${env.PORT}`);
});
