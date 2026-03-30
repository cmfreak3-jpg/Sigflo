import type { Candle } from '@/types/market';

export function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i += 1) out.push(values[i] * k + out[i - 1] * (1 - k));
  return out;
}

export function rsi(values: number[], period: number): number[] {
  if (values.length <= period) return values.map(() => 50);
  const out: number[] = values.map(() => 50);
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
  const tr: number[] = [candles[0].high - candles[0].low];
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

export function recentSwingHigh(candles: Candle[], lookback: number): number {
  const s = candles.slice(-lookback);
  return s.reduce((m, c) => Math.max(m, c.high), s[0]?.high ?? 0);
}

export function recentSwingLow(candles: Candle[], lookback: number): number {
  const s = candles.slice(-lookback);
  return s.reduce((m, c) => Math.min(m, c.low), s[0]?.low ?? 0);
}
