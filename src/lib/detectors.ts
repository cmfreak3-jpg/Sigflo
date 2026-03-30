import { atr, ema, recentSwingHigh, recentSwingLow, rollingAvg, rsi } from '@/lib/indicators';
import { calculateSetupScore } from '@/lib/setupScore';
import type { PlaybackCandle } from '@/types/market';
import type { SetupScoreBreakdown, SignalSide } from '@/types/signal';

export type SetupType = 'breakout' | 'pullback' | 'overextended';

export type DerivedIndicators = {
  ema20: number;
  ema50: number;
  rsi14: number;
  atr14: number;
  avgVolume20: number;
  swingHigh: number;
  swingLow: number;
  breakoutDistance: number;
  pullbackDepth: number;
};

export type SignalCandidate = {
  setupType: SetupType;
  directionBias: SignalSide;
  scoreBreakdown: SetupScoreBreakdown;
  setupScore: number;
  tags: string[];
  explanationFacts: Record<string, number | string | boolean>;
};

export type DetectorEvaluation = {
  triggered: boolean;
  setupType: SetupType;
  reasons: string[];
  scoreBreakdown?: SetupScoreBreakdown;
  explanationFacts?: Record<string, number | string | boolean>;
  candidate?: SignalCandidate;
};

export type DetectorOptions = {
  useVolumeFilter: boolean;
  useRsiFilter: boolean;
  compressionThreshold: number;
};

const DEFAULT_DETECTOR_OPTIONS: DetectorOptions = {
  useVolumeFilter: true,
  useRsiFilter: true,
  compressionThreshold: 1.4,
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function resolveOptions(options?: Partial<DetectorOptions>): DetectorOptions {
  return { ...DEFAULT_DETECTOR_OPTIONS, ...options };
}

export function deriveIndicators(candles: PlaybackCandle[]): DerivedIndicators {
  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);
  const ema20Series = ema(closes, 20);
  const ema50Series = ema(closes, 50);
  const rsi14Series = rsi(closes, 14);
  const atr14Series = atr(
    candles.map((c) => ({
      ts: c.timestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      isClosed: c.isClosed,
    })),
    14
  );
  const avgVol = rollingAvg(volumes, 20);

  const close = closes.at(-1) ?? 0;
  const atrNow = Math.max(0.000001, atr14Series.at(-1) ?? 0);
  const swingHigh = recentSwingHigh(
    candles.map((c) => ({ ts: c.timestamp, ...c })),
    Math.min(40, candles.length)
  );
  const swingLow = recentSwingLow(
    candles.map((c) => ({ ts: c.timestamp, ...c })),
    Math.min(40, candles.length)
  );

  return {
    ema20: ema20Series.at(-1) ?? close,
    ema50: ema50Series.at(-1) ?? close,
    rsi14: rsi14Series.at(-1) ?? 50,
    atr14: atrNow,
    avgVolume20: avgVol.at(-1) ?? 0,
    swingHigh,
    swingLow,
    breakoutDistance: (swingHigh - close) / atrNow,
    pullbackDepth: ((ema20Series.at(-1) ?? close) - close) / atrNow,
  };
}

function withCandidate(
  setupType: SetupType,
  directionBias: SignalSide,
  scoreBreakdown: SetupScoreBreakdown,
  tags: string[],
  explanationFacts: Record<string, number | string | boolean>,
  reasons: string[]
): DetectorEvaluation {
  return {
    triggered: true,
    setupType,
    reasons,
    scoreBreakdown,
    explanationFacts,
    candidate: {
      setupType,
      directionBias,
      scoreBreakdown,
      setupScore: calculateSetupScore(scoreBreakdown),
      tags,
      explanationFacts,
    },
  };
}

