import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchKlines } from '@/services/bybit/client';
import type { Candle } from '@/types/market';

type CandleMap = Record<string, Candle[]>;

const CACHE_TTL_MS = 90_000;
const cache = new Map<string, { candles: Candle[]; fetchedAt: number }>();

function pairToLinearSymbol(pair: string): string {
  return `${pair.replace(/USDT$/i, '').toUpperCase()}USDT`;
}

export function useFeedMiniCharts(pairs: string[]): CandleMap {
  const [rows, setRows] = useState<CandleMap>({});
  const activePairs = useMemo(() => [...new Set(pairs.map((p) => p.toUpperCase()))], [pairs]);
  const activeKey = useMemo(() => activePairs.join('|'), [activePairs]);
  const requestRef = useRef(0);

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
        const hit = cache.get(pair);
        if (hit && now - hit.fetchedAt <= CACHE_TTL_MS) next[pair] = hit.candles;
        else misses.push(pair);
      }

      if (Object.keys(next).length > 0 && !cancelled && rid === requestRef.current) {
        setRows((prev) => ({ ...prev, ...next }));
      }

      if (misses.length === 0) return;
      const fetched = await Promise.all(
        misses.map(async (pair) => {
          try {
            const candles = await fetchKlines(pairToLinearSymbol(pair), '5', 34);
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
          cache.set(row.pair, { candles: row.candles, fetchedAt: Date.now() });
          merged[row.pair] = row.candles;
        }
      }
      if (Object.keys(merged).length > 0) setRows((prev) => ({ ...prev, ...merged }));
    }

    void load();
    const t = window.setInterval(() => {
      void load();
    }, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [activeKey]);

  return rows;
}
