import { Router } from 'express';
import { z } from 'zod';
import type { AuthedRequest } from '../middleware/auth.js';
import { getAdapter } from '../exchanges/registry.js';
import type { ExchangeId } from '../exchanges/types.js';
import { log } from '../lib/logger.js';
import { formatZodIssuesForApi } from '../lib/formatZodError.js';
import { encryptText } from '../security/crypto.js';
import { deleteIntegration, insertAuditEvent, listIntegrations, upsertIntegration } from '../repositories/integrationsRepo.js';

const connectBodySchema = z.object({
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
  passphrase: z.string().optional(),
});

const exchanges: ExchangeId[] = ['bybit', 'mexc'];

export const integrationsRouter = Router();

for (const exchange of exchanges) {
  integrationsRouter.post(`/${exchange}/connect`, async (req: AuthedRequest, res) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const parsed = connectBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: formatZodIssuesForApi(parsed.error.issues) });
      return;
    }
    const adapter = getAdapter(exchange);
    try {
      const validation = await adapter.validateReadOnly(parsed.data);
      if (!validation.ok) {
        await insertAuditEvent({
          userId: req.user.userId,
          exchange,
          eventType: 'validate_fail',
          detail: validation.message,
        });
        res.status(400).json({ error: validation.message });
        return;
      }
      const saved = await upsertIntegration({
        userId: req.user.userId,
        exchange,
        encryptedKey: encryptText(parsed.data.apiKey),
        encryptedSecret: encryptText(parsed.data.apiSecret),
        encryptedPassphrase: parsed.data.passphrase ? encryptText(parsed.data.passphrase) : null,
        status: 'connected',
      });
      await insertAuditEvent({
        userId: req.user.userId,
        exchange,
        eventType: 'connect',
        detail: validation.message,
      });
      res.json({
        id: saved.id,
        exchange: saved.exchange,
        status: saved.status,
        lastValidatedAt: saved.lastValidatedAt,
      });
    } catch (error) {
      log('warn', 'Integration connect failed.', { exchange, error: String(error) });
      const fallback = 'Connection failed. Check key/secret and permissions.';
      const message =
        error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
      res.status(400).json({ error: message });
    }
  });
}

integrationsRouter.get('/', async (req: AuthedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const rows = await listIntegrations(req.user.userId);
  res.json(
    rows.map((row) => ({
      id: row.id,
      exchange: row.exchange,
      status: row.status,
      lastValidatedAt: row.lastValidatedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
  );
});

integrationsRouter.delete('/:exchange', async (req: AuthedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const exchange = req.params.exchange as ExchangeId;
  if (!exchanges.includes(exchange)) {
    res.status(404).json({ error: 'Exchange not supported.' });
    return;
  }
  await deleteIntegration(req.user.userId, exchange);
  await insertAuditEvent({
    userId: req.user.userId,
    exchange,
    eventType: 'disconnect',
    detail: 'Disconnected integration.',
  });
  res.status(204).end();
});
