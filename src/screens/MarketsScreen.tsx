import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MarketCard } from '@/components/markets/MarketCard';
import { useMarketsScanner } from '@/hooks/useMarketsScanner';
import { countMarketRowStatuses } from '@/lib/marketScannerRows';
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

  const liveConnected = connection === 'connected';
  const statusLabel =
    connection === 'connected' ? 'Connected' : connection === 'reconnecting' ? 'Reconnecting' : 'Disconnected';

  const rows = tab === 'tracked' ? trackedRows : moverRows;
  const statusTally = useMemo(() => countMarketRowStatuses(rows), [rows]);

  return (
    <div className="min-h-[100dvh] bg-sigflo-bg pb-[max(5.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-lg px-4">
        <header className="mb-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-400/80">
            {tab === 'tracked' ? 'Scanner' : '24h'}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{tab === 'tracked' ? 'Tracked' : 'Movers'}</h1>
        </header>

        <div
          className="mb-4 flex gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1 shadow-card"
          role="tablist"
          aria-label="Markets view"
        >
          {tabs.map(({ id, label }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  active
                    ? 'bg-gradient-to-r from-emerald-500/25 to-cyan-500/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-cyan-400/35'
                    : 'text-sigflo-muted hover:bg-white/[0.04] hover:text-sigflo-text'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[11px] text-sigflo-muted">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex h-2 w-2 rounded-full ${
                liveConnected ? 'bg-emerald-400' : connection === 'reconnecting' ? 'animate-pulse bg-amber-400' : 'bg-slate-500'
              }`}
            />
            <span className="font-medium uppercase tracking-wide text-sigflo-text">
              {liveConnected ? 'Live' : mode === 'MOCK' ? 'Mock' : 'REST'}
            </span>
            <span className="text-sigflo-muted">·</span>
            <span>{statusLabel}</span>
          </div>
          <div className="flex max-w-[min(100%,20rem)] flex-wrap items-center justify-end gap-x-2 gap-y-1 text-right sm:max-w-none">
            <span>
              <span className="text-white">{rows.length}</span> pairs
            </span>
            <span className="text-white/15">·</span>
            <span>
              <span className="text-emerald-300">{statusTally.triggered}</span> live
            </span>
            <span className="text-white/15">·</span>
            <span>
              <span className="text-cyan-200">{statusTally.developing}</span> developing
            </span>
            {statusTally.overextended > 0 ? (
              <>
                <span className="text-white/15">·</span>
                <span>
                  <span className="text-amber-200">{statusTally.overextended}</span> extended
                </span>
              </>
            ) : null}
            {tickersLoading ? <span className="w-full text-[10px] text-sigflo-muted sm:w-auto">prices…</span> : null}
          </div>
        </div>

        <div className="space-y-3">
          {tab === 'movers' && !tickersLoading && rows.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-10 text-center text-sm text-sigflo-muted">
              No USDT perpetuals are up on the day yet. Check back after the tape turns green.
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
