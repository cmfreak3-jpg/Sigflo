import { formatQuoteNumber } from '@/lib/formatQuote';

/** One row in the center marquee when driven by the signal engine (multiple pairs). */
export type LiveMarketTickerItem = {
  pair: string;
  lastPrice: number | null;
  movePct: number | null;
};

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
  /**
   * Center ticker: scroll through these rows (e.g. `useSignalEngine().signals` + live tickers).
   * When absent or empty, falls back to a single line built from `symbol` / `lastPrice` / `movePct`.
   */
  tickerItems?: LiveMarketTickerItem[];
};

/**
 * Compact strip above the chart — keeps the dock feeling live even when the plot is collapsed.
 */
function movePctClass(movePct: number | null): string {
  const ok = movePct != null && Number.isFinite(movePct);
  if (!ok) return 'text-sigflo-muted';
  return movePct >= 0 ? 'text-emerald-300/95' : 'text-rose-300/95';
}

function TickerItemRow({
  pairLabel,
  lastPrice,
  movePct,
  moveLabel,
}: {
  pairLabel: string;
  lastPrice: number | null;
  movePct: number | null;
  moveLabel: string;
}) {
  const priceOk = lastPrice != null && Number.isFinite(lastPrice) && lastPrice > 0;
  const moveOk = movePct != null && Number.isFinite(movePct);
  const priceStr = priceOk ? `$${formatQuoteNumber(lastPrice)}` : '—';
  const moveStr = moveOk ? `${movePct >= 0 ? '+' : ''}${movePct.toFixed(2)}%` : '—';
  const moveClass = movePctClass(movePct);

  return (
    <span className="inline-flex items-center gap-x-2 whitespace-nowrap font-mono text-[9px] tabular-nums leading-none text-sigflo-muted/95 sm:gap-x-2.5 sm:text-[10px]">
      <span className="max-w-[7.5rem] truncate font-semibold text-white/92 sm:max-w-[9rem]">{pairLabel}</span>
      <span className="text-white/18" aria-hidden>
        ·
      </span>
      <span className="text-cyan-200/88">
        LAST <span className="text-cyan-100/95">{priceStr}</span>
      </span>
      <span className="text-white/18" aria-hidden>
        ·
      </span>
      <span className={moveClass}>
        {moveStr}{' '}
        <span className="font-medium text-sigflo-muted">{moveLabel}</span>
      </span>
    </span>
  );
}

export function LiveMarketStrip({
  symbol,
  lastPrice,
  movePct,
  moveLabel = '24h',
  statusLabel,
  pulse = false,
  className = '',
  tickerItems,
}: LiveMarketStripProps) {
  const priceOk = lastPrice != null && Number.isFinite(lastPrice) && lastPrice > 0;
  const moveOk = movePct != null && Number.isFinite(movePct);
  const moveClass = movePctClass(movePct);
  const priceStr = priceOk ? `$${formatQuoteNumber(lastPrice)}` : '—';

  const signalTickerList = tickerItems ?? [];
  const useSignalTicker = signalTickerList.length > 0;

  const tickerSegment = useSignalTicker ? (
    <span className="inline-flex items-center gap-x-4 whitespace-nowrap sm:gap-x-5">
      {signalTickerList.map((it, idx) => (
        <TickerItemRow
          key={`${it.pair}-${idx}`}
          pairLabel={it.pair}
          lastPrice={it.lastPrice}
          movePct={it.movePct}
          moveLabel={moveLabel}
        />
      ))}
    </span>
  ) : (
    <TickerItemRow pairLabel={symbol} lastPrice={lastPrice} movePct={movePct} moveLabel={moveLabel} />
  );

  return (
    <div
      className={`flex min-h-[28px] items-center justify-between gap-2 border-b border-[#00ffc8]/10 bg-gradient-to-r from-[#00ffc8]/[0.05] via-black/40 to-black/25 px-[7px] py-[4px] sm:px-[10px] ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 shrink-0 items-center gap-2">
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

      <div
        className="relative mx-1 min-h-[16px] min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)] motion-reduce:mx-0 motion-reduce:max-w-none motion-reduce:overflow-visible motion-reduce:[mask-image:none] sm:mx-2"
        aria-hidden
      >
        <div className="hidden w-full justify-center motion-reduce:flex">
          {tickerSegment}
        </div>
        <div className="motion-reduce:hidden">
          <div className="sigflo-live-ticker-track">
            <div className="flex shrink-0 items-center pr-6 sm:pr-10">{tickerSegment}</div>
            <div className="flex shrink-0 items-center pr-6 sm:pr-10">{tickerSegment}</div>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-baseline gap-2 tabular-nums">
        <span className="font-mono text-[12px] font-semibold text-cyan-100/95 sm:text-[13px]">{priceStr}</span>
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
