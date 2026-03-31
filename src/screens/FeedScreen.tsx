import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SignalCard } from '@/components/feed/SignalCard';
import { useSignalEngine } from '@/hooks/useSignalEngine';

type FeedFilter = 'all' | 'live' | 'strong';

const filterChips: { id: FeedFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live' },
  { id: 'strong', label: 'Strong+' },
];

export function FeedScreen() {
  const [filter, setFilter] = useState<FeedFilter>('all');
  const { signals: liveSignals, loading, mode, connection } = useSignalEngine();

  const signals = useMemo(() => {
    if (filter === 'strong') return liveSignals.filter((s) => s.setupScore >= 70);
    if (filter === 'live') return liveSignals.filter((s) => s.setupScore >= 70);
    return liveSignals;
  }, [filter, liveSignals]);

  const statusDot = loading
    ? 'bg-amber-400 animate-pulse'
    : connection === 'connected'
      ? 'bg-sigflo-accent'
      : 'bg-slate-500';

  return (
    <div className="pb-6 pt-4">
      <section className="space-y-4">
        {/* Header */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Signals</h2>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-sigflo-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
              <span>{loading ? 'Syncing' : mode} · {liveSignals.length} setups</span>
            </div>
          </div>
          {import.meta.env.DEV ? (
            <div className="flex items-center gap-2">
              <Link
                to="/engine-debug"
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-sigflo-muted transition hover:text-sigflo-text"
              >
                Debug
              </Link>
              <Link
                to="/scanner-lab"
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-sigflo-muted transition hover:text-sigflo-text"
              >
                Lab
              </Link>
            </div>
          ) : null}
        </div>

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
        <div className="space-y-3">
          {signals.map((s) => (
            <SignalCard key={s.id} signal={s} />
          ))}
        </div>
      </section>
    </div>
  );
}
