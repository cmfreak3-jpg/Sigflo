import { calculateSetupScore } from '@/lib/setupScore';
import type { DetectorInput, SignalCandidate } from '@/engine/types';

function bestCandidate(a: SignalCandidate | null, b: SignalCandidate | null): SignalCandidate | null {
  if (!a) return b;
  if (!b) return a;
  return a.setupScore >= b.setupScore ? a : b;
}

export function pickBestDirectionalPair(
  longCandidate: SignalCandidate | null,
  shortCandidate: SignalCandidate | null,
): SignalCandidate | null {
  return bestCandidate(longCandidate, shortCandidate);
}

function trendLabel(ema20: number, ema50: number): 'bullish' | 'bearish' | 'neutral' {
  if (ema20 > ema50) return 'bullish';
  if (ema20 < ema50) return 'bearish';
  return 'neutral';
}

function volumeRatio(lastVolume: number, avgVolume20: number): number {
  return avgVolume20 <= 0 ? 0 : lastVolume / avgVolume20;
}

export function detectBreakoutPressure(input: DetectorInput): SignalCandidate | null {
  if (input.candles.length < 60 || !input.lastCandleClosed) return null;
  const last = input.candles.at(-1);
  if (!last) return null;
  const { indicators } = input;
  const volRatio = volumeRatio(last.volume, indicators.avgVolume20);
  const bullishTrend = indicators.ema20 > indicators.ema50 && indicators.ema20Slope > 0;
  const nearBreakout = indicators.breakoutDistanceAtr <= 0.45;
  const rsiHealthy = indicators.rsi14 >= 55 && indicators.rsi14 <= 72;
  const momentumPositive = indicators.rsi14Slope >= -0.5;
  const passes = [bullishTrend, nearBreakout, rsiHealthy, momentumPositive, volRatio >= 1.15].filter(Boolean).length;
  if (passes < 4) return null;

  const scoreBreakdown = {
    trendAlignment: bullishTrend ? 23 : 12,
    momentumQuality: rsiHealthy ? 16 : 10,
    structureQuality: nearBreakout ? 21 : 12,
    volumeConfirmation: volRatio >= 1.25 ? 14 : 10,
    riskConditions: indicators.breakoutDistanceAtr <= 0.25 ? 13 : 10,
  };

  return {
    symbol: input.symbol,
    setupType: 'breakout',
    directionBias: 'long',
    biasLabel: 'Breakout pressure building',
    tags: ['Breakout'],
    scoreBreakdown,
    setupScore: calculateSetupScore(scoreBreakdown),
    explanationFacts: {
      emaTrend: trendLabel(indicators.ema20, indicators.ema50),
      rsi: indicators.rsi14,
      rsiSlope: indicators.rsi14Slope,
      volumeRatio: volRatio,
      breakoutDistanceAtr: indicators.breakoutDistanceAtr,
      pullbackDepthAtr: indicators.pullbackDepthAtr,
      extensionAtr: Math.abs((last.close - indicators.ema20) / indicators.atr14),
    },
    confirmedOnClosedCandle: true,
    timestamp: last.ts,
  };
}

export function detectPullbackContinuation(input: DetectorInput): SignalCandidate | null {
  if (input.candles.length < 60 || !input.lastCandleClosed) return null;
  const last = input.candles.at(-1);
  if (!last) return null;
  const { indicators } = input;
  const volRatio = volumeRatio(last.volume, indicators.avgVolume20);
  const trendUp = indicators.ema20 > indicators.ema50;
  const inPullbackZone = indicators.pullbackDepthAtr >= -0.2 && indicators.pullbackDepthAtr <= 1.5;
  const momentumRecovering = indicators.rsi14 >= 45 && indicators.rsi14 <= 62 && indicators.rsi14Slope > 0;
  const pullbackVolumeCooled = volRatio <= 1.05;
  const passes = [trendUp, inPullbackZone, momentumRecovering, pullbackVolumeCooled].filter(Boolean).length;
  if (passes < 3) return null;

  const scoreBreakdown = {
    trendAlignment: trendUp ? 22 : 10,
    momentumQuality: momentumRecovering ? 15 : 9,
    structureQuality: inPullbackZone ? 22 : 12,
    volumeConfirmation: pullbackVolumeCooled ? 12 : 7,
    riskConditions: indicators.pullbackDepthAtr <= 1.1 ? 12 : 8,
  };

  return {
    symbol: input.symbol,
    setupType: 'pullback',
    directionBias: 'long',
    biasLabel: 'Pullback continuation setup',
    tags: ['Pullback'],
    scoreBreakdown,
    setupScore: calculateSetupScore(scoreBreakdown),
    explanationFacts: {
      emaTrend: trendLabel(indicators.ema20, indicators.ema50),
      rsi: indicators.rsi14,
      rsiSlope: indicators.rsi14Slope,
      volumeRatio: volRatio,
      breakoutDistanceAtr: indicators.breakoutDistanceAtr,
      pullbackDepthAtr: indicators.pullbackDepthAtr,
      extensionAtr: Math.abs((last.close - indicators.ema20) / indicators.atr14),
    },
    confirmedOnClosedCandle: true,
    timestamp: last.ts,
  };
}

