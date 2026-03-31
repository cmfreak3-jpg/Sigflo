import type { MarketRowStatus } from '@/types/markets';
import type { CryptoSignal } from '@/types/signal';

function setupTone(score: number): string {
  if (score >= 80) return 'Strong';
  if (score >= 65) return 'Developing';
  if (score >= 50) return 'Mixed';
  return 'Weak';
}

function trendCue(signal: CryptoSignal): string {
  const t = signal.scoreBreakdown.trendAlignment;
  if (t >= 17) return 'Trend holding';
  if (t <= 10) return 'Weak trend';
  return 'Trend mixed';
}

function momentumCue(signal: CryptoSignal): string {
  const m = signal.scoreBreakdown.momentumQuality;
  if (m >= 14) return 'Momentum building';
  if (m <= 8) return 'Momentum fading';
  return 'Momentum steady';
}

function readFor(signal: CryptoSignal, status: MarketRowStatus): string {
  if (signal.setupType === 'breakout') {
    if (status === 'triggered') return 'Breakout active';
    if (status === 'developing') return 'Breakout forming';
    if (status === 'overextended') return 'Breakout stretched';
    return 'Breakout coiling';
  }
  if (signal.setupType === 'pullback') {
    if (status === 'triggered') return 'Trend holding';
    if (status === 'developing') return 'Pullback forming';
    if (status === 'overextended') return 'Bounce stretched';
    return 'Weak bounce';
  }
  if (status === 'overextended') return 'Exhaustion risk';
  return signal.side === 'long' ? 'Rejection forming' : 'Relief forming';
}

function watchFor(signal: CryptoSignal): string {
  if (signal.setupType === 'breakout') return 'Watch: breakout or rejection';
  if (signal.setupType === 'pullback') return signal.side === 'long' ? 'Watch: hold or fade' : 'Watch: reclaim or fail';
  return 'Watch: continuation or rollover';
}

function entryState(status: MarketRowStatus, tradeScore: number): 'Early' | 'Active' | 'Late' | 'Risky' {
  if (status === 'overextended' || tradeScore < 45) return 'Risky';
  if (status === 'triggered' && tradeScore >= 65) return 'Active';
  if (status === 'triggered' && tradeScore < 55) return 'Late';
  if (status === 'idle') return 'Early';
  return 'Early';
}

function actionFor(signal: CryptoSignal, status: MarketRowStatus, tradeScore: number): string {
  if (signal.riskTag === 'High Risk' || tradeScore < 45) return 'High risk - reduce size';
  if (status === 'overextended') return 'Avoid chasing';
  if (status === 'developing') return 'Wait for confirmation';
  if (status === 'triggered' && tradeScore >= 65) return 'Entry active';
  if (signal.setupType === 'breakout') {
    return signal.side === 'long' ? 'Confirmation above level needed' : 'Confirmation below level needed';
  }
  return 'Keep size controlled';
}

export function ScannerInsightCard({
  signal,
  status,
  tradeScore,
}: {
  signal: CryptoSignal;
  status: MarketRowStatus;
  tradeScore: number;
}) {
  const mainRead = readFor(signal, status);
  const watch = watchFor(signal);
  const entry = entryState(status, tradeScore);
  const action = actionFor(signal, status, tradeScore);

  return (
    <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/[0.08] via-sigflo-surface/95 to-emerald-500/[0.06] px-3.5 py-3 shadow-[0_0_30px_-16px_rgba(34,211,238,0.55)] ring-1 ring-cyan-400/10">
      <p className="text-right text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80">Scanner</p>
      <p className="mt-1 text-lg font-semibold leading-tight text-white">{mainRead}</p>
      <p className="mt-1 text-sm font-semibold text-cyan-200">{watch}</p>

      <div className="mt-2.5 flex items-center justify-between gap-4 text-[11px]">
        <p className="text-sigflo-muted">
          Setup: <span className="font-semibold text-white">{signal.setupScore}</span> ·{' '}
          <span className="text-sigflo-text/85">{setupTone(signal.setupScore)}</span>
        </p>
        <p className="text-right text-sigflo-muted">
          Entry: <span className="font-semibold text-white">{entry}</span>
        </p>
      </div>

      <div className="mt-2.5 flex items-end justify-between gap-4">
        <p className="text-[12px] font-semibold text-emerald-300">{action}</p>
        <p className="text-right text-[10px] text-sigflo-muted/85">
          {trendCue(signal)} · {momentumCue(signal)}
        </p>
      </div>
    </div>
  );
}
