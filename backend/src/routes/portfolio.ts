import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { listIntegrations } from '../repositories/integrationsRepo.js';
import { decryptText } from '../security/crypto.js';
import { getAdapter } from '../exchanges/registry.js';
import { log } from '../lib/logger.js';
import type { ClosedTradeItem, ExchangeId } from '../exchanges/types.js';

type ClosedTradeRow = ClosedTradeItem & { exchange: ExchangeId };

/** Avoid flooding logs when the SPA polls every ~12s with the same Bybit 403. */
const lastWarnAt = new Map<string, number>();
const WARN_THROTTLE_MS = 60_000;

function logPortfolioWarnThrottled(key: string, message: string, meta: Record<string, unknown>) {
  const now = Date.now();
  const prev = lastWarnAt.get(key) ?? 0;
  if (now - prev < WARN_THROTTLE_MS) return;
  lastWarnAt.set(key, now);
  log('warn', message, meta);
}

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
        const msg = error instanceof Error ? error.message : String(error);
        logPortfolioWarnThrottled(
          `snap:${integration.exchange}:${msg.slice(0, 120)}`,
          'Portfolio snapshot failed.',
          { exchange: integration.exchange, error: msg },
        );
        return {
          exchange: integration.exchange,
          status: 'error',
          balances: [],
          positions: [],
          accountBreakdown: null,
          syncError: msg,
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
      const msg = error instanceof Error ? error.message : String(error);
      logPortfolioWarnThrottled(
        `closed:${integration.exchange}:${msg.slice(0, 120)}`,
        'Closed trades fetch failed.',
        { exchange: integration.exchange, error: msg },
      );
    }
  }

  merged.sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
  res.json({ trades: merged.slice(0, 100) });
});
