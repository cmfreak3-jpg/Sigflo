import type { CryptoSignal, SetupScoreBreakdown, SetupScoreLabel } from '@/types/signal';

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function calculateSetupScore(b: SetupScoreBreakdown): number {
  const trend = clamp(b.trendAlignment, 0, 25);
  const momentum = clamp(b.momentumQuality, 0, 20);
  const structure = clamp(b.structureQuality, 0, 25);
  const volume = clamp(b.volumeConfirmation, 0, 15);
  const risk = clamp(b.riskConditions, 0, 15);
  return Math.min(100, trend + momentum + structure + volume + risk);
}

export function getSetupScoreLabel(score: number): SetupScoreLabel {
  if (score >= 85) return 'Elite setup';
  if (score >= 70) return 'Strong setup';
  if (score >= 55) return 'Developing';
  if (score >= 40) return 'Low quality';
  return 'Avoid';
}

/** UI caption: structural state (overextended) overrides the numeric score band label. */
export function displaySetupScoreCaption(
  signal: Pick<CryptoSignal, 'setupType' | 'setupScoreLabel'>,
  opts?: { rowOverextended?: boolean },
): string {
  if (signal.setupType === 'overextended' || opts?.rowOverextended) {
    return 'Risky / Exhausted';
  }
  return signal.setupScoreLabel;
}

/** Compact band for headers, e.g. "Strong" from Strong setup. */
export function setupScoreBandShort(signal: Pick<CryptoSignal, 'setupType' | 'setupScore'>): string {
  if (signal.setupType === 'overextended') return 'Risky / Exhausted';
  const full = getSetupScoreLabel(signal.setupScore);
  return full.replace(/\s+setup$/i, '').replace(/\s+quality$/i, '');
}
