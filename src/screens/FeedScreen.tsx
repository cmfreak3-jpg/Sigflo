import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SignalCard } from '@/components/feed/SignalCard';
import { useSignalEngine } from '@/hooks/useSignalEngine';

type FeedFilter = 'all' | 'high';

const filterChips: { id: FeedFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'high', label: 'Strong+' },
];

export function FeedScreen() {
  const [filter, setFilter] = useState<FeedFilter>('all');
  const { signals: liveSignals, loading, mode, connection } = useSignalEngine();

  const signals = useMemo(() => {
    if (filter === 'high') return liveSignals.filter((s) => s.setupScore >= 70);
    return liveSignals;
  }, [filter, liveSignals]);

  const stats = useMemo(
    () => ({
      signalsToday: liveSignals.length,
      strongOrBetter: liveSignals.filter((s) => s.setupScore >= 70).length,
      lastUpdated: loading ? 'Syncing...' : `${mode} • ${connection}`,
    }),
    [liveSignals, loading, mode, connection],
  );

  return (
    <div className="pb-6 pt-4">
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-400/85">Market Setups</p>
            <h2 className="text-2xl font-semibold tracking-tight text-white">Live feed</h2>
            <p className="max-w-sm text-sm leading-relaxed text-sigflo-muted">
              Setup scores blend trend, momentum, structure, volume, and risk. Tap a card to load Trade with the same context.
            </p>
          </div>
          {import.meta.env.DEV ? (
            <div className="flex items-center gap-2">
              <Link
                to="/engine-debug"
                className="rounded-full border border-cyan-400/35 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-cyan-200 transition hover:bg-cyan-500/15"
              >
                Debug
              </Link>
              <Link
                to="/scanner-lab"
                className="rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition hover:bg-emerald-500/15"
              >
                Lab
              </Link>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/[0.06] bg-sigflo-surface/60 p-2 shadow-card backdrop-blur-sm">
          <StatPill label="Today" value={String(stats.signalsToday)} />
          <StatPill label="Strong+" value={String(stats.strongOrBetter)} />
          <StatPill label="Updated" value={stats.lastUpdated} small />
        </div>

        <div
          className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Filter signals"
        >
          {filterChips.map((chip) => {
            const active = filter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(chip.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? 'bg-gradient-to-r from-emerald-500/25 to-cyan-500/20 text-white ring-1 ring-cyan-400/30'
                    : 'border border-white/[0.06] bg-white/[0.03] text-sigflo-muted hover:text-sigflo-text'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-sigflo-muted">
              {filter === 'high' ? 'Strong setups' : 'Latest'} ({signals.length})
            </h3>
          </div>
          {signals.map((s) => (
            <SignalCard key={s.id} signal={s} />
          ))}
        </div>
      </section>
    </div>
  );
}

function StatPill({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-2 py-2 text-center">
      <p className="text-[10px] font-medium uppercase tracking-wider text-sigflo-muted">{label}</p>
      <p className={`mt-0.5 font-semibold tabular-nums text-sigflo-text ${small ? 'text-xs' : 'text-lg'}`}>{value}</p>
    </div>
  );
}
