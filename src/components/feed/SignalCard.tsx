import { useNavigate } from 'react-router-dom';
import { LiveBadge } from '@/components/ui/LiveBadge';
import { buildTradeQueryString } from '@/lib/tradeNavigation';
import { deriveMarketStatus } from '@/lib/marketScannerRows';
import { formatQuoteNumber } from '@/lib/formatQuote';
import type { CryptoSignal } from '@/types/signal';

function confidenceLabel(score: number): string {
  if (score >= 85) return 'Elite';
  if (score >= 70) return 'Strong';
  if (score >= 55) return 'OK';
  return 'Weak';
}

function riskShort(tag: string): string {
  return tag.replace(' Risk', '');
}

export function SignalCard({ signal }: { signal: CryptoSignal }) {
  const navigate = useNavigate();
  const isTriggered = deriveMarketStatus(signal) === 'triggered';
  const riskColor =
    signal.riskTag === 'High Risk'
      ? 'text-rose-400'
      : signal.riskTag === 'Low Risk'
        ? 'text-emerald-400'
        : 'text-sigflo-muted';

  const openTrade = () => {
    navigate(`/trade?${buildTradeQueryString(signal, { marketStatus: deriveMarketStatus(signal) })}`);
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={openTrade}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTrade(); } }}
      className="group cursor-pointer animate-fade-in-up"
      aria-label={`Open trade for ${signal.pair}`}
    >
      <div
        className={`relative overflow-hidden rounded-2xl border bg-sigflo-surface p-4 transition-all active:scale-[0.98] ${
          isTriggered
            ? 'border-sigflo-accent/25 animate-glow-breathe'
            : 'border-white/[0.06] hover:border-white/10'
        }`}
      >
        {/* Top row: pair + timeframe | live badge or time ago */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-tight text-white">{signal.pair}/USDT</h2>
            <span className="text-[11px] text-sigflo-muted">5m</span>
          </div>
          {isTriggered ? (
            <LiveBadge />
          ) : (
            <span className="text-[11px] text-sigflo-muted">{signal.postedAgo}</span>
          )}
        </div>

        {/* Entry price */}
        <div className="mt-4">
          <p className="text-[10px] font-medium uppercase tracking-widest text-sigflo-muted">Entry</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-white">
            {formatQuoteNumber(signal.setupScore >= 70 ? 67240 : 1842)}
          </p>
        </div>

        {/* Bottom meta: confidence + risk */}
        <div className="mt-4 flex items-center gap-4 text-xs">
          <span className="text-sigflo-muted">
            Confidence: <span className="font-semibold text-sigflo-accent">{confidenceLabel(signal.setupScore)}</span>
          </span>
          <span className="text-sigflo-muted">
            Risk: <span className={`font-semibold ${riskColor}`}>{riskShort(signal.riskTag)}</span>
          </span>
        </div>

        {/* CTA */}
        <button
          type="button"
          className="mt-4 w-full rounded-xl bg-sigflo-accent/10 py-2.5 text-sm font-bold text-sigflo-accent transition hover:bg-sigflo-accent/15"
        >
          Open Trade →
        </button>
      </div>
    </article>
  );
}
