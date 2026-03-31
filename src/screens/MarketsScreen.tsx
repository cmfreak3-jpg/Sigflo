import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MarketCard } from '@/components/markets/MarketCard';
import { useMarketsScanner } from '@/hooks/useMarketsScanner';
import { buildTradeQueryString } from '@/lib/tradeNavigation';

type MarketsTab = 'tracked' | 'movers';

const tabs: { id: MarketsTab; label: string }[] = [
  { id: 'tracked', label: 'Tracked' },
  { id: 'movers', label: 'Movers' },
];

export default function MarketsScreen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<MarketsTab>('tracked');
  const { trackedRows, moverRows, mode, connection, tickersLoading } = useMarketsScanner();

  const rows = tab === 'tracked' ? trackedRows : moverRows;
  const statusDot =
    connection === 'connected'
      ? 'bg-sigflo-accent'
      : connection === 'reconnecting'
        ? 'bg-amber-400 animate-pulse'
        : 'bg-slate-500';

  return (
    <div className="min-h-[100dvh] bg-sigflo-bg pb-[max(5.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-lg px-4">
        {/* Header */}
        <header className="mb-4">
          <h1 className="text-2xl font-bold tracking-tight text-white">Markets</h1>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-sigflo-muted">
            <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
            <span>{mode} · {rows.length} pairs{tickersLoading ? ' · loading…' : ''}</span>
          </div>
        </header>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1" role="tablist">
          {tabs.map(({ id, label }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  active
                    ? 'bg-sigflo-accent/12 text-sigflo-accent ring-1 ring-sigflo-accent/25'
                    : 'text-sigflo-muted hover:text-sigflo-text'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Market rows */}
        <div className="space-y-2">
          {tab === 'movers' && !tickersLoading && rows.length === 0 ? (
            <p className="rounded-2xl border border-white/[0.06] bg-sigflo-surface px-4 py-10 text-center text-sm text-sigflo-muted">
              No movers yet — check back later.
            </p>
          ) : null}
          {rows.map((row) => (
            <MarketCard
              key={`${tab}-${row.symbol}`}
              row={row}
              onOpen={() => navigate(`/trade?${buildTradeQueryString(row.signal, { marketStatus: row.status })}`)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
