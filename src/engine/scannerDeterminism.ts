import { runScannerPipeline } from '@/engine/scannerPipeline';
import { buildScannerLabFixtureInput } from '@/engine/scannerFixtures';
import type { EmittedSignalStateMap, SignalCandidate } from '@/engine/types';

export interface ScannerDeterminismFrame {
  run: number;
  acceptedCount: number;
  candidateCount: number;
  accepted: Array<Pick<SignalCandidate, 'symbol' | 'setupType' | 'setupScore' | 'tags'>>;
}

export interface ScannerDeterminismResult {
  firstPass: ScannerDeterminismFrame;
  secondPass: ScannerDeterminismFrame;
}

function toFrame(run: number, accepted: SignalCandidate[], allCandidates: SignalCandidate[]): ScannerDeterminismFrame {
  return {
    run,
    acceptedCount: accepted.length,
    candidateCount: allCandidates.length,
    accepted: accepted.map((s) => ({
      symbol: s.symbol,
      setupType: s.setupType,
      setupScore: s.setupScore,
      tags: s.tags,
    })),
  };
}

/**
 * Deterministic dry-run for local development (scanner pipeline + filter state).
 * - Run 1: emits valid signals
 * - Run 2: cooldown / dedup behavior
 */
export function runScannerDeterminismCheck(): ScannerDeterminismResult {
  const marketBySymbol = buildScannerLabFixtureInput();
  const first = runScannerPipeline({
    marketBySymbol,
    filterConfig: { minSetupScore: 55, cooldownMs: 45 * 60 * 1000, minScoreImprovement: 8 },
  });

  const state: EmittedSignalStateMap = first.nextState;
  const second = runScannerPipeline({
    marketBySymbol,
    previousState: state,
    filterConfig: { minSetupScore: 55, cooldownMs: 45 * 60 * 1000, minScoreImprovement: 8 },
  });

  return {
    firstPass: toFrame(1, first.acceptedSignals, first.allCandidates),
    secondPass: toFrame(2, second.acceptedSignals, second.allCandidates),
  };
}
