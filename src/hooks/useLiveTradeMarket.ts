import { useEffect, useMemo, useRef, useState } from 'react';
import { BybitWsClient } from '@/lib/bybitWsClient';
import { fetchKlines, fetchTickers } from '@/services/bybit/client';
import type { Candle } from '@/types/market';
import type { TradeChartCandle } from '@/types/trade';

export type TradeChartInterval = '5' | '15' | '60' | '240' | 'D' | 'W';
const SUPPORTED_INTERVALS: TradeChartInterval[] = ['5', '15', '60', '240', 'D', 'W'];

type LiveTradeState = {
  lastPrice?: number;
  change24hPct?: number;
  high24h?: number;
  low24h?: number;
  volume24h?: string;
  priceSeries?: number[];
  chartCandles?: TradeChartCandle[];
  loadingInterval: boolean;
  lastUpdateTs?: number;
  mode: 'REST' | 'WS' | 'MOCK';
  connection: 'connected' | 'reconnecting' | 'disconnected';
};

function upsertCandle(store: Candle[], next: Candle): Candle[] {
  const out = [...store];
  const last = out.at(-1);
  if (!last || next.ts > last.ts) out.push(next);
  else if (next.ts === last.ts) out[out.length - 1] = next;
  return out.slice(-140);
}

function toBillions(v: number): string {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function normalizeSeries(candles: Candle[]): number[] {
  if (candles.length === 0) return [];
  const closes = candles.map((c) => c.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = Math.max(0.000001, max - min);
  return closes.map((v) => (v - min) / span);
}

function toTradeCandles(candles: Candle[]): TradeChartCandle[] {
  return candles.map((c) => ({
    ts: c.ts,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));
}

export function useLiveTradeMarket(symbol: string, interval: TradeChartInterval): LiveTradeState {
  const [state, setState] = useState<LiveTradeState>({
    loadingInterval: true,
    mode: 'MOCK',
    connection: 'disconnected',
  });
  const candlesRef = useRef<Record<TradeChartInterval, Candle[]>>({
    '5': [],
    '15': [],
    '60': [],
    '240': [],
    D: [],
    W: [],
  });
  const readyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    readyRef.current = false;
    candlesRef.current = { '5': [], '15': [], '60': [], '240': [], D: [], W: [] };
    setState((prev) => ({ ...prev, loadingInterval: true }));

    async function bootstrap(reason: 'startup' | 'reconnect') {
      try {
        console.log(`[Sigflo][Trade] REST bootstrap (${reason}) ${symbol}`);
        const [c5, c15, c60, c240, cD, cW, tickers] = await Promise.all([
          fetchKlines(symbol, '5', 140),
          fetchKlines(symbol, '15', 140),
          fetchKlines(symbol, '60', 140),
          fetchKlines(symbol, '240', 140),
          fetchKlines(symbol, 'D', 140),
          fetchKlines(symbol, 'W', 140),
          fetchTickers([symbol]),
        ]);
        candlesRef.current = {
          '5': c5,
          '15': c15,
          '60': c60,
          '240': c240,
          D: cD,
          W: cW,
        };
        const active = candlesRef.current[interval];
        const t = tickers[0];
        if (!t || cancelled) return;
        readyRef.current = true;
        // Do not set `connection` here — WebSocket owns that. Overwriting with
        // `disconnected` after `onConnectionChange('connected')` caused "REST • DISCONNECTED"
        // while the socket was actually live.
        setState((prev) => ({
          ...prev,
          lastPrice: t.lastPrice,
          change24hPct: t.price24hPcnt * 100,
          high24h: t.high24h,
          low24h: t.low24h,
          volume24h: toBillions(t.turnover24h),
          priceSeries: normalizeSeries(active),
          chartCandles: toTradeCandles(active),
          loadingInterval: false,
          lastUpdateTs: Date.now(),
          mode: prev.connection === 'connected' ? 'WS' : 'REST',
        }));
      } catch {
        if (cancelled) return;
        setState((prev) => ({ ...prev, loadingInterval: false, mode: 'MOCK', connection: 'disconnected' }));
      }
    }

    const ws = new BybitWsClient({
      klineSymbols: [symbol],
      klineIntervals: SUPPORTED_INTERVALS,
      includeTickers: true,
      onLog: (msg) => console.log(`[Sigflo][Trade] ${msg}`),
      onConnectionChange: (connection) => {
        setState((prev) => ({
          ...prev,
          connection,
          mode:
            prev.mode === 'MOCK'
              ? 'MOCK'
              : connection === 'connected'
                ? 'WS'
                : connection === 'reconnecting'
                  ? 'REST'
                  : 'REST',
        }));
        if (connection === 'connected') void bootstrap('reconnect');
      },
      onTicker: (t) => {
        if (t.symbol !== symbol) return;
        const price = t.lastPrice;
        const active = candlesRef.current[interval];
        if (active.length > 0) {
          const last = active[active.length - 1];
          active[active.length - 1] = {
            ...last,
            close: price,
            high: Math.max(last.high, price),
            low: Math.min(last.low, price),
          };
        }
        setState((prev) => ({
          ...prev,
          lastPrice: price,
          change24hPct: t.price24hPcnt * 100,
          high24h: t.high24h,
          low24h: t.low24h,
          volume24h: toBillions(t.turnover24h),
          priceSeries: active.length > 0 ? normalizeSeries(active) : prev.priceSeries,
          chartCandles: active.length > 0 ? toTradeCandles(active) : prev.chartCandles,
          lastUpdateTs: Date.now(),
          mode: readyRef.current ? 'WS' : prev.mode,
        }));
      },
      onKline: (k) => {
        if (k.symbol !== symbol) return;
        if (!SUPPORTED_INTERVALS.includes(k.interval as TradeChartInterval)) return;
        const key: TradeChartInterval = k.interval as TradeChartInterval;
        candlesRef.current[key] = upsertCandle(candlesRef.current[key], {
          ts: k.start,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
          volume: k.volume,
          isClosed: k.confirm,
        });
        const active = candlesRef.current[interval];
        setState((prev) => ({
          ...prev,
          priceSeries: normalizeSeries(active),
          chartCandles: toTradeCandles(active),
          loadingInterval: false,
          lastUpdateTs: Date.now(),
          mode: readyRef.current ? 'WS' : prev.mode,
        }));
      },
    });

    void bootstrap('startup').then(() => ws.connect());
    return () => {
      cancelled = true;
      ws.disconnect();
    };
  }, [symbol, interval]);

  useEffect(() => {
    const active = candlesRef.current[interval];
    if (!active || active.length === 0) return;
    setState((prev) => ({
      ...prev,
      priceSeries: normalizeSeries(active),
      chartCandles: toTradeCandles(active),
    }));
  }, [interval]);

  return useMemo(() => state, [state]);
}

