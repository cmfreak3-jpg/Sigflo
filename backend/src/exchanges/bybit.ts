import { getJson, signHmacSha256 } from './http.js';
import type {
  BalanceItem,
  ClosedTradeItem,
  ConnectInput,
  ExchangeAdapter,
  PermissionCheck,
  PositionItem,
  ValidationResult,
} from './types.js';

const BASE_URL = 'https://api.bybit.com';
/** Bybit allows up to 60_000 ms; larger window absorbs client–server clock skew (NTP drift). */
const RECV_WINDOW = '60000';

type BybitResponse<T> = {
  retCode: number;
  retMsg: string;
  result: T;
};

function buildSignedHeaders(apiKey: string, apiSecret: string, queryString: string) {
  const timestamp = String(Date.now());
  const signaturePayload = `${timestamp}${apiKey}${RECV_WINDOW}${queryString}`;
  const signature = signHmacSha256(apiSecret, signaturePayload);
  return {
    'X-BAPI-API-KEY': apiKey,
    'X-BAPI-TIMESTAMP': timestamp,
    'X-BAPI-RECV-WINDOW': RECV_WINDOW,
    'X-BAPI-SIGN': signature,
  };
}

async function privateGet<T>(path: string, params: Record<string, string>, creds: ConnectInput): Promise<T> {
  const queryString = new URLSearchParams(params).toString();
  const headers = buildSignedHeaders(creds.apiKey, creds.apiSecret, queryString);
  const data = await getJson<BybitResponse<T>>(`${BASE_URL}${path}?${queryString}`, headers);
  if (data.retCode !== 0) {
    throw new Error(`Bybit error: ${data.retMsg}`);
  }
  return data.result;
}

function parsePermission(raw: unknown): PermissionCheck {
  const text = JSON.stringify(raw).toLowerCase();
  const canReadBalances = text.includes('wallet') || text.includes('read');
  const canReadPositions = text.includes('position') || text.includes('read');
  const withdrawalsEnabled = text.includes('withdraw') && !text.includes('disable');
  const readOnly = canReadBalances || canReadPositions;
  return { readOnly, withdrawalsEnabled, canReadBalances, canReadPositions, raw };
}

export class BybitAdapter implements ExchangeAdapter {
  readonly id = 'bybit' as const;

  async validateReadOnly(input: ConnectInput): Promise<ValidationResult> {
    const result = await privateGet<Record<string, unknown>>('/v5/user/query-api', {}, input);
    const permission = parsePermission(result);
    if (!permission.readOnly) {
      return { ok: false, message: 'Missing read permissions for key.', permission };
    }
    if (permission.withdrawalsEnabled) {
      return { ok: false, message: 'Withdrawals must be disabled for this integration.', permission };
    }
    return { ok: true, message: 'Bybit key validated as read-only.', permission };
  }

  async fetchBalances(input: ConnectInput): Promise<BalanceItem[]> {
    const result = await privateGet<{ list?: Array<{ coin?: Array<{ coin: string; walletBalance: string; locked?: string }> }> }>(
      '/v5/account/wallet-balance',
      { accountType: 'UNIFIED' },
      input,
    );
    const coins = result.list?.flatMap((entry) => entry.coin ?? []) ?? [];
    return coins
      .map((coin) => {
        const total = Number(coin.walletBalance ?? 0);
        const locked = Number(coin.locked ?? 0);
        return {
          asset: coin.coin,
          free: Math.max(0, total - locked),
          locked,
          total,
        };
      })
      .filter((b) => b.total > 0);
  }

  async fetchPositions(input: ConnectInput): Promise<PositionItem[]> {
    const result = await privateGet<{ list?: Array<{ symbol: string; side: string; size: string; avgPrice: string; markPrice?: string; unrealisedPnl?: string }> }>(
      '/v5/position/list',
      { category: 'linear', settleCoin: 'USDT' },
      input,
    );
    return (result.list ?? [])
      .map((p) => ({
        symbol: p.symbol,
        side: (String(p.side).toLowerCase() === 'sell' ? 'short' : 'long') as 'short' | 'long',
        size: Number(p.size ?? 0),
        entryPrice: Number(p.avgPrice ?? 0),
        markPrice: Number(p.markPrice ?? 0),
        unrealizedPnl: Number(p.unrealisedPnl ?? 0),
      }))
      .filter((p) => p.size > 0);
  }

  async fetchClosedTrades(input: ConnectInput, opts?: { limit?: number }): Promise<ClosedTradeItem[]> {
    const lim = Math.min(100, Math.max(1, opts?.limit ?? 50));
    const result = await privateGet<{
      list?: Array<{ symbol: string; closedPnl: string; updatedTime: string; orderId?: string }>;
    }>('/v5/position/closed-pnl', { category: 'linear', limit: String(lim) }, input);
    const rows = result.list ?? [];
    return rows
      .map((r) => {
        const ms = Number(r.updatedTime);
        const closedAt = Number.isFinite(ms) ? new Date(ms).toISOString() : new Date(0).toISOString();
        return {
          symbol: r.symbol,
          closedPnl: Number(r.closedPnl ?? 0),
          closedAt,
          orderId: r.orderId,
        };
      })
      .sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
  }
}
