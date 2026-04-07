import { useEffect, useState } from 'react';
import type { TradeChartInterval } from '@/hooks/useLiveTradeMarket';
import {
  parseTradeChartInterval,
  readPersistedTradeChartInterval,
  SIGFLO_CHART_INTERVAL_EVENT,
  TRADE_CHART_INTERVAL_STORAGE_KEY,
} from '@/lib/tradeChartIntervalPreference';

/**
 * Trade chart interval from localStorage, updated when the user changes TF on Trade
 * (custom event) or from another tab (`storage`).
 */
export function useSyncedTradeChartInterval(): TradeChartInterval {
  const [interval, setInterval] = useState<TradeChartInterval>(readPersistedTradeChartInterval);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== TRADE_CHART_INTERVAL_STORAGE_KEY) return;
      const next = parseTradeChartInterval(e.newValue);
      if (next) setInterval(next);
    };
    const onSigflo = (e: Event) => {
      const ce = e as CustomEvent<string>;
      const next = parseTradeChartInterval(ce.detail);
      if (next) setInterval(next);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(SIGFLO_CHART_INTERVAL_EVENT, onSigflo);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(SIGFLO_CHART_INTERVAL_EVENT, onSigflo);
    };
  }, []);

  return interval;
}
