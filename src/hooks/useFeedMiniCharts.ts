import { useEffect, useMemo, useRef, useState } from 'react';
import type { TradeChartInterval } from '@/hooks/useLiveTradeMarket';
import { fetchKlines } from '@/services/bybit/client';
import type { Candle, KlineInterval } from '@/types/market';

type CandleMap = Record<string, Candle[]>;
export type UseFeedMiniChartsOptions = {
  /** Same Bybit interval as the trade chart (`sigflo.trade.chartInterval`). */
  interval: TradeChartInterval;
  fastPairs?: string[];
  refreshMs?: number;
  fastRefreshMs?: number;
};

const CACHE_TTL_MS = 90_000;
const cache = new Map<string, { candles: Candle[]; fetchedAt: number }>();

function pairToLinearSymbol(pair: string): string {
  return `${pair.replace(/USDT$/i, '').toUpperCase()}USDT`;
}

function miniCacheKey(pair: string, interval: TradeChartInterval): string {
  return `${pair}|${interval}`;
}

export function useFeedMiniCharts(pairs: string[], options: UseFeedMiniChartsOptions): CandleMap {
  const [rows, setRows] = useState<CandleMap>({});
  const interval = options.interval;
  const activePairs = useMemo(() => [...new Set(pairs.map((p) => p.toUpperCase()))], [pairs]);
  const fastPairSet = useMemo(
    () => new Set((options.fastPairs ?? []).map((p) => p.toUpperCase())),
    [options.fastPairs],
  );
  const activeKey = useMemo(() => activePairs.join('|'), [activePairs]);
  const fastKey = useMemo(() => [...fastPairSet].sort().join('|'), [fastPairSet]);
  const refreshMs = options.refreshMs ?? 30_000;
  const fastRefreshMs = options.fastRefreshMs ?? 10_000;
  const requestRef = useRef(0);

  useEffect(() => {
    setRows({});
  }, [interval]);

  useEffect(() => {
    if (activePairs.length === 0) {
      setRows({});
      return;
    }
    let cancelled = false;
    requestRef.current += 1;
    const rid = requestRef.current;

    async function load() {
      const now = Date.now();
      const next: CandleMap = {};
      const misses: string[] = [];

      for (const pair of activePairs) {
        const key = miniCacheKey(pair, interval);
        const hit = cache.get(key);
        const ttl = fastPairSet.has(pair) ? Math.min(CACHE_TTL_MS, fastRefreshMs + 1500) : CACHE_TTL_MS;
        if (hit && now - hit.fetchedAt <= ttl) next[pair] = hit.candles;
        else misses.push(pair);
      }

      if (Object.keys(next).length > 0 && !cancelled && rid === requestRef.current) {
        setRows((prev) => ({ ...prev, ...next }));
      }

      if (misses.length === 0) return;
      const fetched = await Promise.all(
        misses.map(async (pair) => {
          try {
            const candles = await fetchKlines(
              pairToLinearSymbol(pair),
              interval as KlineInterval,
              34,
            );
            return { pair, candles };
          } catch {
            return { pair, candles: [] as Candle[] };
          }
        }),
      );

      if (cancelled || rid !== requestRef.current) return;
      const merged: CandleMap = {};
      for (const row of fetched) {
        if (row.candles.length > 0) {
          cache.set(miniCacheKey(row.pair, interval), { candles: row.candles, fetchedAt: Date.now() });
          merged[row.pair] = row.candles;
        }
      }
      if (Object.keys(merged).length > 0) setRows((prev) => ({ ...prev, ...merged }));
    }

    void load();
    const pollEveryMs = fastPairSet.size > 0 ? Math.min(refreshMs, fastRefreshMs) : refreshMs;
    const t = window.setInterval(() => {
      void load();
    }, pollEveryMs);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [activeKey, fastKey, interval, refreshMs, fastRefreshMs]);

  return rows;
}
