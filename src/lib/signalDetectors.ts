import { calculateSetupScore, getSetupScoreLabel } from '@/lib/setupScore';
import { atr, ema, recentSwingHigh, recentSwingLow, rollingAvg, rsi } from '@/lib/indicators';
import type { Candle, SymbolTicker } from '@/types/market';
import type { CryptoSignal, SetupScoreBreakdown, SignalRiskTag, SignalSetupTag, SignalSide } from '@/types/signal';

type DetectorOutput = {
  setupType: 'breakout' | 'pullback' | 'overextended';
  side: SignalSide;
  biasLabel: string;
  setupTags: SignalSetupTag[];
  riskTag: SignalRiskTag;
  aiExplanation: string;
  whyThisMatters: string;
  breakdown: SetupScoreBreakdown;
  facts: NonNullable<CryptoSignal['facts']>;
};

export type MarketRegime = 'risk_on' | 'neutral' | 'risk_off';

type DetectorThresholds = {
  breakoutVolRatio: number;
  breakoutDistAtr: number;
  breakoutCompression: number;
  pullbackMaxDistAtr: number;
  overextendedStretchAtr: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function coreMetrics(candles: Candle[]) {
  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const rsi14 = rsi(closes, 14);
  const atr14 = atr(candles, 14);
  const volAvg20 = rollingAvg(volumes, 20);
  const close = closes.at(-1) ?? 0;
  const atrNow = atr14.at(-1) ?? 0;
  const rsiNow = rsi14.at(-1) ?? 50;
  return {
    close,
    closePrev: closes.at(-2) ?? close,
    ema20: ema20.at(-1) ?? close,
    ema20Prev: ema20.at(-2) ?? (ema20.at(-1) ?? close),
    ema50: ema50.at(-1) ?? close,
    ema50Prev: ema50.at(-2) ?? (ema50.at(-1) ?? close),
    rsiNow,
    rsiPrev: rsi14.at(-2) ?? rsiNow,
    atrNow,
    volNow: volumes.at(-1) ?? 0,
    volAvg: volAvg20.at(-1) ?? 1,
    swingHigh: recentSwingHigh(candles, 40),
    swingLow: recentSwingLow(candles, 40),
  };
}

function rangeCompressionScore(candles: Candle[], atrNow: number): number {
  const recent = candles.slice(-8);
  const sumRange = recent.reduce((s, c) => s + (c.high - c.low), 0);
  const ratio = atrNow > 0 ? sumRange / atrNow : 99;
  return clamp((2.6 - ratio) / 1.6, 0, 1);
}

function thresholdsForRegime(regime: MarketRegime): DetectorThresholds {
  if (regime === 'risk_off') {
    return {
      breakoutVolRatio: 1.35,
      breakoutDistAtr: 0.3,
      breakoutCompression: 0.46,
      pullbackMaxDistAtr: 0.45,
      overextendedStretchAtr: 1.7,
    };
  }
  if (regime === 'risk_on') {
    return {
      breakoutVolRatio: 1.2,
      breakoutDistAtr: 0.42,
      breakoutCompression: 0.34,
      pullbackMaxDistAtr: 0.6,
      overextendedStretchAtr: 1.9,
    };
  }
  return {
    breakoutVolRatio: 1.25,
    breakoutDistAtr: 0.35,
    breakoutCompression: 0.4,
    pullbackMaxDistAtr: 0.5,
    overextendedStretchAtr: 1.8,
  };
}

function breakoutPressureDetector(candles: Candle[], thresholds: DetectorThresholds): DetectorOutput | null {
  if (candles.length < 60) return null;
  const m = coreMetrics(candles);
  const trend = m.close > m.ema20 && m.ema20 > m.ema50 && m.ema20 > m.ema20Prev && m.ema50 > m.ema50Prev;
  const compression = rangeCompressionScore(candles, m.atrNow);
  const distToHigh = m.swingHigh - m.close;
  const distanceToBreakoutAtr = m.atrNow > 0 ? distToHigh / m.atrNow : 99;
  const nearBreakout = m.atrNow > 0 && distToHigh >= 0 && distToHigh < thresholds.breakoutDistAtr * m.atrNow;
  const volBoost = m.volAvg > 0 ? m.volNow / m.volAvg : 1;
  const volOk = volBoost > thresholds.breakoutVolRatio;
  const rsiSlope = m.rsiNow - m.rsiPrev;
  const rsiOk = m.rsiNow >= 55 && m.rsiNow <= 72 && rsiSlope >= -0.5;
  const passCount = [trend, compression > thresholds.breakoutCompression, nearBreakout, volOk, rsiOk].filter(Boolean).length;
  if (passCount < 4) return null;
  return {
    setupType: 'breakout',
    side: 'long',
    biasLabel: 'Potential Long',
    setupTags: ['Breakout'],
    riskTag: 'Medium Risk',
    aiExplanation: 'Range is tightening and pressure is building into local highs.',
    whyThisMatters: 'A clean break can move quickly when resistance overhead is thin.',
    breakdown: {
      trendAlignment: trend ? 22 : 14,
      momentumQuality: clamp(Math.round(((m.rsiNow - 50) / 22) * 20), 8, 18),
      structureQuality: clamp(Math.round((compression * 0.6 + (nearBreakout ? 0.4 : 0.2)) * 25), 10, 22),
      volumeConfirmation: clamp(Math.round(Math.min(volBoost, 2) / 2 * 15), 6, 14),
      riskConditions: 8,
    },
    facts: {
      emaTrend: trend ? 'bullish' : 'neutral',
      volumeRatio: Number(volBoost.toFixed(2)),
      rsi: Number(m.rsiNow.toFixed(1)),
      distanceToBreakoutAtr: Number(distanceToBreakoutAtr.toFixed(2)),
    },
  };
}

function pullbackContinuationDetector(candles: Candle[], thresholds: DetectorThresholds): DetectorOutput | null {
  if (candles.length < 60) return null;
  const m = coreMetrics(candles);
  const trendUp = m.ema20 > m.ema50;
  const nearEma = m.atrNow > 0 && Math.abs(m.close - m.ema20) <= thresholds.pullbackMaxDistAtr * m.atrNow;
  const pullbackDepth = m.atrNow > 0 ? (m.ema20 - m.close) / m.atrNow : 0;
  const depthOk = pullbackDepth >= -0.3 && pullbackDepth <= 1.5;
  const rsiOk = m.rsiNow >= 45 && m.rsiNow <= 60 && m.rsiNow >= m.rsiPrev;
  const recent = candles.slice(-8);
  const redVol = recent.filter((c) => c.close < c.open).reduce((s, c) => s + c.volume, 0);
  const greenVol = recent.filter((c) => c.close >= c.open).reduce((s, c) => s + c.volume, 0);
  const volCool = redVol < greenVol * 1.05;
  const passCount = [trendUp, nearEma, depthOk, rsiOk, volCool].filter(Boolean).length;
  if (passCount < 4) return null;
  return {
    setupType: 'pullback',
    side: 'long',
    biasLabel: 'Potential Long',
    setupTags: ['Pullback'],
    riskTag: 'Low Risk',
    aiExplanation: 'Pullback remains orderly while trend structure stays intact.',
    whyThisMatters: 'If buyers hold this zone, continuation entries often get cleaner risk.',
    breakdown: {
      trendAlignment: trendUp ? 21 : 14,
      momentumQuality: clamp(Math.round((1 - Math.abs(52 - m.rsiNow) / 16) * 20), 9, 17),
      structureQuality: clamp(Math.round(((nearEma ? 0.5 : 0.2) + (depthOk ? 0.5 : 0.2)) * 25), 12, 22),
      volumeConfirmation: volCool ? 11 : 8,
      riskConditions: 10,
    },
    facts: {
      emaTrend: trendUp ? 'bullish' : 'neutral',
      volumeRatio: Number((m.volNow / Math.max(1, m.volAvg)).toFixed(2)),
      rsi: Number(m.rsiNow.toFixed(1)),
      pullbackDepthAtr: Number(pullbackDepth.toFixed(2)),
    },
  };
}

function overextendedDetector(candles: Candle[], thresholds: DetectorThresholds): DetectorOutput | null {
  if (candles.length < 60) return null;
  const m = coreMetrics(candles);
  const stretch = m.atrNow > 0 ? Math.abs(m.close - m.ema20) / m.atrNow : 0;
  const stretchOk = stretch > thresholds.overextendedStretchAtr;
  const rsiHot = m.rsiNow > 74;
  const c3 = candles.slice(-3);
  const gain3 = c3.length > 0 ? c3[c3.length - 1].close - c3[0].open : 0;
  const expansion = m.atrNow > 0 ? gain3 / m.atrNow : 0;
  const expansionOk = expansion > 1.5;
  const nearResistance = m.atrNow > 0 && m.swingHigh - m.close < 0.4 * m.atrNow;
  const passCount = [stretchOk, rsiHot, expansionOk, nearResistance].filter(Boolean).length;
  if (passCount < 3) return null;
  return {
    setupType: 'overextended',
    side: 'long',
    biasLabel: 'Overextended',
    setupTags: ['Overextended'],
    riskTag: 'High Risk',
    aiExplanation: 'Price is extended away from trend support and momentum is overheated.',
    whyThisMatters: 'Late entries here are vulnerable if price reverts toward trend mean.',
    breakdown: {
      trendAlignment: 15,
      momentumQuality: 12,
      structureQuality: 10,
      volumeConfirmation: 8,
      riskConditions: 4,
    },
    facts: {
      emaTrend: m.close > m.ema20 ? 'bullish' : 'neutral',
      volumeRatio: Number((m.volNow / Math.max(1, m.volAvg)).toFixed(2)),
      rsi: Number(m.rsiNow.toFixed(1)),
      extensionAtr: Number(stretch.toFixed(2)),
      distanceToBreakoutAtr: Number(((m.swingHigh - m.close) / Math.max(0.000001, m.atrNow)).toFixed(2)),
    },
  };
}

/** Bearish mirror of `breakoutPressureDetector`: downtrend, compression into local lows, sell-volume pressure. */
function breakdownPressureDetector(candles: Candle[], thresholds: DetectorThresholds): DetectorOutput | null {
  if (candles.length < 60) return null;
  const m = coreMetrics(candles);
  const trend =
    m.close < m.ema20 && m.ema20 < m.ema50 && m.ema20 < m.ema20Prev && m.ema50 < m.ema50Prev;
  const compression = rangeCompressionScore(candles, m.atrNow);
  const distToLow = m.close - m.swingLow;
  const distanceToBreakdownAtr = m.atrNow > 0 ? distToLow / m.atrNow : 99;
  const nearBreakdown = m.atrNow > 0 && distToLow >= 0 && distToLow < thresholds.breakoutDistAtr * m.atrNow;
  const volBoost = m.volAvg > 0 ? m.volNow / m.volAvg : 1;
  const volOk = volBoost > thresholds.breakoutVolRatio;
  const rsiSlope = m.rsiNow - m.rsiPrev;
  const rsiOk = m.rsiNow >= 28 && m.rsiNow <= 45 && rsiSlope <= 0.5;
  const passCount = [trend, compression > thresholds.breakoutCompression, nearBreakdown, volOk, rsiOk].filter(Boolean).length;
  if (passCount < 4) return null;
  return {
    setupType: 'breakout',
    side: 'short',
    biasLabel: 'Potential Short',
    setupTags: ['Breakout'],
    riskTag: 'Medium Risk',
    aiExplanation: 'Range is tightening and supply is pressing into local lows.',
    whyThisMatters: 'A clean break lower can accelerate when bids thin under the shelf.',
    breakdown: {
      trendAlignment: trend ? 22 : 14,
      momentumQuality: clamp(Math.round(((50 - m.rsiNow) / 22) * 20), 8, 18),
      structureQuality: clamp(Math.round((compression * 0.6 + (nearBreakdown ? 0.4 : 0.2)) * 25), 10, 22),
      volumeConfirmation: clamp(Math.round(Math.min(volBoost, 2) / 2 * 15), 6, 14),
      riskConditions: 8,
    },
    facts: {
      emaTrend: trend ? 'bearish' : 'neutral',
      volumeRatio: Number(volBoost.toFixed(2)),
      rsi: Number(m.rsiNow.toFixed(1)),
      distanceToBreakoutAtr: Number(distanceToBreakdownAtr.toFixed(2)),
    },
  };
}

/** Bearish mirror of `pullbackContinuationDetector`: downtrend bounce into EMA, fading buying. */
function pullbackContinuationShortDetector(candles: Candle[], thresholds: DetectorThresholds): DetectorOutput | null {
  if (candles.length < 60) return null;
  const m = coreMetrics(candles);
  const trendDown = m.ema20 < m.ema50;
  const nearEma = m.atrNow > 0 && Math.abs(m.close - m.ema20) <= thresholds.pullbackMaxDistAtr * m.atrNow;
  const bounceDepth = m.atrNow > 0 ? (m.close - m.ema20) / m.atrNow : 0;
  const depthOk = bounceDepth >= -0.3 && bounceDepth <= 1.5;
  const rsiOk = m.rsiNow >= 40 && m.rsiNow <= 58 && m.rsiNow <= m.rsiPrev;
  const recent = candles.slice(-8);
  const redVol = recent.filter((c) => c.close < c.open).reduce((s, c) => s + c.volume, 0);
  const greenVol = recent.filter((c) => c.close >= c.open).reduce((s, c) => s + c.volume, 0);
  const volCool = greenVol < redVol * 1.05;
  const passCount = [trendDown, nearEma, depthOk, rsiOk, volCool].filter(Boolean).length;
  if (passCount < 4) return null;
  return {
    setupType: 'pullback',
    side: 'short',
    biasLabel: 'Potential Short',
    setupTags: ['Pullback'],
    riskTag: 'Low Risk',
    aiExplanation: 'Bounce into the mean is losing participation while the broader trend stays down.',
    whyThisMatters: 'If sellers reassert here, continuation shorts often get cleaner invalidation above the bounce.',
    breakdown: {
      trendAlignment: trendDown ? 21 : 14,
      momentumQuality: clamp(Math.round((1 - Math.abs(48 - m.rsiNow) / 16) * 20), 9, 17),
      structureQuality: clamp(Math.round(((nearEma ? 0.5 : 0.2) + (depthOk ? 0.5 : 0.2)) * 25), 12, 22),
      volumeConfirmation: volCool ? 11 : 8,
      riskConditions: 10,
    },
    facts: {
      emaTrend: trendDown ? 'bearish' : 'neutral',
      volumeRatio: Number((m.volNow / Math.max(1, m.volAvg)).toFixed(2)),
      rsi: Number(m.rsiNow.toFixed(1)),
      pullbackDepthAtr: Number(bounceDepth.toFixed(2)),
    },
  };
}

/** Bearish mirror of `overextendedDetector`: stretched below the mean, oversold heat, near local support. */
function overextendedShortDetector(candles: Candle[], thresholds: DetectorThresholds): DetectorOutput | null {
  if (candles.length < 60) return null;
  const m = coreMetrics(candles);
  const stretch = m.atrNow > 0 ? Math.abs(m.close - m.ema20) / m.atrNow : 0;
  const stretchOk = stretch > thresholds.overextendedStretchAtr;
  const rsiCold = m.rsiNow < 26;
  const c3 = candles.slice(-3);
  const drop3 = c3.length > 0 ? c3[0].open - c3[c3.length - 1].close : 0;
  const expansion = m.atrNow > 0 ? drop3 / m.atrNow : 0;
  const expansionOk = expansion > 1.5;
  const nearSupport = m.atrNow > 0 && m.close - m.swingLow < 0.4 * m.atrNow;
  const passCount = [stretchOk, rsiCold, expansionOk, nearSupport].filter(Boolean).length;
  if (passCount < 3) return null;
  return {
    setupType: 'overextended',
    side: 'short',
    biasLabel: 'Overextended',
    setupTags: ['Overextended'],
    riskTag: 'High Risk',
    aiExplanation: 'Price is extended below trend resistance and momentum is washed out.',
    whyThisMatters: 'Late shorts into a flush can face sharp squeezes if mean reversion kicks in.',
    breakdown: {
      trendAlignment: 15,
      momentumQuality: 12,
      structureQuality: 10,
      volumeConfirmation: 8,
      riskConditions: 4,
    },
    facts: {
      emaTrend: m.close < m.ema20 ? 'bearish' : 'neutral',
      volumeRatio: Number((m.volNow / Math.max(1, m.volAvg)).toFixed(2)),
      rsi: Number(m.rsiNow.toFixed(1)),
      extensionAtr: Number(stretch.toFixed(2)),
      distanceToBreakoutAtr: Number(((m.close - m.swingLow) / Math.max(0.000001, m.atrNow)).toFixed(2)),
    },
  };
}

const MARKET_DETECTORS = [
  breakoutPressureDetector,
  breakdownPressureDetector,
  pullbackContinuationDetector,
  pullbackContinuationShortDetector,
  overextendedDetector,
  overextendedShortDetector,
] as const;

function mapRiskTag(score: number, detectorRisk: SignalRiskTag): SignalRiskTag {
  if (detectorRisk === 'High Risk') return 'High Risk';
  if (score >= 75) return 'Low Risk';
  if (score >= 60) return 'Medium Risk';
  return 'High Risk';
}

export function buildSignalFromMarket(input: {
  symbol: string;
  exchange: string;
  ticker: SymbolTicker;
  candles15m: Candle[];
  regime?: MarketRegime;
}): CryptoSignal | null {
  const thresholds = thresholdsForRegime(input.regime ?? 'neutral');
  let best: { out: DetectorOutput; setupScore: number } | null = null;
  for (const detector of MARKET_DETECTORS) {
    const out = detector(input.candles15m, thresholds);
    if (!out) continue;
    const setupScore = calculateSetupScore(out.breakdown);
    if (!best || setupScore > best.setupScore) {
      best = { out, setupScore };
    }
  }
  if (!best) return null;
  const { out, setupScore } = best;
  return {
    id: `live-${input.symbol}-${Date.now()}`,
    pair: input.symbol.replace('USDT', ''),
    side: out.side,
    biasLabel: out.biasLabel,
    setupType: out.setupType,
    setupScore,
    setupScoreLabel: getSetupScoreLabel(setupScore),
    scoreBreakdown: out.breakdown,
    facts: out.facts,
    riskTag: mapRiskTag(setupScore, out.riskTag),
    setupTags: out.setupTags,
    exchange: input.exchange,
    postedAgo: 'Live',
    aiExplanation: out.aiExplanation,
    whyThisMatters: out.whyThisMatters,
  };
}

export function inferMarketRegime(input: { btc15m: Candle[]; eth15m: Candle[] }): MarketRegime {
  function score(candles: Candle[]): number {
    const m = coreMetrics(candles);
    const trend = m.close > m.ema20 && m.ema20 > m.ema50 ? 1 : m.close < m.ema20 && m.ema20 < m.ema50 ? -1 : 0;
    const momentum = m.rsiNow > 56 ? 1 : m.rsiNow < 44 ? -1 : 0;
    return trend + momentum;
  }
  const combined = score(input.btc15m) + score(input.eth15m);
  if (combined >= 3) return 'risk_on';
  if (combined <= -3) return 'risk_off';
  return 'neutral';
}