export function detectBreakoutPressure(
  candles: PlaybackCandle[],
  indicators: DerivedIndicators,
  options?: Partial<DetectorOptions>
): DetectorEvaluation {
  if (candles.length < 15) {
    return { triggered: false, setupType: 'breakout', reasons: ['Need at least 15 candles for breakout context'] };
  }
  const last = candles.at(-1);
  const prev = candles.at(-2);
  if (!last || !prev || !last.isClosed) {
    return { triggered: false, setupType: 'breakout', reasons: ['Last candle is not closed'] };
  }

  const volRatio = indicators.avgVolume20 > 0 ? last.volume / indicators.avgVolume20 : 0;
  const cfg = resolveOptions(options);
  const recent = candles.slice(-8);
  const compressionRatio =
    indicators.atr14 > 0
      ? recent.reduce((sum, c) => sum + (c.high - c.low), 0) / (recent.length * indicators.atr14)
      : 99;
  const compressionOk = compressionRatio <= cfg.compressionThreshold;
  const trendOk = last.close > indicators.ema20 && indicators.ema20 > indicators.ema50;
  const rsiOk = !cfg.useRsiFilter || (indicators.rsi14 >= 55 && indicators.rsi14 <= 72);
  const nearBreakout = indicators.breakoutDistance >= -0.1 && indicators.breakoutDistance <= 0.45;
  const momentumOk = last.close >= prev.close;
  const volumeOk = !cfg.useVolumeFilter || volRatio >= 1.15;

  const reasons: string[] = [];
  if (!trendOk) reasons.push('trend alignment failed (close/ema20/ema50)');
  if (!compressionOk) reasons.push('range not tight enough');
  if (!rsiOk) reasons.push(cfg.useRsiFilter ? 'RSI outside breakout band (55-72)' : 'RSI filter disabled');
  if (!nearBreakout) reasons.push('distance to breakout too large');
  if (!volumeOk) reasons.push(cfg.useVolumeFilter ? 'volume too low' : 'volume filter disabled');
  if (!momentumOk) reasons.push('latest close not confirming upward momentum');

  const checks = [
    { name: 'trend', enabled: true, pass: trendOk },
    { name: 'compression', enabled: true, pass: compressionOk },
    { name: 'rsi', enabled: cfg.useRsiFilter, pass: rsiOk },
    { name: 'nearBreakout', enabled: true, pass: nearBreakout },
    { name: 'volume', enabled: cfg.useVolumeFilter, pass: volumeOk },
    { name: 'momentum', enabled: true, pass: momentumOk },
  ];
  const enabledChecks = checks.filter((c) => c.enabled);
  const passCount = enabledChecks.filter((c) => c.pass).length;
  const requiredPasses = Math.max(3, enabledChecks.length - 1);
  const scoreBreakdown: SetupScoreBreakdown = {
    trendAlignment: trendOk ? 22 : 13,
    momentumQuality: clamp(Math.round(((indicators.rsi14 - 50) / 22) * 20), 8, 18),
    structureQuality: clamp(
      Math.round(
        ((nearBreakout ? 0.55 : 0.25) + (compressionOk ? 0.45 : Math.max(0, 0.45 - (compressionRatio - cfg.compressionThreshold) * 0.35))) *
          25
      ),
      9,
      22
    ),
    volumeConfirmation: clamp(Math.round(Math.min(2, volRatio) / 2 * 15), 7, 14),
    riskConditions: indicators.breakoutDistance <= 0.2 ? 12 : 9,
  };
  const explanationFacts = {
    volumeRatio: Number(volRatio.toFixed(2)),
    compressionRatio: Number(compressionRatio.toFixed(2)),
    compressionThreshold: Number(cfg.compressionThreshold.toFixed(2)),
    breakoutDistance: Number(indicators.breakoutDistance.toFixed(2)),
    rsi: Number(indicators.rsi14.toFixed(1)),
    ema20: Number(indicators.ema20.toFixed(2)),
    ema50: Number(indicators.ema50.toFixed(2)),
  };
  if (passCount < requiredPasses) {
    return {
      triggered: false,
      setupType: 'breakout',
      reasons,
      scoreBreakdown,
      explanationFacts,
    };
  }

  return withCandidate(
    'breakout',
    'long',
    scoreBreakdown,
    ['Breakout'],
    explanationFacts,
    ['breakout pressure confirmed on closed candle']
  );
}

