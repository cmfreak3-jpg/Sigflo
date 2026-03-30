import { SCANNER_UNIVERSE } from '@/engine/types';
import type { Candle, CandleSeriesByInterval, ScannerSymbol } from '@/engine/types';

function mkTs(minutesAgo: number): number {
  return Date.now() - minutesAgo * 60_000;
}

function makeCandle(ts: number, open: number, close: number, spread: number, volume: number): Candle {
  const high = Math.max(open, close) + spread;
  const low = Math.min(open, close) - spread;
  return { ts, open, high, low, close, volume, isClosed: true };
}

function buildTrendSeries(
  basePrice: number,
  drift: number,
  volatility: number,
  volumeBase: number,
  volumeSpikeEvery = 0
): Candle[] {
  const candles: Candle[] = [];
  let price = basePrice;
  for (let i = 120; i >= 1; i -= 1) {
    const ts = mkTs(i * 15);
    const wobble = Math.sin(i / 5) * volatility;
    const move = drift + wobble;
    const open = price;
    const close = Math.max(0.0001, open + move);
    const spread = Math.max(0.0001, Math.abs(move) * 0.4 + volatility * 0.6);
    const spike = volumeSpikeEvery > 0 && i % volumeSpikeEvery === 0 ? 1.35 : 1;
    const volume = volumeBase * (0.92 + (i % 7) * 0.02) * spike;
    candles.push(makeCandle(ts, open, close, spread, volume));
    price = close;
  }
  return candles;
}

function compressTo5m(candles15m: Candle[]): Candle[] {
  // Mock convenience: we can reuse 15m structure while keeping deterministic values.
  return candles15m.map((c) => ({ ...c, ts: c.ts - 10 * 60_000 }));
}

function compressTo1m(candles15m: Candle[]): Candle[] {
  return candles15m.map((c) => ({ ...c, ts: c.ts - 14 * 60_000 }));
}

function makeSeriesForSymbol(symbol: ScannerSymbol): CandleSeriesByInterval {
  switch (symbol) {
    case 'BTCUSDT': {
      const c15 = buildTrendSeries(66_000, 18, 35, 1200, 8);
      return { '1m': compressTo1m(c15), '5m': compressTo5m(c15), '15m': c15 };
    }
    case 'ETHUSDT': {
      const c15 = buildTrendSeries(3400, 0.9, 3.2, 1600, 9);
      return { '1m': compressTo1m(c15), '5m': compressTo5m(c15), '15m': c15 };
    }
    case 'SOLUSDT': {
      const c15 = buildTrendSeries(155, 0.11, 0.6, 2500, 7);
      return { '1m': compressTo1m(c15), '5m': compressTo5m(c15), '15m': c15 };
    }
    case 'AVAXUSDT': {
      const c15 = buildTrendSeries(42, 0.03, 0.25, 1800, 0);
      return { '1m': compressTo1m(c15), '5m': compressTo5m(c15), '15m': c15 };
    }
    case 'LINKUSDT': {
      const c15 = buildTrendSeries(18, 0.015, 0.11, 1400, 10);
      return { '1m': compressTo1m(c15), '5m': compressTo5m(c15), '15m': c15 };
    }
    case 'XRPUSDT': {
      const c15 = buildTrendSeries(0.62, 0.0004, 0.006, 3600, 6);
      return { '1m': compressTo1m(c15), '5m': compressTo5m(c15), '15m': c15 };
    }
    case 'DOGEUSDT': {
      const c15 = buildTrendSeries(0.19, 0.00025, 0.0032, 4200, 5);
      return { '1m': compressTo1m(c15), '5m': compressTo5m(c15), '15m': c15 };
    }
    default: {
      const c15 = buildTrendSeries(100, 0.01, 0.15, 1000, 0);
      return { '1m': compressTo1m(c15), '5m': compressTo5m(c15), '15m': c15 };
    }
  }
}

export function buildMockScannerInput(): Record<string, CandleSeriesByInterval> {
  const out: Record<string, CandleSeriesByInterval> = {};
  for (const symbol of SCANNER_UNIVERSE) out[symbol] = makeSeriesForSymbol(symbol);
  return out;
}
