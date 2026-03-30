import { detectBreakoutPressure, detectOverextendedWarning, detectPullbackContinuation } from '@/engine/detectors';
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
 * Rules-first scanner runner.
 * - Deterministic: all outputs depend only on candle data + explicit thresholds.
 * - AI is intentionally excluded here; it should consume explanationFacts after signal creation.
 */
export function runMockScanner(input: ScannerInput): ScannerOutput {
  const cfg = { ...DEFAULT_FILTER_CONFIG, ...input.filterConfig };
  const allCandidates: SignalCandidate[] = [];

  for (const [symbol, series] of Object.entries(input.marketBySymbol)) {
    const candles15m = series['15m'];
    if (!candles15m || candles15m.length < 60) continue;
    const lastClosed = candles15m.at(-1)?.isClosed ?? true;
    const indicators = deriveIndicatorSnapshot(candles15m);
    const detectorInput = { symbol, candles: candles15m, indicators, lastCandleClosed: lastClosed };
    const candidates = [
      detectBreakoutPressure(detectorInput),
      detectPullbackContinuation(detectorInput),
      detectOverextendedWarning(detectorInput),
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

/**
 * Future integration points (Bybit):
 * 1) REST backfill:
 *    - fetch recent klines for each symbol/interval
 *    - map to CandleSeriesByInterval and call runMockScanner()
 * 2) WebSocket live updates:
 *    - subscribe to kline streams
 *    - append/update in-memory candle stores per symbol+interval
 *    - run scanner only when a candle closes (isClosed=true)
 * 3) AI explanation layer:
 *    - send SignalCandidate.explanationFacts to a narration endpoint
 *    - keep rule output immutable; AI only provides wording
 */