export function detectOverextendedWarning(input: DetectorInput): SignalCandidate | null {
  if (input.candles.length < 60 || !input.lastCandleClosed) return null;
  const last = input.candles.at(-1);
  if (!last) return null;
  const { indicators } = input;
  const extensionAtr = Math.abs((last.close - indicators.ema20) / indicators.atr14);
  const volRatio = volumeRatio(last.volume, indicators.avgVolume20);
  const overextended = extensionAtr >= 1.8;
  const hotRsi = indicators.rsi14 >= 74;
  const nearResistance = indicators.breakoutDistanceAtr <= 0.4;
  const passes = [overextended, hotRsi, nearResistance || volRatio > 1.4].filter(Boolean).length;
  if (passes < 2) return null;

  const scoreBreakdown = {
    trendAlignment: 8,
    momentumQuality: hotRsi ? 5 : 8,
    structureQuality: nearResistance ? 7 : 10,
    volumeConfirmation: volRatio > 1.2 ? 7 : 10,
    riskConditions: 2,
  };

  return {
    symbol: input.symbol,
    setupType: 'overextended',
    directionBias: 'long',
    biasLabel: 'Overextended long — late chase risk',
    tags: ['Overextended'],
    scoreBreakdown,
    setupScore: calculateSetupScore(scoreBreakdown),
    explanationFacts: {
      emaTrend: trendLabel(indicators.ema20, indicators.ema50),
      rsi: indicators.rsi14,
      rsiSlope: indicators.rsi14Slope,
      volumeRatio: volRatio,
      breakoutDistanceAtr: indicators.breakoutDistanceAtr,
      pullbackDepthAtr: indicators.pullbackDepthAtr,
      extensionAtr,
    },
    confirmedOnClosedCandle: true,
    timestamp: last.ts,
  };
}

export function detectBreakdownPressure(input: DetectorInput): SignalCandidate | null {
  if (input.candles.length < 60 || !input.lastCandleClosed) return null;
  const last = input.candles.at(-1);
  if (!last) return null;
  const { indicators } = input;
  const volRatio = volumeRatio(last.volume, indicators.avgVolume20);
  const bearishTrend = indicators.ema20 < indicators.ema50 && indicators.ema20Slope < 0;
  const nearBreakdown =
    indicators.breakdownDistanceAtr >= 0 && indicators.breakdownDistanceAtr <= 0.45;
  const rsiWeak = indicators.rsi14 >= 28 && indicators.rsi14 <= 45;
  const momentumNegative = indicators.rsi14Slope <= 0.5;
  const passes = [bearishTrend, nearBreakdown, rsiWeak, momentumNegative, volRatio >= 1.15].filter(Boolean).length;
  if (passes < 4) return null;

  const scoreBreakdown = {
    trendAlignment: bearishTrend ? 23 : 12,
    momentumQuality: rsiWeak ? 16 : 10,
    structureQuality: nearBreakdown ? 21 : 12,
    volumeConfirmation: volRatio >= 1.25 ? 14 : 10,
    riskConditions: indicators.breakdownDistanceAtr <= 0.25 ? 13 : 10,
  };

  return {
    symbol: input.symbol,
    setupType: 'breakout',
    directionBias: 'short',
    biasLabel: 'Breakdown pressure building',
    tags: ['Breakout'],
    scoreBreakdown,
    setupScore: calculateSetupScore(scoreBreakdown),
    explanationFacts: {
      emaTrend: trendLabel(indicators.ema20, indicators.ema50),
      rsi: indicators.rsi14,
      rsiSlope: indicators.rsi14Slope,
      volumeRatio: volRatio,
      breakoutDistanceAtr: indicators.breakdownDistanceAtr,
      pullbackDepthAtr: indicators.bounceDepthAtr,
      extensionAtr: Math.abs((last.close - indicators.ema20) / indicators.atr14),
    },
    confirmedOnClosedCandle: true,
    timestamp: last.ts,
  };
}

