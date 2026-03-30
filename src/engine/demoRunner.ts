import { runMockScanner } from '@/engine/mockScannerRunner';
import { buildMockScannerInput } from '@/engine/mockFixtures';
import type { EmittedSignalStateMap, SignalCandidate } from '@/engine/types';

export interface ScannerDemoFrame {
  run: number;
  acceptedCount: number;
  candidateCount: number;
  accepted: Array<Pick<SignalCandidate, 'symbol' | 'setupType' | 'setupScore' | 'tags'>>;
}

export interface ScannerDemoResult {
  firstPass: ScannerDemoFrame;
  secondPass: ScannerDemoFrame;
}

function toFrame(run: number, accepted: SignalCandidate[], allCandidates: SignalCandidate[]): ScannerDemoFrame {
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
 * Deterministic dry-run helper for local development.
 * - Run 1: emits valid signals
 * - Run 2: demonstrates cooldown/dedup behavior
 */
export function runScannerDeterminismDemo(): ScannerDemoResult {
  const marketBySymbol = buildMockScannerInput();
  const first = runMockScanner({
    marketBySymbol,
    filterConfig: { minSetupScore: 55, cooldownMs: 45 * 60 * 1000, minScoreImprovement: 8 },
  });

  const state: EmittedSignalStateMap = first.nextState;
  const second = runMockScanner({
    marketBySymbol,
    previousState: state,
    filterConfig: { minSetupScore: 55, cooldownMs: 45 * 60 * 1000, minScoreImprovement: 8 },
  });

  return {
    firstPass: toFrame(1, first.acceptedSignals, first.allCandidates),
    secondPass: toFrame(2, second.acceptedSignals, second.allCandidates),
  };
}

