import { Card } from '@/components/ui/Card';
import type { RiskLevel } from '@/types/trade';

function toneClass(risk: RiskLevel) {
  if (risk === 'High') return 'border-rose-400/30 bg-rose-500/10 text-rose-100';
  if (risk === 'Medium') return 'border-amber-400/25 bg-amber-500/10 text-amber-100';
  return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100';
}

function scoreMeaning(score: number): string {
  if (score >= 75) return 'Execution is aligned with the setup.';
  if (score >= 60) return 'Execution is acceptable, but risk is climbing.';
  if (score >= 45) return 'Execution quality is slipping relative to setup.';
  return 'Execution is misaligned with this setup.';
}

function scoreClass(score: number): string {
  if (score >= 75) return 'text-emerald-200 border-emerald-400/30 bg-emerald-500/12';
  if (score >= 60) return 'text-amber-100 border-amber-400/30 bg-amber-500/12';
  return 'text-rose-100 border-rose-400/35 bg-rose-500/14';
}

function scoreAction(score: number): string {
  if (score >= 75) return 'Action: Valid setup if execution is disciplined.';
  if (score >= 60) return 'Action: Keep size controlled and avoid chasing.';
  return 'Action: Reduce size or wait for cleaner structure.';
}

function scoreJudgment(score: number): string {
  if (score >= 80) return 'High-quality execution';
  if (score >= 65) return 'Acceptable execution';
  if (score >= 50) return 'Below average execution';
  return 'Aggressive for current setup';
}

function scoreHeadline(score: number): string {
  if (score >= 75) return 'Trade quality is strong';
  if (score >= 60) return 'Trade quality is moderate';
  if (score >= 45) return 'Trade quality is weak';
  return 'Trade quality is poor';
}

export function PreTradeWarningCard(props: {
  walletUsedPct: number;
  leverage: number;
  riskLevel: RiskLevel;
  riskMeterPct: number;
  tradeScore: number;
  setupTradeConflictMessage?: string;
  walletImpactLabel: string;
  primaryMessage: string;
  warnings: string[];
}) {
  const {
    walletUsedPct,
    leverage,
    riskLevel,
    riskMeterPct,
    tradeScore,
    setupTradeConflictMessage,
    walletImpactLabel,
    primaryMessage,
    warnings,
  } = props;
  const riskTitle = `${riskLevel} risk`;
  const headline = scoreHeadline(tradeScore);
  const scoreText = scoreMeaning(tradeScore);
  const judgment = scoreJudgment(tradeScore);
  const markerClass =
    riskLevel === 'High'
      ? 'bg-rose-200 shadow-[0_0_16px_rgba(251,113,133,0.95)]'
      : riskLevel === 'Medium'
        ? 'bg-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.85)]'
        : 'bg-emerald-100 shadow-[0_0_14px_rgba(52,211,153,0.85)]';

  return (
    <Card className={`space-y-3 border-2 shadow-glow-sm ${toneClass(riskLevel)} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">{headline}</h3>
          <p className="mt-1 text-sm">{scoreText}</p>
          <p className="mt-1 text-xs text-sigflo-text/85">{primaryMessage}</p>
        </div>
        <div className={`rounded-xl border px-2.5 py-1.5 text-right ${scoreClass(tradeScore)}`}>
          <p className="text-[10px] uppercase tracking-wider opacity-80">Trade Score</p>
          <p className="text-lg font-bold leading-none">{tradeScore}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider opacity-95">{judgment}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-80">{riskTitle}</p>
        </div>
      </div>
      <p className="text-[11px] text-sigflo-muted">
        Trade Score reflects execution quality (size, leverage, and liquidation exposure), not setup quality.
      </p>
      {setupTradeConflictMessage && (
        <div className="rounded-xl border border-cyan-400/35 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100">
          {setupTradeConflictMessage}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-[11px] font-medium opacity-85">{scoreAction(tradeScore)}</p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider opacity-85">
          <span>Risk meter</span>
          <span>{riskMeterPct}%</span>
        </div>
        <div className="relative h-4 overflow-hidden rounded-full bg-black/30 ring-1 ring-white/15">
          <div className="absolute inset-y-0 left-0 w-1/3 bg-emerald-400/80" />
          <div className="absolute inset-y-0 left-1/3 w-1/3 bg-amber-400/80" />
          <div className="absolute inset-y-0 right-0 w-1/3 bg-rose-400/80" />
          <div className="absolute inset-y-0 left-1/3 w-px bg-white/30" />
          <div className="absolute inset-y-0 left-2/3 w-px bg-white/30" />
          <div
            className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border border-white/90 ${markerClass}`}
            style={{ left: `calc(${riskMeterPct}% - 7px)` }}
            aria-hidden
          />
          <div
            className="absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white/20 blur-[2px]"
            style={{ left: `calc(${riskMeterPct}% - 12px)` }}
            aria-hidden
          />
        </div>
        <div className="grid grid-cols-3 text-[10px] uppercase tracking-wider opacity-80">
          <span className="text-emerald-200">Low</span>
          <span className="text-center text-amber-100">Medium</span>
          <span className="text-right text-rose-200">High</span>
        </div>
      </div>

      <div className="rounded-xl border border-white/12 bg-black/20 px-3 py-2">
        <p className="text-xs font-medium">Wallet impact: {walletImpactLabel}</p>
        <p className="mt-0.5 text-sm font-semibold text-white/95">
          You're risking {walletUsedPct.toFixed(1)}% of your wallet on this position
        </p>
        <p className="mt-0.5 text-xs opacity-90">At {leverage}x leverage</p>
      </div>

      {warnings.length > 1 && (
        <ul className="list-disc space-y-1 pl-4 text-xs opacity-90">
          {warnings.slice(1).map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
