import { LiveBadge } from '@/components/ui/LiveBadge';
import { formatQuoteNumber } from '@/lib/formatQuote';
import type { MarketScannerRow, MarketRowStatus } from '@/types/markets';

function statusCopy(status: MarketRowStatus): string {
  switch (status) {
    case 'triggered': return 'Triggered';
    case 'developing': return 'Building';
    case 'overextended': return 'Extended';
    default: return 'Watching';
  }
}

function statusColor(status: MarketRowStatus): string {
  switch (status) {
    case 'triggered': return 'text-sigflo-accent';
    case 'developing': return 'text-cyan-300';
    case 'overextended': return 'text-amber-300';
    default: return 'text-sigflo-muted';
  }
}

export function MarketCard({ row, onOpen }: { row: MarketScannerRow; onOpen: () => void }) {
  const isTriggered = row.status === 'triggered';
  const changePositive = row.change24hPct >= 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left"
      aria-label={`Open trade for ${row.symbol}`}
    >
      <div
        className={`rounded-2xl border bg-sigflo-surface p-4 transition-all active:scale-[0.98] ${
          isTriggered
            ? 'border-sigflo-accent/20 animate-glow-breathe'
            : 'border-white/[0.06] hover:border-white/10'
        }`}
      >
        <div className="flex items-center justify-between">
          {/* Left: pair + status */}
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold tracking-tight text-white">{row.pair}</h3>
            {isTriggered ? (
              <LiveBadge label="LIVE" />
            ) : (
              <span className={`text-[11px] font-semibold ${statusColor(row.status)}`}>
                {statusCopy(row.status)}
              </span>
            )}
          </div>

          {/* Right: price + change */}
          <div className="text-right">
            <p className="text-sm font-bold tabular-nums text-white">
              {Number.isFinite(row.lastPrice) ? `$${formatQuoteNumber(row.lastPrice)}` : '—'}
            </p>
            <p className={`text-xs font-semibold tabular-nums ${changePositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {Number.isFinite(row.change24hPct) ? `${changePositive ? '+' : ''}${row.change24hPct.toFixed(2)}%` : '—'}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}
