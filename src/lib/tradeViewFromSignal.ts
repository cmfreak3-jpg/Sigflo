import type { CryptoSignal } from '@/types/signal';
import type { AiInsight, TradeChartCandle, TradeSide, TradeViewModel } from '@/types/trade';

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/** Rough reference marks when the feed has not delivered a last price yet. */
const FALLBACK_LAST_BY_BASE: Record<string, number> = {
  BTC: 65200,
  ETH: 3500,
  SOL: 142,
  AVAX: 36,
  DOGE: 0.16,
  XRP: 0.55,
};

function pairBaseUpper(pair: string): string {
  const raw = pair.trim().toUpperCase();
  if (raw.includes('/')) return raw.split('/')[0]?.trim().replace(/[^A-Z0-9]/g, '') || 'BTC';
  return raw.replace(/USDT$/i, '').replace(/[^A-Z0-9]/g, '') || 'BTC';
}

export function fallbackLastForPair(pair: string): number {
  const b = pairBaseUpper(pair);
  return FALLBACK_LAST_BY_BASE[b] ?? 100;
}

/** First live tick wins per navigation; otherwise last price; else static fallback by pair. */
export function resolveTradeAnchorPrice(
  frozenAnchor: number | null,
  liveLast: number | undefined,
  pair: string,
): number {
  if (frozenAnchor != null && Number.isFinite(frozenAnchor) && frozenAnchor > 0) return frozenAnchor;
  if (liveLast != null && Number.isFinite(liveLast) && liveLast > 0) return liveLast;
  return fallbackLastForPair(pair);
}

function riskTagToAiRisk(tag: CryptoSignal['riskTag']): AiInsight['risk'] {
  if (tag === 'High Risk') return 'High';
  if (tag === 'Low Risk') return 'Low';
  return 'Medium';
}

function setupTypeToTrend(setupType: CryptoSignal['setupType'], side: TradeSide): AiInsight['trend'] {
  if (setupType === 'breakout') return side === 'long' ? 'Bullish' : 'Bearish';
  if (setupType === 'pullback') return side === 'long' ? 'Bullish' : 'Bearish';
  return side === 'long' ? 'Neutral' : 'Neutral';
}

function setupTypeToMomentum(setupType: CryptoSignal['setupType']): AiInsight['momentum'] {
  if (setupType === 'breakout') return 'Strong';
  if (setupType === 'pullback') return 'Building';
  return 'Weak';
}

/**
 * Derive stop / target distances from setup quality: stronger setups use slightly tighter invalidation bands.
 */
function deriveLevels(side: TradeSide, ref: number, setupScore: number): { stop: number; target: number; entry: number } {
  const score = clamp(setupScore, 35, 98);
  const stopFrac = 0.01 + ((90 - score) / 90) * 0.025;
  const rewardMult = 1.45;
  const entry = ref;
  if (side === 'long') {
    const stop = entry * (1 - stopFrac);
    const target = entry * (1 + stopFrac * rewardMult);
    return { entry, stop, target };
  }
  const stop = entry * (1 + stopFrac);
  const target = entry * (1 - stopFrac * rewardMult);
  return { entry, stop, target };
}

/** Long: stop < entry < target. Short: target < entry < stop. Fixes bad deep links / mixed data. */
/**
 * When the exchange omits SL/TP on the position payload, keep plan levels only if they sit on the correct
 * side of the **actual** entry for the open position; otherwise derive a band from `setupScore`.
 * Does not replace the other leg (unlike `coerceStopTargetToSide`), so a valid Bybit TP can stay paired with a fixed stop.
 */
export function ensureStopForOpenPosition(
  positionSide: TradeSide,
  entry: number,
  planStop: number,
  setupScore: number,
): number {
  if (entry > 0 && Number.isFinite(entry)) {
    if (Number.isFinite(planStop) && planStop > 0) {
      const ok = positionSide === 'long' ? planStop < entry : planStop > entry;
      if (ok) return planStop;
    }
    return deriveLevels(positionSide, entry, setupScore).stop;
  }
  return Number.isFinite(planStop) && planStop > 0 ? planStop : NaN;
}

export function ensureTargetForOpenPosition(
  positionSide: TradeSide,
  entry: number,
  planTarget: number,
  setupScore: number,
): number {
  if (entry > 0 && Number.isFinite(entry)) {
    if (Number.isFinite(planTarget) && planTarget > 0) {
      const ok = positionSide === 'long' ? planTarget > entry : planTarget < entry;
      if (ok) return planTarget;
    }
    return deriveLevels(positionSide, entry, setupScore).target;
  }
  return Number.isFinite(planTarget) && planTarget > 0 ? planTarget : NaN;
}

