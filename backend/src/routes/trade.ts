import { Router } from 'express';
import { z } from 'zod';
import type { AuthedRequest } from '../middleware/auth.js';
import { BybitAdapter } from '../exchanges/bybit.js';
import { decryptText } from '../security/crypto.js';
import { listIntegrations } from '../repositories/integrationsRepo.js';
import { log } from '../lib/logger.js';
import { formatZodIssuesForApi } from '../lib/formatZodError.js';

export const tradeRouter = Router();

const linearOrderSchema = z.object({
  symbol: z.string().min(4).max(32),
  side: z.enum(['Buy', 'Sell']),
  orderType: z.enum(['Market', 'Limit']).default('Market'),
  qty: z.string().min(1).max(64),
  reduceOnly: z.boolean().optional(),
  price: z.string().optional(),
  positionIdx: z.number().int().min(0).max(2).optional(),
  /** Applied via `/v5/position/set-leverage` before the order (best effort). */
  leverage: z.number().min(1).max(125).optional(),
  /** Bybit linear TP/SL on open (market exit when hit). Requires valid side vs entry on exchange. */
  takeProfit: z.string().min(1).max(48).optional(),
  stopLoss: z.string().min(1).max(48).optional(),
});

const spotOrderSchema = z.object({
  symbol: z.string().min(4).max(32),
  side: z.enum(['Buy', 'Sell']),
  orderType: z.enum(['Market', 'Limit']).default('Market'),
  qty: z.string().min(1).max(64),
  marketUnit: z.enum(['baseCoin', 'quoteCoin']),
  price: z.string().optional(),
});

const bybitAdapter = new BybitAdapter();

tradeRouter.post('/bybit/linear-order', async (req: AuthedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsed = linearOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodIssuesForApi(parsed.error.issues) });
    return;
  }

  const integrations = await listIntegrations(req.user.userId);
  const row = integrations.find((i) => i.exchange === 'bybit');
  if (!row) {
    res.status(400).json({ error: 'Connect Bybit in Account first.' });
    return;
  }

  const creds = {
    apiKey: decryptText(row.encryptedKey),
    apiSecret: decryptText(row.encryptedSecret),
    passphrase: row.encryptedPassphrase ? decryptText(row.encryptedPassphrase) : undefined,
  };

  try {
    await bybitAdapter.ensureTradeEnabled(creds);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Trade not allowed for this key.';
    res.status(403).json({ error: msg });
    return;
  }

  const p = parsed.data;
  try {
    if (p.leverage != null && Number.isFinite(p.leverage)) {
      try {
        await bybitAdapter.setLinearLeverage(creds, p.symbol, p.leverage);
      } catch (levErr) {
        log('warn', 'Bybit set-leverage skipped or failed.', {
          symbol: p.symbol,
          error: String(levErr),
        });
      }
    }

    const result = await bybitAdapter.placeLinearOrder(creds, {
      symbol: p.symbol,
      side: p.side,
      orderType: p.orderType,
      qty: p.qty.trim(),
      reduceOnly: p.reduceOnly,
      price: p.price?.trim(),
      positionIdx: p.positionIdx,
      takeProfit: p.takeProfit?.trim(),
      stopLoss: p.stopLoss?.trim(),
    });

    const tpSlNote =
      p.takeProfit || p.stopLoss
        ? ' TP/SL sent with the order (Full, market trigger) — confirm on Bybit.'
        : '';
    res.json({
      ok: true,
      exchange: 'bybit',
      orderId: result.orderId,
      orderLinkId: result.orderLinkId ?? null,
      note: `Order accepted by Bybit — confirm fill and position via portfolio sync.${tpSlNote}`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Order failed';
    log('warn', 'Bybit order failed.', { error: msg });
    res.status(400).json({ error: msg });
  }
});

const linearTradingStopSchema = z.object({
  symbol: z.string().min(4).max(32),
  positionIdx: z.number().int().min(0).max(2).default(0),
  /** Use `"0"` to clear TP on the position (Bybit convention). */
  takeProfit: z.string().min(1).max(48),
  /** Use `"0"` to clear SL on the position (Bybit convention). */
  stopLoss: z.string().min(1).max(48),
});

tradeRouter.post('/bybit/linear-trading-stop', async (req: AuthedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsed = linearTradingStopSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodIssuesForApi(parsed.error.issues) });
    return;
  }

  const integrations = await listIntegrations(req.user.userId);
  const row = integrations.find((i) => i.exchange === 'bybit');
  if (!row) {
    res.status(400).json({ error: 'Connect Bybit in Account first.' });
    return;
  }

  const creds = {
    apiKey: decryptText(row.encryptedKey),
    apiSecret: decryptText(row.encryptedSecret),
    passphrase: row.encryptedPassphrase ? decryptText(row.encryptedPassphrase) : undefined,
  };

  try {
    await bybitAdapter.ensureTradeEnabled(creds);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Trade not allowed for this key.';
    res.status(403).json({ error: msg });
    return;
  }

  const p = parsed.data;
  try {
    await bybitAdapter.setLinearTradingStop(creds, {
      symbol: p.symbol,
      positionIdx: p.positionIdx,
      takeProfit: p.takeProfit.trim(),
      stopLoss: p.stopLoss.trim(),
    });
    res.json({
      ok: true,
      exchange: 'bybit',
      note: 'TP/SL updated on Bybit (full position, market trigger) — confirm on the exchange.',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Trading stop failed';
    log('warn', 'Bybit trading-stop failed.', { error: msg });
    res.status(400).json({ error: msg });
  }
});

tradeRouter.post('/bybit/spot-order', async (req: AuthedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsed = spotOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodIssuesForApi(parsed.error.issues) });
    return;
  }

  const integrations = await listIntegrations(req.user.userId);
  const row = integrations.find((i) => i.exchange === 'bybit');
  if (!row) {
    res.status(400).json({ error: 'Connect Bybit in Account first.' });
    return;
  }

  const creds = {
    apiKey: decryptText(row.encryptedKey),
    apiSecret: decryptText(row.encryptedSecret),
    passphrase: row.encryptedPassphrase ? decryptText(row.encryptedPassphrase) : undefined,
  };

  try {
    await bybitAdapter.ensureTradeEnabled(creds);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Trade not allowed for this key.';
    res.status(403).json({ error: msg });
    return;
  }

  const p = parsed.data;
  try {
    const result = await bybitAdapter.placeSpotOrder(creds, {
      symbol: p.symbol,
      side: p.side,
      orderType: p.orderType,
      qty: p.qty.trim(),
      marketUnit: p.marketUnit,
      price: p.price?.trim(),
    });

    res.json({
      ok: true,
      exchange: 'bybit',
      orderId: result.orderId,
      orderLinkId: result.orderLinkId ?? null,
      note: 'Spot order accepted by Bybit — confirm fill via portfolio sync.',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Order failed';
    log('warn', 'Bybit spot order failed.', { error: msg });
    res.status(400).json({ error: msg });
  }
});
