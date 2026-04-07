import type { TradeChartInterval } from '@/hooks/useLiveTradeMarket';

/** Same key as `TradeScreen` — feed / markets mini charts read this to match the trade chart. */
export const TRADE_CHART_INTERVAL_STORAGE_KEY = 'sigflo.trade.chartInterval';

const VALID = new Set<TradeChartInterval>(['5', '15', '60', '240', 'D', 'W']);

export function parseTradeChartInterval(raw: string | null | undefined): TradeChartInterval | null {
  if (raw && VALID.has(raw as TradeChartInterval)) return raw as TradeChartInterval;
  return null;
}

export function readPersistedTradeChartInterval(): TradeChartInterval {
  if (typeof localStorage === 'undefined') return '5';
  return parseTradeChartInterval(localStorage.getItem(TRADE_CHART_INTERVAL_STORAGE_KEY)) ?? '5';
}

/** Short label next to feed mini charts — aligned with `TradeScreen` interval chips. */
export function tradeChartIntervalShortLabel(i: TradeChartInterval): string {
  if (i === 'D') return '1D';
  if (i === 'W') return '1W';
  if (i === '60') return '1h';
  if (i === '240') return '4h';
  return `${i}m`;
}

export const SIGFLO_CHART_INTERVAL_EVENT = 'sigflo-chart-interval';
