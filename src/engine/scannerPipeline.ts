import {
  detectBreakdownPressure,
  detectBreakoutPressure,
  detectOverextendedShort,
  detectOverextendedWarning,
  detectPullbackContinuation,
  detectPullbackContinuationShort,
  pickBestDirectionalPair,
} from '@/engine/detectors';
import { applySignalQualityControls } from '@/engine/filtering';
import { deriveIndicatorSnapshot } from '@/engine/indicators';
import type {
  CandleSeriesByInterval,
  EmittedSignalStateMap,
  ScannerFilterConfig,
  SignalCandidate,
} from '@/engine/types';

export interface ScannerInput {
  marketBySymbol: Record<string, CandleSeriesByInterval>;
  previousState?: EmittedSignalStateMap;
  filterConfig?: Partial<ScannerFilterConfig>;
}

export interface ScannerOutput {
  acceptedSignals: SignalCandidate[];
  allCandidates: SignalCandidate[];
  nextState: EmittedSignalStateMap;
}

const DEFAULT_FILTER_CONFIG: ScannerFilterConfig = {
  minSetupScore: 60,
  cooldownMs: 30 * 60 * 1000,
  minScoreImprovement: 8,
};

/**
 * Rules-first scanner pipeline (deterministic: outputs depend only on candles + thresholds).
 * Live path uses Bybit REST/WS data into the same shapes; AI consumes explanationFacts after signal creation.
 */
export function runScannerPipeline(input: ScannerInput): ScannerOutput {
  const cfg = { ...DEFAULT_FILTER_CONFIG, ...input.filterConfig };
  const allCandidates: SignalCandidate[] = [];

  for (const [symbol, series] of Object.entries(input.marketBySymbol)) {
    const candles15m = series['15m'];
    if (!candles15m || candles15m.length < 60) continue;
    const lastClosed = candles15m.at(-1)?.isClosed ?? true;
    const indicators = deriveIndicatorSnapshot(candles15m);
    const detectorInput = { symbol, candles: candles15m, indicators, lastCandleClosed: lastClosed };
    const candidates = [
      pickBestDirectionalPair(detectBreakoutPressure(detectorInput), detectBreakdownPressure(detectorInput)),
      pickBestDirectionalPair(
        detectPullbackContinuation(detectorInput),
        detectPullbackContinuationShort(detectorInput),
      ),
      pickBestDirectionalPair(detectOverextendedWarning(detectorInput), detectOverextendedShort(detectorInput)),
    ].filter((s): s is SignalCandidate => Boolean(s));
    allCandidates.push(...candidates);
  }

  const { accepted, nextState } = applySignalQualityControls(
    allCandidates,
    input.previousState ?? {},
    cfg
  );

  return {
    acceptedSignals: accepted.sort((a, b) => b.setupScore - a.setupScore),
    allCandidates,
    nextState,
  };
}
