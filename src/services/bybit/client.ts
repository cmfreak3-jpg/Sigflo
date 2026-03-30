import type { Candle, KlineInterval, SymbolTicker, SymbolUniverseItem } from '@/types/market';

const BASE = 'https://api.bybit.com';

type BybitResp<T> = { retCode: number; retMsg: string; result: T };

function toNum(v: string | number | undefined): number {
  if (v === undefined) return 0;
  return typeof v === 'number' ? v : Number(v);
}

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`Bybit HTTP ${r.status}`);
  return (await r.json()) as T;
}

export async function fetchTradablePerpSymbols(): Promise<string[]> {
  const data = await getJson<BybitResp<{ list: Array<{ symbol: string; status: string; quoteCoin: string }> }>>(
    '/v5/market/instruments-info?category=linear&limit=1000',
  );
  if (data.retCode !== 0) throw new Error(data.retMsg || 'Bybit instruments failed');
  return data.result.list
    .filter((x) => x.status === 'Trading' && x.quoteCoin === 'USDT')
    .map((x) => x.symbol);
}

export async function fetchTickers(symbols?: string[]): Promise<SymbolTicker[]> {
  const data = await getJson<BybitResp<{ list: Array<Record<string, string>> }>>('/v5/market/tickers?category=linear');
  if (data.retCode !== 0) throw new Error(data.retMsg || 'Bybit tickers failed');
  const symbolSet = symbols ? new Set(symbols) : undefined;
  return data.result.list
    .filter((x) => (symbolSet ? symbolSet.has(String(x.symbol ?? '')) : true))
    .map((x) => ({
      symbol: String(x.symbol ?? ''),
      lastPrice: toNum(x.lastPrice),
      high24h: toNum(x.highPrice24h),
      low24h: toNum(x.lowPrice24h),
      volume24h: toNum(x.volume24h),
      turnover24h: toNum(x.turnover24h),
      price24hPcnt: toNum(x.price24hPcnt),
    }));
}

export function rankLiquidUniverse(tickers: SymbolTicker[], minCount: number, maxCount: number): SymbolUniverseItem[] {
  const sorted = [...tickers].sort((a, b) => b.turnover24h - a.turnover24h);
  const take = Math.min(Math.max(minCount, 1), Math.max(maxCount, 1));
  return sorted.slice(0, take).map((t) => ({
    symbol: t.symbol,
    volume24h: t.volume24h,
    turnover24h: t.turnover24h,
  }));
}

export async function fetchKlines(symbol: string, interval: KlineInterval, limit = 200): Promise<Candle[]> {
  const data = await getJson<BybitResp<{ list: string[][] }>>(
    `/v5/market/kline?category=linear&symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`,
  );
  if (data.retCode !== 0) throw new Error(data.retMsg || 'Bybit kline failed');
  // Bybit returns newest first.
  return data.result.list
    .map((r) => ({
      ts: Number(r[0]),
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4]),
      volume: Number(r[5]),
    }))
    .reverse();
}
