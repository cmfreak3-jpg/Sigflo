import type { Candle, IndicatorSnapshot } from '@/engine/types';

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out = [values[0]];
  for (let i = 1; i < values.length; i += 1) out.push(values[i] * k + out[i - 1] * (1 - k));
  return out;
}

export function rsi(values: number[], period: number): number[] {
  if (values.length <= period) return values.map(() => 50);
  const out = values.map(() => 50);
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss += -d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i += 1) {
    const d = values[i] - values[i - 1];
    const up = d > 0 ? d : 0;
    const dn = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + up) / period;
    avgLoss = (avgLoss * (period - 1) + dn) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function atr(candles: Candle[], period: number): number[] {
  if (candles.length === 0) return [];
  const tr = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i += 1) {
    const c = candles[i];
    const p = candles[i - 1];
    const v = Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
    tr.push(v);
  }
  return ema(tr, period);
}

export function rollingAvg(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i < period - 1 ? sum / (i + 1) : sum / period);
  }
  return out;
}

function recentSwingHigh(candles: Candle[], lookback: number): number {
  const s = candles.slice(-lookback);
  return s.reduce((m, c) => Math.max(m, c.high), s[0]?.high ?? 0);
}

function recentSwingLow(candles: Candle[], lookback: number): number {
  const s = candles.slice(-lookback);
  return s.reduce((m, c) => Math.min(m, c.low), s[0]?.low ?? 0);
}

export function deriveIndicatorSnapshot(candles: Candle[]): IndicatorSnapshot {
  const closes = candles.map((c) => c.close);
  const vols = candles.map((c) => c.volume);
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const rsi14 = rsi(closes, 14);
  const atr14 = atr(candles, 14);
  const vol20 = rollingAvg(vols, 20);
  const close = closes.at(-1) ?? 0;
  const lastEma20 = ema20.at(-1) ?? close;
  const lastEma50 = ema50.at(-1) ?? close;
  const lastAtr = Math.max(atr14.at(-1) ?? 0, 0.000001);
  const swingHigh = recentSwingHigh(candles, 40);
  const swingLow = recentSwingLow(candles, 40);
  return {
    ema20: lastEma20,
    ema50: lastEma50,
    ema20Slope: lastEma20 - (ema20.at(-2) ?? lastEma20),
    ema50Slope: lastEma50 - (ema50.at(-2) ?? lastEma50),
    rsi14: rsi14.at(-1) ?? 50,
    rsi14Slope: (rsi14.at(-1) ?? 50) - (rsi14.at(-2) ?? 50),
    atr14: lastAtr,
    avgVolume20: vol20.at(-1) ?? 0,
    localSwingHigh: swingHigh,
    localSwingLow: swingLow,
    breakoutDistanceAtr: clamp((swingHigh - close) / lastAtr, -10, 10),
    pullbackDepthAtr: clamp((lastEma20 - close) / lastAtr, -10, 10),
  };
}
