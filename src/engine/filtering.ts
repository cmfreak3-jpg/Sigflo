import type {
  EmittedSignalState,
  EmittedSignalStateMap,
  ScannerFilterConfig,
  SignalCandidate,
} from '@/engine/types';

function signalKey(candidate: SignalCandidate): string {
  return `${candidate.symbol}:${candidate.setupType}`;
}

function shouldEmitByDedup(
  candidate: SignalCandidate,
  previous: EmittedSignalState | undefined,
  cfg: ScannerFilterConfig
): boolean {
  if (!previous) return true;
  const cooldownElapsed = candidate.timestamp - previous.lastEmittedAt >= cfg.cooldownMs;
  const materiallyImproved = candidate.setupScore - previous.lastSetupScore >= cfg.minScoreImprovement;
  return cooldownElapsed || materiallyImproved;
}

export function applySignalQualityControls(
  candidates: SignalCandidate[],
  previousState: EmittedSignalStateMap,
  cfg: ScannerFilterConfig
): { accepted: SignalCandidate[]; nextState: EmittedSignalStateMap } {
  const nextState = { ...previousState };
  const accepted: SignalCandidate[] = [];

  for (const candidate of candidates) {
    if (!candidate.confirmedOnClosedCandle) continue;
    if (candidate.setupScore < cfg.minSetupScore) continue;
    const key = signalKey(candidate);
    const previous = nextState[key];
    if (!shouldEmitByDedup(candidate, previous, cfg)) continue;
    accepted.push(candidate);
    nextState[key] = {
      lastEmittedAt: candidate.timestamp,
      lastSetupScore: candidate.setupScore,
    };
  }

  return { accepted, nextState };
}
