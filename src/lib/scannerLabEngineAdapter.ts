import {
  detectBreakdownPressure,
  detectBreakoutPressure,
  detectOverextendedShort,
  detectOverextendedWarning,
  detectPullbackContinuation,
  detectPullbackContinuationShort,
  pickBestDirectionalPair,
} from '@/engine/detectors';
import { deriveIndicatorSnapshot } from '@/engine/indicators';
import type { Candle as EngineCandle, IndicatorSnapshot, SignalCandidate as EngineSignalCandidate } from '@/engine/types';
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

/** Lab-shaped candidate (playback / UI); rules come from `@/engine/detectors`. */
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

/** Kept on playback config for API stability; engine uses fixed production thresholds. */
export type DetectorOptions = {
  useVolumeFilter: boolean;
  useRsiFilter: boolean;
  compressionThreshold: number;
};

export const DEFAULT_DETECTOR_OPTIONS: DetectorOptions = {
  useVolumeFilter: true,
  useRsiFilter: true,
  compressionThreshold: 1.4,
};

/** Same minimum bar count as `src/engine/detectors.ts` detectors. */
export const MIN_ENGINE_BARS = 60;

export function playbackCandlesToEngine(candles: PlaybackCandle[]): EngineCandle[] {
  return candles.map((c) => ({
    ts: c.timestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
    isClosed: c.isClosed,
  }));
}

export function engineSnapshotToDerivedIndicators(snap: IndicatorSnapshot): DerivedIndicators {
  return {
    ema20: snap.ema20,
    ema50: snap.ema50,
    rsi14: snap.rsi14,
    atr14: snap.atr14,
    avgVolume20: snap.avgVolume20,
    swingHigh: snap.localSwingHigh,
    swingLow: snap.localSwingLow,
    breakoutDistance: snap.breakoutDistanceAtr,
    pullbackDepth: snap.pullbackDepthAtr,
  };
}

function explanationFactsToRecord(facts: EngineSignalCandidate['explanationFacts']): Record<string, number | string | boolean> {
  return {
    emaTrend: facts.emaTrend,
    rsi: facts.rsi,
    rsiSlope: facts.rsiSlope,
    volumeRatio: facts.volumeRatio,
    breakoutDistanceAtr: facts.breakoutDistanceAtr,
    pullbackDepthAtr: facts.pullbackDepthAtr,
    extensionAtr: facts.extensionAtr,
  };
}

function engineToLabCandidate(e: EngineSignalCandidate): SignalCandidate {
  return {
    setupType: e.setupType,
    directionBias: e.directionBias,
    scoreBreakdown: e.scoreBreakdown,
    setupScore: e.setupScore,
    tags: [...e.tags],
    explanationFacts: explanationFactsToRecord(e.explanationFacts),
  };
}

function evaluationFromEngine(
  setupType: SetupType,
  engineResult: EngineSignalCandidate | null,
  lastClosed: boolean,
  barCount: number,
): DetectorEvaluation {
  if (barCount < MIN_ENGINE_BARS) {
    return {
      triggered: false,
      setupType,
      reasons: [`Need at least ${MIN_ENGINE_BARS} candles in window (engine parity)`],
    };
  }
  if (!lastClosed) {
    return {
      triggered: false,
      setupType,
      reasons: ['Last candle is not closed'],
    };
  }
  if (!engineResult) {
    return {
      triggered: false,
      setupType,
      reasons: ['Engine: long/short pair did not qualify on this bar'],
    };
  }
  const labCand = engineToLabCandidate(engineResult);
  return {
    triggered: true,
    setupType,
    reasons: [`${engineResult.biasLabel} — closed bar (engine)`],
    scoreBreakdown: labCand.scoreBreakdown,
    explanationFacts: labCand.explanationFacts,
    candidate: labCand,
  };
}

/**
 * Indicators + three detector rows using the same rules as `runScannerPipeline` / live Bybit path.
 */
export function runScannerLabEngineEvaluations(symbol: string, visible: PlaybackCandle[]): {
  indicators: DerivedIndicators;
  evaluations: DetectorEvaluation[];
} {
  const engineCandles = playbackCandlesToEngine(visible);
  const snap = deriveIndicatorSnapshot(engineCandles);
  const indicators = engineSnapshotToDerivedIndicators(snap);
  const last = visible.at(-1);
  const lastClosed = Boolean(last?.isClosed);

  const di = {
    symbol,
    candles: engineCandles,
    indicators: snap,
    lastCandleClosed: lastClosed,
  };

  const breakout = pickBestDirectionalPair(detectBreakoutPressure(di), detectBreakdownPressure(di));
  const pullback = pickBestDirectionalPair(detectPullbackContinuation(di), detectPullbackContinuationShort(di));
  const overextended = pickBestDirectionalPair(detectOverextendedWarning(di), detectOverextendedShort(di));

  const n = visible.length;
  return {
    indicators,
    evaluations: [
      evaluationFromEngine('breakout', breakout, lastClosed, n),
      evaluationFromEngine('pullback', pullback, lastClosed, n),
      evaluationFromEngine('overextended', overextended, lastClosed, n),
    ],
  };
}

/** Snapshot for any window length (charts / seed panel); detectors still need {@link MIN_ENGINE_BARS}. */
export function deriveIndicators(candles: PlaybackCandle[]): DerivedIndicators {
  return engineSnapshotToDerivedIndicators(deriveIndicatorSnapshot(playbackCandlesToEngine(candles)));
}
