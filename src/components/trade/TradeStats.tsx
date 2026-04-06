function fmtSignedPct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return '—';
  const sign = n >= 0 ? '+' : '−';
  return `${sign}${Math.abs(n).toFixed(digits)}%`;
}

export function TradeStats({
  riskPercent,
  rewardPercent,
  rrRatio,
  variant = 'default',
  compact = false,
}: {
  riskPercent: number;
  rewardPercent: number;
  rrRatio: number;
  /** `strip` — slightly stronger chrome for always-on terminal context (e.g. chart dock). */
  variant?: 'default' | 'strip';
  /** Smaller type + tight line for inline dock row. */
  compact?: boolean;
}) {
  const rrOk = Number.isFinite(rrRatio) && rrRatio > 0;
  const inner = (
    <>
      <span className="font-semibold text-emerald-200/90 tabular-nums">{fmtSignedPct(rewardPercent)}</span>
      <span className="text-sigflo-muted"> target</span>
      <span className="mx-[5px] text-white/[0.12]">·</span>
      <span className="font-semibold text-rose-200/85 tabular-nums">{fmtSignedPct(-Math.abs(riskPercent))}</span>
      <span className="text-sigflo-muted"> risk</span>
      <span className="mx-[5px] text-white/[0.12]">·</span>
      <span className="text-sigflo-text/90">
        R:R{' '}
        <span className="font-semibold tabular-nums text-cyan-200/90">{rrOk ? rrRatio.toFixed(1) : '—'}</span>
      </span>
    </>
  );
  const sizeCls = compact ? 'text-[10px] leading-none tracking-tight' : 'text-[10px] leading-snug tracking-tight';
  if (variant === 'strip') {
    return (
      <p
        className={`min-w-0 font-medium text-sigflo-muted ${sizeCls} ${compact ? 'text-left' : 'text-center sm:text-left'}`}
      >
        {inner}
      </p>
    );
  }
  return <p className={`min-w-0 font-medium text-sigflo-muted ${sizeCls}`}>{inner}</p>;
}

/** Alias for product spec naming (`TradeStatsInline`). */
export const TradeStatsInline = TradeStats;
