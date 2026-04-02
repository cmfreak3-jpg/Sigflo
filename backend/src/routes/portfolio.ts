import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { listIntegrations } from '../repositories/integrationsRepo.js';
import { decryptText } from '../security/crypto.js';
import { getAdapter } from '../exchanges/registry.js';
import { log } from '../lib/logger.js';

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
        const [balances, positions] = await Promise.all([
          adapter.fetchBalances(creds),
          adapter.fetchPositions(creds),
        ]);
        return {
          exchange: integration.exchange,
          status: 'connected',
          balances,
          positions,
        };
      } catch (error) {
        log('warn', 'Portfolio snapshot failed.', { exchange: integration.exchange, error: String(error) });
        return {
          exchange: integration.exchange,
          status: 'error',
          balances: [],
          positions: [],
        };
      }
    }),
  );

  res.json({ exchanges: snapshots });
});
