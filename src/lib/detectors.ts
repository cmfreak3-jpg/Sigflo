/**
 * Scanner Lab / playback types + indicator helper.
 * Detection rules live in `@/engine/detectors` — use `runScannerLabEngineEvaluations` from
 * `scannerLabEngineAdapter` (re-exported below) for parity with production.
 */
export type {
  SetupType,
  DerivedIndicators,
  SignalCandidate,
  DetectorEvaluation,
  DetectorOptions,
} from '@/lib/scannerLabEngineAdapter';

export {
  DEFAULT_DETECTOR_OPTIONS,
  MIN_ENGINE_BARS,
  deriveIndicators,
  engineSnapshotToDerivedIndicators,
  playbackCandlesToEngine,
  runScannerLabEngineEvaluations,
} from '@/lib/scannerLabEngineAdapter';
