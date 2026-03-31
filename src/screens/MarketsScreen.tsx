import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MarketCard } from '@/components/markets/MarketCard';
import { useFeedMiniCharts } from '@/hooks/useFeedMiniCharts';
import { useMarketsScanner } from '@/hooks/useMarketsScanner';
import { buildTradeQueryString } from '@/lib/tradeNavigation';
import type { MarketScannerRow } from '@/types/markets';

type MarketsTab = 'tracked' | 'movers';

const tabs: { id: MarketsTab; label: string }[] = [
  { id: 'tracked', label: 'Tracked' },
  { id: 'movers', label: 'Movers' },
];

export default function MarketsScreen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<MarketsTab>('tracked');
  const [lockingSymbol, setLockingSymbol] = useState<string | null>(null);
  const { trackedRows, moverRows, mode, connection, tickersLoading } = useMarketsScanner();
  const navigateWithTransition = (to: string) => {
    const w = window as Window & { startViewTransition?: (cb: () => void) => void };
    if (typeof w.startViewTransition === 'function') {
      w.startViewTransition(() => navigate(to));
      return;
    }
    navigate(to);
  };

  const openRow = (row: MarketScannerRow) => {
    const query = buildTradeQueryString(row.signal, { marketStatus: row.status });
    if (row.status === 'triggered') {
      setLockingSymbol(row.symbol);
      window.setTimeout(() => navigateWithTransition(`/bots?${query}`), 190);
      return;
    }
    navigateWithTransition(`/trade?${query}`);
  };


  const rows = tab === 'tracked' ? trackedRows : moverRows;
  const primaryTriggeredSymbol = useMemo(() => {
    const triggered = rows.filter((r) => r.status === 'triggered');
    if (triggered.length === 0) return null;
    const sorted = [...triggered].sort((a, b) => (b.triggeredAtMs ?? 0) - (a.triggeredAtMs ?? 0));
    return sorted[0]?.symbol ?? null;
  }, [rows]);
  const triggeredNowCount = useMemo(() => {
    const seen = new Set<string>();
    for (const row of [...trackedRows, ...moverRows]) {
      if (row.status !== 'triggered') continue;
      seen.add(row.symbol);
    }
    return seen.size;
  }, [moverRows, trackedRows]);
  const fastPairs = useMemo(
    () => rows.filter((r) => r.status === 'triggered').map((r) => r.pair),
    [rows],
  );
  const miniCharts = useFeedMiniCharts(rows.map((r) => r.pair), { fastPairs, fastRefreshMs: 8_000 });
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
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => navigate('/feed')}
              className="inline-flex items-center gap-2 rounded-lg border border-sigflo-accent/26 bg-sigflo-accent/10 px-2.5 py-1.5 text-[11px] font-semibold text-sigflo-accent transition hover:border-sigflo-accent/40 hover:bg-sigflo-accent/14"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-pulse-dot rounded-full bg-sigflo-accent [animation-duration:1.8s]" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sigflo-accent" />
              </span>
              {triggeredNowCount} signal{triggeredNowCount === 1 ? '' : 's'} triggered now
            </button>
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
              isPrimaryTriggered={row.symbol === primaryTriggeredSymbol}
              isDimmed={lockingSymbol != null && lockingSymbol !== row.symbol}
              isLocking={lockingSymbol === row.symbol}
              miniCandles={miniCharts[row.pair.toUpperCase()]}
              onOpen={() => openRow(row)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