export function coerceStopTargetToSide(
  side: TradeSide,
  entry: number,
  stop: number,
  target: number,
  setupScore: number,
): { stop: number; target: number } {
  if (!(entry > 0) || !Number.isFinite(stop) || !Number.isFinite(target) || !(stop > 0) || !(target > 0)) {
    const d = deriveLevels(side, entry, setupScore);
    return { stop: d.stop, target: d.target };
  }
  const ok =
    side === 'long'
      ? stop < entry && target > entry
      : stop > entry && target < entry;
  if (ok) return { stop, target };
  const d = deriveLevels(side, entry, setupScore);
  return { stop: d.stop, target: d.target };
}

export type LiveTradeSnapshot = {
  lastPrice?: number;
  change24hPct?: number;
  high24h?: number;
  low24h?: number;
  volume24h?: string;
  priceSeries?: number[];
  chartCandles?: TradeChartCandle[];
};

/**
 * Build a full trade view model for production: levels from optional `planned*` on the signal,
 * else from anchor price + derived R multiples. Market fields prefer the live snapshot.
 */
export function buildTradeViewModelFromSignal(
  signal: CryptoSignal,
  live: LiveTradeSnapshot,
  opts: { anchorPrice: number; balanceUsd: number; /** Trade ticket Long/Short — when set, levels follow this side, not only `signal.side`. */ tradeSide?: TradeSide },
): TradeViewModel {
  const side: TradeSide = opts.tradeSide ?? (signal.side === 'short' ? 'short' : 'long');
  const ref = opts.anchorPrice > 0 && Number.isFinite(opts.anchorPrice) ? opts.anchorPrice : fallbackLastForPair(signal.pair);

  const plannedE = signal.plannedEntry;
  const plannedS = signal.plannedStop;
  const plannedT = signal.plannedTarget;

  let entry: number;
  let stop: number;
  let target: number;

  if (
    plannedE != null &&
    plannedS != null &&
    plannedT != null &&
    Number.isFinite(plannedE) &&
    Number.isFinite(plannedS) &&
    Number.isFinite(plannedT) &&
    plannedE > 0
  ) {
    entry = plannedE;
    stop = plannedS;
    target = plannedT;
  } else if (plannedE != null && Number.isFinite(plannedE) && plannedE > 0) {
    entry = plannedE;
    const d = deriveLevels(side, entry, signal.setupScore);
    stop = plannedS != null && Number.isFinite(plannedS) ? plannedS : d.stop;
    target = plannedT != null && Number.isFinite(plannedT) ? plannedT : d.target;
  } else {
    const d = deriveLevels(side, ref, signal.setupScore);
    entry = d.entry;
    stop = d.stop;
    target = d.target;
  }

  const coerced = coerceStopTargetToSide(side, entry, stop, target, signal.setupScore);
  stop = coerced.stop;
  target = coerced.target;

  const lastPrice = live.lastPrice != null && Number.isFinite(live.lastPrice) && live.lastPrice > 0 ? live.lastPrice : ref;
  const change24hPct = live.change24hPct != null && Number.isFinite(live.change24hPct) ? live.change24hPct : 0;
  const high24h = live.high24h != null && Number.isFinite(live.high24h) && live.high24h > 0 ? live.high24h : lastPrice * 1.02;
  const low24h = live.low24h != null && Number.isFinite(live.low24h) && live.low24h > 0 ? live.low24h : lastPrice * 0.98;
  const volume24h = live.volume24h ?? '—';

  const liqDistance = 0.9 / 12;
  const liquidation = side === 'long' ? entry * (1 - liqDistance) : entry * (1 + liqDistance);

  const stopMovePct = Math.abs((stop - entry) / entry);
  const targetMovePct = Math.abs((target - entry) / entry);
  const positionSizeUsd = 15000;
  const amountUsedUsd = 1500;
  const leverage = 10;
  const targetProfitUsd = positionSizeUsd * targetMovePct;
  const stopLossUsd = -(positionSizeUsd * stopMovePct);
  const riskReward = stopMovePct > 0 ? targetMovePct / stopMovePct : 1.5;

  const displayPair = `${pairBaseUpper(signal.pair)} / USDT`;

  const priceSeries =
    live.priceSeries && live.priceSeries.length > 20
      ? live.priceSeries
      : Array.from({ length: 48 }, (_, i) => 0.4 + (i / 47) * 0.45);

  const aiInsight: AiInsight = {
    trend: setupTypeToTrend(signal.setupType, side),
    momentum: setupTypeToMomentum(signal.setupType),
    risk: riskTagToAiRisk(signal.riskTag),
    summary: signal.aiExplanation.slice(0, 280),
  };

  return {
    pair: displayPair,
    side,
    lastPrice,
    change24hPct,
    high24h,
    low24h,
    volume24h,
    entry,
    stop,
    target,
    liquidation,
    balanceUsd: Math.max(0, opts.balanceUsd),
    amountUsedUsd,
    leverage,
    positionSizeUsd,
    targetProfitUsd,
    stopLossUsd,
    riskReward,
    aiInsight,
    priceSeries,
    chartCandles: live.chartCandles && live.chartCandles.length > 0 ? live.chartCandles : undefined,
  };
}
