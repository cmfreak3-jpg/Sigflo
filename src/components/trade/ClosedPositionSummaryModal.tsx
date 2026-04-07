import { AnimatePresence, motion } from 'framer-motion';
import { formatQuoteNumber } from '@/lib/formatQuote';
import type { ClosedPositionSummary } from '@/lib/closedPositionSummary';

function fmtUsd(n: number): string {
  const sign = n >= 0 ? '+' : '−';
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type ClosedPositionSummaryModalProps = {
  summary: ClosedPositionSummary | null;
  onDismiss: () => void;
};

export function ClosedPositionSummaryModal({ summary, onDismiss }: ClosedPositionSummaryModalProps) {
  const open = summary != null;
  const fullClose = summary != null && summary.fraction >= 0.999;

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="closed-sum-backdrop"
            role="presentation"
            className="fixed inset-0 z-[72] bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onDismiss}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {open && summary ? (
          <motion.div
            key="closed-sum-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="closed-sum-title"
            className="fixed left-1/2 top-1/2 z-[73] w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-[#00ffc8]/30 bg-[#0a0a0c] p-4 shadow-[0_24px_80px_-20px_rgba(0,255,200,0.12)] ring-1 ring-white/[0.06]"
            initial={{ opacity: 0, scale: 0.94, x: '-50%', y: 'calc(-50% + 10px)' }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scale: 0.96, x: '-50%', y: 'calc(-50% + 8px)' }}
          >
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-cyan-200/80">
              {summary.execution === 'exchange' ? 'Order sent' : 'Practice close'}
            </p>
            <h2 id="closed-sum-title" className="mt-1 text-lg font-bold text-white">
              {fullClose ? 'Position closed' : 'Partial close'}
            </h2>
            <p className="mt-0.5 text-[11px] text-sigflo-muted">
              {!fullClose ? `${Math.round(summary.fraction * 100)}% of size · ` : null}
              {summary.pairLabel}{' '}
              <span
                className={`font-bold ${summary.side === 'long' ? 'text-emerald-300' : 'text-rose-300'}`}
              >
                {summary.side.toUpperCase()}
              </span>
              {summary.market === 'spot' ? (
                <span className="text-sigflo-muted"> · Spot</span>
              ) : summary.leverage != null ? (
                <span className="text-sigflo-muted"> · {summary.leverage}×</span>
              ) : null}
            </p>

            <dl className="mt-4 rounded-xl border border-white/[0.06] bg-black/40 px-3 py-2.5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 text-[12px]">
                <dt className="min-w-0 text-sigflo-muted">Entry</dt>
                <dd className="text-right font-mono font-semibold tabular-nums text-white">
                  ${formatQuoteNumber(summary.entryPrice)}
                </dd>
                <dt className="min-w-0 text-sigflo-muted">Mark (ref.)</dt>
                <dd className="text-right font-mono font-semibold tabular-nums text-white">
                  ${formatQuoteNumber(summary.markPrice)}
                </dd>
                <dt className="min-w-0 text-sigflo-muted">Closed notional</dt>
                <dd className="text-right font-mono font-semibold tabular-nums text-white">
                  $
                  {summary.closedNotionalUsd.toLocaleString('en-US', {
                    maximumFractionDigits: 0,
                  })}
                </dd>
              </div>
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 border-t border-white/[0.06] pt-2 text-[12px]">
                <dt className="min-w-0 font-semibold text-sigflo-muted">Est. P&amp;L (closed leg)</dt>
                <dd
                  className={`text-right font-mono text-base font-bold tabular-nums ${
                    summary.pnlUsd >= 0 ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {fmtUsd(summary.pnlUsd)}
                </dd>
                <span className="min-w-0" aria-hidden />
                <p className="text-right text-[10px] font-semibold tabular-nums text-sigflo-muted">
                  {summary.movePct >= 0 ? '+' : ''}
                  {summary.movePct.toFixed(2)}% on entry
                </p>
              </div>
            </dl>

            {summary.execution === 'exchange' ? (
              <p className="mt-3 text-[11px] leading-relaxed text-sigflo-muted">
                Fills and fees are set by the exchange. This summary uses the last mark before your close was sent —
                check Bybit for realized P&amp;L.
              </p>
            ) : (
              <p className="mt-3 text-[11px] leading-relaxed text-sigflo-muted">
                Demo only — not executed on your exchange. Use the same plan when you exit on the venue.
              </p>
            )}

            <button
              type="button"
              onClick={onDismiss}
              className="mt-4 w-full min-h-[44px] rounded-xl bg-gradient-to-b from-[#00ffc8]/90 to-[#00c9a0]/90 py-2.5 text-sm font-bold text-black shadow-[0_0_20px_-8px_rgba(0,255,200,0.45)] transition hover:brightness-110"
            >
              Done
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
