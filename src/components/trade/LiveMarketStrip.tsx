import { formatQuoteNumber } from '@/lib/formatQuote';

export type LiveMarketStripProps = {
  symbol: string;
  lastPrice: number | null;
  /** Display as percent move, e.g. session or 24h */
  movePct: number | null;
  moveLabel?: string;
  /** e.g. "In play" when managing a live position */
  statusLabel?: string;
  pulse?: boolean;
  className?: string;
};

/**
 * Compact strip above the chart — keeps the dock feeling live even when the plot is collapsed.
 */
export function LiveMarketStrip({
  symbol,
  lastPrice,
  movePct,
  moveLabel = '24h',
  statusLabel,
  pulse = false,
  className = '',
}: LiveMarketStripProps) {
  const priceOk = lastPrice != null && Number.isFinite(lastPrice) && lastPrice > 0;
  const moveOk = movePct != null && Number.isFinite(movePct);
  const moveClass = !moveOk ? 'text-sigflo-muted' : movePct >= 0 ? 'text-emerald-300/95' : 'text-rose-300/95';

  return (
    <div
      className={`flex min-h-[28px] items-center justify-between gap-2 border-b border-[#00ffc8]/10 bg-gradient-to-r from-[#00ffc8]/[0.05] via-black/40 to-black/25 px-[7px] py-[4px] sm:px-[10px] ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-[11px] font-bold tracking-tight text-white sm:text-xs">{symbol}</span>
        {statusLabel ? (
          <span className="inline-flex items-center gap-1 rounded border border-cyan-400/20 bg-cyan-500/10 px-1.5 py-px text-[7px] font-extrabold uppercase tracking-[0.12em] text-cyan-100/90">
            {pulse ? (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300/50 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-300" />
              </span>
            ) : null}
            {statusLabel}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-baseline gap-2 tabular-nums">
        <span className="font-mono text-[12px] font-semibold text-cyan-100/95 sm:text-[13px]">
          {priceOk ? `$${formatQuoteNumber(lastPrice)}` : '—'}
        </span>
        <span className={`text-[9px] font-semibold sm:text-[10px] ${moveClass}`}>
          {moveOk ? (
            <>
              {movePct >= 0 ? '+' : ''}
              {movePct.toFixed(2)}% <span className="font-medium text-sigflo-muted">{moveLabel}</span>
            </>
          ) : (
            '—'
          )}
        </span>
      </div>
    </div>
  );
}
