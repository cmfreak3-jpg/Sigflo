import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MarketNewsScanSheet } from '@/components/news/MarketNewsScanSheet';
import { SignalCard } from '@/components/feed/SignalCard';
import { useFeedMiniCharts } from '@/hooks/useFeedMiniCharts';
import { useSyncedTradeChartInterval } from '@/hooks/useSyncedTradeChartInterval';
import { tradeChartIntervalShortLabel } from '@/lib/tradeChartIntervalPreference';
import { useSignalEngine } from '@/hooks/useSignalEngine';
import {
  buildTrackedFallbackSignal,
  deriveMarketStatus,
  isFeedActionableOpportunity,
  symbolToPair,
  TRACKED_SYMBOLS,
} from '@/lib/marketScannerRows';

type FeedFilter = 'all' | 'strong' | 'actionable' | 'risky';

const filterChips: { id: FeedFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'strong', label: 'Strong+' },
  { id: 'actionable', label: 'Actionable' },
  { id: 'risky', label: 'Risky' },
];

export function FeedScreen() {
  const [searchParams] = useSearchParams();
  const queryFilter = searchParams.get('filter');
  const initialFilter: FeedFilter =
    queryFilter === 'strong' || queryFilter === 'actionable' || queryFilter === 'risky' || queryFilter === 'all'
      ? queryFilter
      : 'all';
  const [filter, setFilter] = useState<FeedFilter>(initialFilter);
  const [newsScanOpen, setNewsScanOpen] = useState(false);
  const { signals: liveSignals, loading, mode, connection } = useSignalEngine();

  /** Tracked watchlist pairs with no engine emission yet — same shells as Markets “Tracked”. */
  const feedSignalsBase = useMemo(() => {
    const covered = new Set(liveSignals.map((s) => s.pair.toUpperCase()));
    const forming = TRACKED_SYMBOLS.filter((sym) => !covered.has(symbolToPair(sym).toUpperCase())).map((sym) =>
      buildTrackedFallbackSignal(symbolToPair(sym), sym),
    );
    return [...liveSignals, ...forming].sort((a, b) => b.setupScore - a.setupScore);
  }, [liveSignals]);

  useEffect(() => {
    const next = searchParams.get('filter');
    if (next === 'strong' || next === 'actionable' || next === 'risky' || next === 'all') {
      setFilter(next);
    }
  }, [searchParams]);

  const signals = useMemo(() => {
    if (filter === 'strong') return feedSignalsBase.filter((s) => s.setupScore >= 70);
    if (filter === 'actionable') return feedSignalsBase.filter(isFeedActionableOpportunity);
    if (filter === 'risky') {
      return feedSignalsBase.filter((s) => s.riskTag === 'High Risk' || deriveMarketStatus(s) === 'overextended');
    }
    return feedSignalsBase;
  }, [filter, feedSignalsBase]);

  const statusDot = loading
    ? 'bg-amber-400 animate-pulse'
    : connection === 'connected'
      ? 'bg-sigflo-accent'
      : 'bg-slate-500';
  const feedChartInterval = useSyncedTradeChartInterval();
  const miniChartsByPair = useFeedMiniCharts(signals.map((s) => s.pair), { interval: feedChartInterval });

  return (
    <div className="pb-6 pt-4">
      <section className="space-y-4">
        {/* Header */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Signals</h2>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-sigflo-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
              <span>
                {loading ? 'Syncing' : mode === 'OFFLINE' ? 'Offline' : mode} ·{' '}
                {filter === 'all'
                  ? `${feedSignalsBase.length} setups`
                  : `${signals.length} of ${feedSignalsBase.length} setups`}
              </span>
            </div>
            <div className="mt-1 inline-flex items-center gap-2 text-[10px] font-medium text-sigflo-muted">
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                Forming
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-300/95" />
                In Play
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 text-[#b2fff0] drop-shadow-[0_0_8px_rgba(0,255,200,0.35)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00ffc8] shadow-[0_0_8px_rgba(0,255,200,0.75)]" />
                Triggered
              </span>
            </div>
          </div>
          {import.meta.env.DEV ? (
            <div className="flex items-center gap-2">
              <Link
                to="/engine-debug"
                className="inline-flex items-center rounded-lg border border-cyan-500/25 bg-cyan-500/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200/85 transition hover:bg-cyan-500/[0.14] hover:text-cyan-100"
              >
                Debug
              </Link>
              <Link
                to="/scanner-lab"
                className="inline-flex items-center rounded-lg border border-violet-500/25 bg-violet-500/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200/85 transition hover:bg-violet-500/[0.14] hover:text-violet-100"
              >
                Lab
              </Link>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setNewsScanOpen(true)}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-cyan-400/22 hover:bg-white/[0.05]"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200/85">Market pulse</p>
            <p className="mt-0.5 text-[13px] font-semibold text-white">What matters today</p>
            <p className="mt-0.5 text-[11px] text-sigflo-muted">AI scan of live crypto & macro headlines</p>
          </div>
          <span className="shrink-0 text-lg text-cyan-300/75" aria-hidden>
            →
          </span>
        </button>

        {/* Filter chips */}
        <div className="flex gap-2" role="tablist" aria-label="Filter signals">
          {filterChips.map((chip) => {
            const active = filter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(chip.id)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-sigflo-accent/15 text-sigflo-accent ring-1 ring-sigflo-accent/30'
                    : 'border border-white/[0.06] bg-white/[0.03] text-sigflo-muted hover:text-sigflo-text'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Signal cards */}
        <div className="space-y-4">
          {!loading && signals.length === 0 ? (
            <p className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-4 text-center text-[13px] text-sigflo-muted">
              No live setups yet — the scanner is running; stronger structure will appear as the market produces it.
            </p>
          ) : null}
          {signals.map((s) => (
            <SignalCard
              key={s.id}
              signal={s}
              miniCandles={miniChartsByPair[s.pair.toUpperCase()]}
              intervalLabel={tradeChartIntervalShortLabel(feedChartInterval)}
            />
          ))}
        </div>
      </section>

      <MarketNewsScanSheet open={newsScanOpen} onClose={() => setNewsScanOpen(false)} />
    </div>
  );
}