export function detectPullbackContinuation(
  candles: PlaybackCandle[],
  indicators: DerivedIndicators,
  options?: Partial<DetectorOptions>
): DetectorEvaluation {
  if (candles.length < 15) {
    return { triggered: false, setupType: 'pullback', reasons: ['Need at least 15 candles for pullback context'] };
  }
  const last = candles.at(-1);
  if (!last || !last.isClosed) return { triggered: false, setupType: 'pullback', reasons: ['Last candle is not closed'] };

  const cfg = resolveOptions(options);
  const trendUp = indicators.ema20 > indicators.ema50;
  const pullbackInZone = indicators.pullbackDepth >= -0.2 && indicators.pullbackDepth <= 1.5;
  const rsiRecovering = !cfg.useRsiFilter || (indicators.rsi14 >= 45 && indicators.rsi14 <= 60);
  const volRatio = indicators.avgVolume20 > 0 ? last.volume / indicators.avgVolume20 : 0;
  const pullbackVolCool = !cfg.useVolumeFilter || volRatio <= 1.05;

  const reasons: string[] = [];
  if (!trendUp) reasons.push('trend not aligned for continuation');
  if (!pullbackInZone) reasons.push('pullback depth outside preferred range');
  if (!rsiRecovering) reasons.push(cfg.useRsiFilter ? 'RSI not in recovery zone (45-60)' : 'RSI filter disabled');
  if (!pullbackVolCool) reasons.push(cfg.useVolumeFilter ? 'pullback volume not cooled' : 'volume filter disabled');

  const checks = [
    { enabled: true, pass: trendUp },
    { enabled: true, pass: pullbackInZone },
    { enabled: cfg.useRsiFilter, pass: rsiRecovering },
    { enabled: cfg.useVolumeFilter, pass: pullbackVolCool },
  ];
  const enabledChecks = checks.filter((c) => c.enabled);
  const passCount = enabledChecks.filter((c) => c.pass).length;
  const requiredPasses = Math.max(2, enabledChecks.length - 1);
  const scoreBreakdown: SetupScoreBreakdown = {
    trendAlignment: trendUp ? 21 : 12,
    momentumQuality: rsiRecovering ? 15 : 9,
    structureQuality: pullbackInZone ? 22 : 11,
    volumeConfirmation: pullbackVolCool ? 12 : 7,
    riskConditions: indicators.pullbackDepth <= 1.1 ? 12 : 8,
  };
  const explanationFacts = {
    volumeRatio: Number(volRatio.toFixed(2)),
    pullbackDepth: Number(indicators.pullbackDepth.toFixed(2)),
    rsi: Number(indicators.rsi14.toFixed(1)),
  };
  if (passCount < requiredPasses) {
    return {
      triggered: false,
      setupType: 'pullback',
      reasons,
      scoreBreakdown,
      explanationFacts,
    };
  }

  return withCandidate(
    'pullback',
    'long',
    scoreBreakdown,
    ['Pullback'],
    explanationFacts,
    ['pullback continuation setup confirmed on closed candle']
  );
}

export function detectOverextendedWarning(
  candles: PlaybackCandle[],
  indicators: DerivedIndicators,
  options?: Partial<DetectorOptions>
): DetectorEvaluation {
  if (candles.length < 15) {
    return { triggered: false, setupType: 'overextended', reasons: ['Need at least 15 candles for overextended context'] };
  }
  const last = candles.at(-1);
  if (!last || !last.isClosed) {
    return { triggered: false, setupType: 'overextended', reasons: ['Last candle is not closed'] };
  }

  const cfg = resolveOptions(options);
  const extensionAtr = Math.abs(last.close - indicators.ema20) / Math.max(indicators.atr14, 0.000001);
  const hotRsi = !cfg.useRsiFilter || indicators.rsi14 >= 74;
  const expansion = candles.length >= 3 ? (last.close - candles[candles.length - 3].open) / indicators.atr14 : 0;
  const expansionOk = expansion >= 1.5;
  const nearResistance = indicators.breakoutDistance <= 0.4;

  const reasons: string[] = [];
  if (extensionAtr < 1.8) reasons.push('extension from EMA20 not large enough');
  if (!hotRsi) reasons.push(cfg.useRsiFilter ? 'RSI not hot enough (>74)' : 'RSI filter disabled');
  if (!expansionOk) reasons.push('recent expansion too weak');
  if (!nearResistance) reasons.push('not near local resistance');

  const checks = [
    { enabled: true, pass: extensionAtr >= 1.8 },
    { enabled: cfg.useRsiFilter, pass: hotRsi },
    { enabled: true, pass: expansionOk },
    { enabled: true, pass: nearResistance },
  ];
  const enabledChecks = checks.filter((c) => c.enabled);
  const passCount = enabledChecks.filter((c) => c.pass).length;
  const requiredPasses = Math.max(2, enabledChecks.length - 1);
  const scoreBreakdown: SetupScoreBreakdown = {
    trendAlignment: 14,
    momentumQuality: hotRsi ? 15 : 11,
    structureQuality: nearResistance ? 13 : 10,
    volumeConfirmation: 9,
    riskConditions: 12,
  };
  const explanationFacts = {
    extensionAtr: Number(extensionAtr.toFixed(2)),
    rsi: Number(indicators.rsi14.toFixed(1)),
    expansionAtr: Number(expansion.toFixed(2)),
    distanceToResistance: Number(indicators.breakoutDistance.toFixed(2)),
  };
  if (passCount < requiredPasses) {
    return {
      triggered: false,
      setupType: 'overextended',
      reasons,
      scoreBreakdown,
      explanationFacts,
    };
  }

  return withCandidate(
    'overextended',
    'short',
    scoreBreakdown,
    ['Overextended', 'High Risk'],
    explanationFacts,
    ['overextended warning confirmed on closed candle']
  );
}