export function detectPullbackContinuationShort(input: DetectorInput): SignalCandidate | null {
  if (input.candles.length < 60 || !input.lastCandleClosed) return null;
  const last = input.candles.at(-1);
  if (!last) return null;
  const { indicators } = input;
  const volRatio = volumeRatio(last.volume, indicators.avgVolume20);
  const trendDown = indicators.ema20 < indicators.ema50;
  const inBounceZone = indicators.bounceDepthAtr >= -0.3 && indicators.bounceDepthAtr <= 1.5;
  const momentumFading = indicators.rsi14 >= 40 && indicators.rsi14 <= 58 && indicators.rsi14Slope <= 0;
  const bounceVolumeCooled = volRatio <= 1.05;
  const passes = [trendDown, inBounceZone, momentumFading, bounceVolumeCooled].filter(Boolean).length;
  if (passes < 3) return null;

  const scoreBreakdown = {
    trendAlignment: trendDown ? 22 : 10,
    momentumQuality: momentumFading ? 15 : 9,
    structureQuality: inBounceZone ? 22 : 12,
    volumeConfirmation: bounceVolumeCooled ? 12 : 7,
    riskConditions: indicators.bounceDepthAtr <= 1.1 ? 12 : 8,
  };

  return {
    symbol: input.symbol,
    setupType: 'pullback',
    directionBias: 'short',
    biasLabel: 'Pullback short — bounce fading',
    tags: ['Pullback'],
    scoreBreakdown,
    setupScore: calculateSetupScore(scoreBreakdown),
    explanationFacts: {
      emaTrend: trendLabel(indicators.ema20, indicators.ema50),
      rsi: indicators.rsi14,
      rsiSlope: indicators.rsi14Slope,
      volumeRatio: volRatio,
      breakoutDistanceAtr: indicators.breakdownDistanceAtr,
      pullbackDepthAtr: indicators.bounceDepthAtr,
      extensionAtr: Math.abs((last.close - indicators.ema20) / indicators.atr14),
    },
    confirmedOnClosedCandle: true,
    timestamp: last.ts,
  };
}

export function detectOverextendedShort(input: DetectorInput): SignalCandidate | null {
  if (input.candles.length < 60 || !input.lastCandleClosed) return null;
  const last = input.candles.at(-1);
  if (!last) return null;
  const { indicators } = input;
  const extensionAtr = Math.abs((last.close - indicators.ema20) / indicators.atr14);
  const volRatio = volumeRatio(last.volume, indicators.avgVolume20);
  const belowMean = last.close < indicators.ema20;
  const overextended = extensionAtr >= 1.8 && belowMean;
  const coldRsi = indicators.rsi14 < 26;
  const nearSupport = indicators.breakdownDistanceAtr <= 0.4;
  const c3 = input.candles.slice(-3);
  const drop3 = c3.length >= 3 ? c3[0].open - c3[2].close : 0;
  const expansionOk = indicators.atr14 > 0 && drop3 / indicators.atr14 > 1.5;
  const passes = [overextended, coldRsi, nearSupport || volRatio > 1.4, expansionOk].filter(Boolean).length;
  if (passes < 3) return null;

  const scoreBreakdown = {
    trendAlignment: 8,
    momentumQuality: coldRsi ? 5 : 8,
    structureQuality: nearSupport ? 7 : 10,
    volumeConfirmation: volRatio > 1.2 ? 7 : 10,
    riskConditions: 2,
  };

  return {
    symbol: input.symbol,
    setupType: 'overextended',
    directionBias: 'short',
    biasLabel: 'Overextended short — squeeze risk',
    tags: ['Overextended'],
    scoreBreakdown,
    setupScore: calculateSetupScore(scoreBreakdown),
    explanationFacts: {
      emaTrend: trendLabel(indicators.ema20, indicators.ema50),
      rsi: indicators.rsi14,
      rsiSlope: indicators.rsi14Slope,
      volumeRatio: volRatio,
      breakoutDistanceAtr: indicators.breakdownDistanceAtr,
      pullbackDepthAtr: indicators.pullbackDepthAtr,
      extensionAtr,
    },
    confirmedOnClosedCandle: true,
    timestamp: last.ts,
  };
}
