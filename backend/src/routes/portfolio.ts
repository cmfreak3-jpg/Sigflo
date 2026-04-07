import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { listIntegrations } from '../repositories/integrationsRepo.js';
import { decryptText } from '../security/crypto.js';
import { getAdapter } from '../exchanges/registry.js';
import { log } from '../lib/logger.js';
import type { ClosedTradeItem, ExchangeId } from '../exchanges/types.js';

type ClosedTradeRow = ClosedTradeItem & { exchange: ExchangeId };

export const portfolioRouter = Router();

portfolioRouter.get('/accounts', async (req: AuthedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const integrations = await listIntegrations(req.user.userId);
  const snapshots = await Promise.all(
    integrations.map(async (integration) => {
      try {
        const adapter = getAdapter(integration.exchange);
        const creds = {
          apiKey: decryptText(integration.encryptedKey),
          apiSecret: decryptText(integration.encryptedSecret),
          passphrase: integration.encryptedPassphrase ? decryptText(integration.encryptedPassphrase) : undefined,
        };
        const [balances, positions, accountBreakdown] = await Promise.all([
          adapter.fetchBalances(creds),
          adapter.fetchPositions(creds),
          adapter.fetchAccountBreakdown ? adapter.fetchAccountBreakdown(creds) : Promise.resolve(null),
        ]);
        return {
          exchange: integration.exchange,
          status: 'connected',
          balances,
          positions,
          accountBreakdown,
        };
      } catch (error) {
        log('warn', 'Portfolio snapshot failed.', { exchange: integration.exchange, error: String(error) });
        return {
          exchange: integration.exchange,
          status: 'error',
          balances: [],
          positions: [],
          accountBreakdown: null,
        };
      }
    }),
  );

  res.json({ exchanges: snapshots });
});

portfolioRouter.get('/closed-trades', async (req: AuthedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const integrations = await listIntegrations(req.user.userId);
  const merged: ClosedTradeRow[] = [];

  for (const integration of integrations) {
    try {
      const adapter = getAdapter(integration.exchange);
      const creds = {
        apiKey: decryptText(integration.encryptedKey),
        apiSecret: decryptText(integration.encryptedSecret),
        passphrase: integration.encryptedPassphrase ? decryptText(integration.encryptedPassphrase) : undefined,
      };
      const rows = await adapter.fetchClosedTrades(creds, { limit: 50 });
      for (const row of rows) {
        merged.push({ ...row, exchange: integration.exchange });
      }
    } catch (error) {
      log('warn', 'Closed trades fetch failed.', { exchange: integration.exchange, error: String(error) });
    }
  }

  merged.sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
  res.json({ trades: merged.slice(0, 100) });
});
