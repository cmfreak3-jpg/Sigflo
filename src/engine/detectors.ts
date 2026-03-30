import { calculateSetupScore } from '@/lib/setupScore';
import type { DetectorInput, SignalCandidate } from '@/engine/types';

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
    directionBias: 'short',
    biasLabel: 'Overextended warning',
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
