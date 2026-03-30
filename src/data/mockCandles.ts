import type { PlaybackCandle } from '@/types/market';

const START_TS = Date.UTC(2026, 0, 5, 12, 0, 0);
const STEP_MS = 5 * 60 * 1000;

function c(
  i: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number
): PlaybackCandle {
  return {
    timestamp: START_TS + i * STEP_MS,
    open,
    high,
    low,
    close,
    volume,
    isClosed: true,
  };
}

function prependWarmup(
  seed: PlaybackCandle[],
  opts: { count: number; startPrice: number; drift: number; spread: number; baseVolume: number }
): PlaybackCandle[] {
  const warm: PlaybackCandle[] = [];
  let price = opts.startPrice;
  for (let i = 0; i < opts.count; i += 1) {
    const wobble = Math.sin(i / 3) * opts.spread * 0.35;
    const close = Math.max(0.0001, price + opts.drift + wobble);
    const high = Math.max(price, close) + opts.spread;
    const low = Math.min(price, close) - opts.spread;
    const vol = opts.baseVolume * (0.92 + (i % 6) * 0.03);
    warm.push(c(i, price, high, low, close, vol));
    price = close;
  }
  const shifted = seed.map((bar, idx) =>
    c(
      opts.count + idx,
      bar.open + (price - opts.startPrice),
      bar.high + (price - opts.startPrice),
      bar.low + (price - opts.startPrice),
      bar.close + (price - opts.startPrice),
      bar.volume
    )
  );
  return [...warm, ...shifted];
}

const breakoutCore: PlaybackCandle[] = [
  c(0, 100, 101.4, 99.2, 100.8, 920),
  c(1, 100.8, 102.1, 100.2, 101.7, 980),
  c(2, 101.7, 103, 101.1, 102.5, 1000),
  c(3, 102.5, 103.2, 101.9, 102.8, 960),
  c(4, 102.8, 103.4, 102.2, 103.1, 940),
  c(5, 103.1, 103.6, 102.7, 103.3, 930),
  c(6, 103.3, 103.7, 102.9, 103.4, 950),
  c(7, 103.4, 103.8, 103.0, 103.5, 980),
  c(8, 103.5, 103.85, 103.2, 103.7, 1040),
  c(9, 103.7, 103.95, 103.3, 103.8, 1080),
  c(10, 103.8, 104.0, 103.45, 103.9, 1120),
  c(11, 103.9, 104.05, 103.5, 104.0, 1200),
  c(12, 104.0, 104.7, 103.9, 104.6, 1380),
  c(13, 104.6, 105.4, 104.4, 105.2, 1600),
  c(14, 105.2, 105.9, 104.9, 105.7, 1820),
];

const pullbackCore: PlaybackCandle[] = [
  c(0, 200, 201.8, 199.7, 201.4, 1450),
  c(1, 201.4, 203.1, 201.1, 202.7, 1520),
  c(2, 202.7, 204.6, 202.3, 204.1, 1600),
  c(3, 204.1, 205.9, 203.9, 205.6, 1680),
  c(4, 205.6, 207.1, 205.2, 206.8, 1720),
  c(5, 206.8, 207.2, 206.0, 206.2, 1300),
  c(6, 206.2, 206.6, 205.3, 205.7, 1180),
  c(7, 205.7, 206.1, 204.9, 205.2, 1100),
  c(8, 205.2, 205.6, 204.5, 204.9, 1040),
  c(9, 204.9, 205.4, 204.3, 204.7, 980),
  c(10, 204.7, 205.3, 204.4, 205.1, 940),
  c(11, 205.1, 205.9, 204.9, 205.6, 1020),
  c(12, 205.6, 206.5, 205.4, 206.2, 1120),
  c(13, 206.2, 207.0, 205.9, 206.8, 1230),
  c(14, 206.8, 207.8, 206.5, 207.5, 1360),
];

const overextendedCore: PlaybackCandle[] = [
  c(0, 50, 50.8, 49.7, 50.5, 1200),
  c(1, 50.5, 51.2, 50.2, 50.9, 1280),
  c(2, 50.9, 51.5, 50.7, 51.3, 1320),
  c(3, 51.3, 52.4, 51.1, 52.1, 1450),
  c(4, 52.1, 53.4, 51.8, 53.0, 1620),
  c(5, 53.0, 54.5, 52.7, 54.1, 1760),
  c(6, 54.1, 55.9, 53.8, 55.6, 1910),
  c(7, 55.6, 57.5, 55.2, 57.2, 2080),
  c(8, 57.2, 59.4, 56.8, 59.0, 2260),
  c(9, 59.0, 61.3, 58.6, 60.9, 2440),
  c(10, 60.9, 63.5, 60.2, 63.0, 2680),
  c(11, 63.0, 65.9, 62.1, 65.3, 2950),
  c(12, 65.3, 67.8, 64.9, 67.4, 3140),
  c(13, 67.4, 69.6, 66.9, 69.1, 3260),
  c(14, 69.1, 70.7, 67.9, 70.1, 3400),
];

export const breakoutScenario5m = prependWarmup(breakoutCore, {
  count: 18,
  startPrice: 96,
  drift: 0.16,
  spread: 0.55,
  baseVolume: 860,
});

export const pullbackScenario5m = prependWarmup(pullbackCore, {
  count: 20,
  startPrice: 192,
  drift: 0.28,
  spread: 0.9,
  baseVolume: 1200,
});

export const overextendedScenario5m = prependWarmup(overextendedCore, {
  count: 16,
  startPrice: 45,
  drift: 0.18,
  spread: 0.45,
  baseVolume: 980,
});
