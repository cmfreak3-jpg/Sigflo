import type { CryptoSignal } from '@/types/signal';

function setupLabel(score: number): string {
  if (score >= 85) return 'Elite';
  if (score >= 70) return 'Strong';
  if (score >= 55) return 'OK';
  if (score >= 40) return 'Weak';
  return 'Avoid';
}

function riskShort(tag: string): string {
  return tag.replace(' Risk', '');
}

function actionLine(signal: CryptoSignal): string {
  if (signal.setupType === 'overextended') return 'Too aggressive — reduce size';
  if (signal.setupScore >= 85) return 'Strong setup — entry active';
  if (signal.setupScore >= 70) return 'Good setup — entry active';
  if (signal.setupScore >= 55) return 'Wait for confirmation';
  return 'Risk high — lower leverage';
}

export function SetupContextCard({ signal }: { signal: CryptoSignal }) {
  const setupColor =
    signal.setupScore >= 70 ? 'text-sigflo-accent' : signal.setupScore >= 55 ? 'text-amber-300' : 'text-rose-400';
  const riskColor =
    signal.riskTag === 'High Risk' ? 'text-rose-400' : signal.riskTag === 'Low Risk' ? 'text-emerald-400' : 'text-sigflo-muted';

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-sigflo-muted">Setup: <span className={`font-bold ${setupColor}`}>{setupLabel(signal.setupScore)}</span></span>
          <span className="text-sigflo-muted">Risk: <span className={`font-bold ${riskColor}`}>{riskShort(signal.riskTag)}</span></span>
          <span className="text-sigflo-muted">Score: <span className="font-bold text-white">{signal.setupScore}</span></span>
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold text-sigflo-accent">{actionLine(signal)}</p>
    </div>
  );
}
