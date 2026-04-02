import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSignalEngine } from '@/hooks/useSignalEngine';
import { useAccountSnapshot } from '@/hooks/useAccountSnapshot';
import { deriveMarketStatus } from '@/lib/marketScannerRows';
import { formatQuoteNumber } from '@/lib/formatQuote';
import { uiSignalStateClasses, uiSignalStateFromMarketStatus, uiSignalStateLabel } from '@/lib/signalState';
import { buildTradeQueryString } from '@/lib/tradeNavigation';

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

function fmtUsd(v: number): string {
  const sign = v >= 0 ? '+' : '-';
  return `${sign}$${Math.round(Math.abs(v)).toLocaleString()}`;
}

function fmtPct(v: number): string {
  const sign = v >= 0 ? '+' : '-';
  return `${sign}${Math.abs(v).toFixed(1)}%`;
}

type ClosedTrade = { pair: string; pnlUsd: number };

const closedTradesSeed: ClosedTrade[] = [
  { pair: 'BTC / USDT', pnlUsd: 312 },
  { pair: 'ETH / USDT', pnlUsd: -84 },
  { pair: 'SOL / USDT', pnlUsd: 196 },
  { pair: 'AVAX / USDT', pnlUsd: -42 },
  { pair: 'LINK / USDT', pnlUsd: 129 },
];

export default function PortfolioScreen() {
  const navigate = useNavigate();
  const { signals } = useSignalEngine();
  const { items: accountSnapshots, loading: snapshotLoading } = useAccountSnapshot();
  const [tick, setTick] = useState(0);
  const [showClosed, setShowClosed] = useState(false);
  const [displayDailyPnl, setDisplayDailyPnl] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((v) => v + 1), 1200);
    return () => window.clearInterval(id);
  }, []);

  const activeTrades = useMemo(() => {
    const rows = signals
      .map((s) => {
        const status = deriveMarketStatus(s);
        const uiState = uiSignalStateFromMarketStatus(status);
        if (uiState === 'setup_forming') return null;
        const hash = hashCode(s.id);
        const phase = (tick + (hash % 10)) / 8;
        const drift = Math.sin(phase) * 55;
        const base = (s.setupScore - 58) * (s.side === 'long' ? 9 : 7);
        const pnlUsd = base + drift;
        const pnlPct = pnlUsd / 1200 * 100;
        return {
          signal: s,
          uiState,
          pnlUsd,
          pnlPct,
          entry: 100 + (hash % 900),
          note:
            uiState === 'triggered'
              ? 'Entry active'
              : s.riskTag === 'High Risk'
                ? 'Risk elevated'
                : 'Monitoring setup',
        };
      })
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .sort((a, b) => (a.uiState === 'triggered' ? -1 : 1) - (b.uiState === 'triggered' ? -1 : 1))
      .slice(0, 5);
    return rows;
  }, [signals, tick]);

  const targetDailyPnl = useMemo(
    () => activeTrades.reduce((sum, t) => sum + t.pnlUsd, 0) + closedTradesSeed.reduce((sum, t) => sum + t.pnlUsd, 0) * 0.25,
    [activeTrades],
  );
  const balance = useMemo(() => 12480 + targetDailyPnl * 0.35, [targetDailyPnl]);
  const dailyPct = useMemo(() => (targetDailyPnl / Math.max(1, balance - targetDailyPnl)) * 100, [balance, targetDailyPnl]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setDisplayDailyPnl((prev) => prev + (targetDailyPnl - prev) * 0.2);
    }, 90);
    return () => window.clearInterval(id);
  }, [targetDailyPnl]);

  const winRate = 62;
  const riskUsed = Math.min(82, activeTrades.length * 12 + activeTrades.filter((t) => t.uiState === 'triggered').length * 10);
  const equityPoints = useMemo(() => {
    const out: number[] = [];
    const seed = Math.max(0, balance - 11000);
    for (let i = 0; i < 24; i += 1) {
      const t = i / 23;
      const v = 0.45 + t * 0.35 + Math.sin(i * 0.5 + seed * 0.01) * 0.06;
      out.push(Math.max(0.1, Math.min(0.92, v)));
    }
    return out;
  }, [balance]);
  const chartPath = equityPoints
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${((i / (equityPoints.length - 1)) * 260).toFixed(2)},${(74 - v * 74).toFixed(2)}`)
    .join(' ');
  const chartArea = `${chartPath} L260,74 L0,74 Z`;

  return (
    <div className="space-y-3 pb-6 pt-4">
      <header className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-4">
        <p className="text-[11px] uppercase tracking-[0.14em] text-sigflo-muted">Portfolio</p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-white">${formatQuoteNumber(balance)}</p>
        <p className={`mt-1 text-sm font-semibold ${displayDailyPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
          {fmtUsd(displayDailyPnl)} today ({fmtPct(dailyPct)})
        </p>
        <div className="mt-3 overflow-hidden rounded-lg border border-white/[0.05] bg-black/20 p-2">
          <svg viewBox="0 0 260 74" className="h-[74px] w-full" aria-hidden>
            <defs>
              <linearGradient id="portfolio-equity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00ffc8" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#00ffc8" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={chartArea} fill="url(#portfolio-equity)" />
            <path d={chartPath} fill="none" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-white/[0.06] bg-sigflo-surface p-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-sigflo-muted">Win rate</p>
          <p className="mt-1 text-lg font-bold text-white">{winRate}%</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-sigflo-surface p-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-sigflo-muted">Active</p>
          <p className="mt-1 text-lg font-bold text-white">{activeTrades.length}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-sigflo-surface p-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-sigflo-muted">Risk used</p>
          <p className="mt-1 text-lg font-bold text-white">{riskUsed}%</p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-sigflo-muted">Active trades</h2>
        {activeTrades.map((t) => {
          const stateStyle = uiSignalStateClasses(t.uiState);
          const pnlUp = t.pnlUsd >= 0;
          return (
            <button
              key={t.signal.id}
              type="button"
              onClick={() => navigate(`/trade?${buildTradeQueryString(t.signal, { marketStatus: deriveMarketStatus(t.signal) })}`)}
              className={`group w-full rounded-2xl border bg-sigflo-surface p-3 text-left transition-all active:scale-[0.985] ${
                t.uiState === 'triggered'
                  ? `${stateStyle.card} shadow-[0_0_18px_-12px_rgba(0,255,200,0.7)]`
                  : stateStyle.card
              } hover:-translate-y-[1px] hover:shadow-[0_12px_22px_-18px_rgba(0,0,0,0.7)]`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white">{t.signal.pair} / USDT</p>
                  <p className={`mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${stateStyle.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${stateStyle.dot}`} />
                    {uiSignalStateLabel(t.uiState)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${pnlUp ? 'text-emerald-300' : 'text-rose-300'}`}>{fmtUsd(t.pnlUsd)}</p>
                  <p className={`text-[11px] font-semibold ${pnlUp ? 'text-emerald-200' : 'text-rose-200'}`}>{fmtPct(t.pnlPct)}</p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-sigflo-muted">
                <p>Entry {formatQuoteNumber(t.entry)}</p>
                <p>{t.note}</p>
                <p className="font-semibold text-cyan-200 group-hover:translate-x-0.5 transition-transform">Manage →</p>
              </div>
            </button>
          );
        })}
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-3">
        <button
          type="button"
          onClick={() => setShowClosed((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <h2 className="text-sm font-semibold text-white">Closed trades</h2>
          <span className="text-xs text-sigflo-muted">{showClosed ? '↑' : '↓'}</span>
        </button>
        {showClosed ? (
          <div className="mt-2 space-y-1">
            {closedTradesSeed.map((t) => (
              <div key={t.pair} className="flex items-center justify-between rounded-lg bg-black/20 px-2.5 py-2 text-xs">
                <p className="text-sigflo-text">{t.pair}</p>
                <p className={t.pnlUsd >= 0 ? 'font-semibold text-emerald-300' : 'font-semibold text-rose-300'}>
                  {fmtUsd(t.pnlUsd)}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-3">
        <p className="text-[11px] text-sigflo-muted">
          Review risk · Adjust exposure
        </p>
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-3">
        <h2 className="text-sm font-semibold text-white">Connected exchange accounts</h2>
        {snapshotLoading ? <p className="mt-2 text-xs text-sigflo-muted">Loading balances and positions...</p> : null}
        {!snapshotLoading && accountSnapshots.length === 0 ? (
          <p className="mt-2 text-xs text-sigflo-muted">No connected exchanges yet. Connect Bybit or MEXC in Profile.</p>
        ) : null}
        <div className="mt-2 space-y-2">
          {accountSnapshots.map((snap) => (
            <div key={snap.exchange} className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-white">{snap.exchange}</p>
                <p className={`text-[11px] ${snap.status === 'connected' ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {snap.status === 'connected' ? 'Connected' : 'Sync error'}
                </p>
              </div>
              <p className="mt-1 text-[11px] text-sigflo-muted">
                {snap.balances.length} balances · {snap.positions.length} positions
              </p>
              {snap.balances.slice(0, 3).map((b) => (
                <div key={`${snap.exchange}-${b.asset}`} className="mt-1 flex items-center justify-between text-[11px]">
                  <span className="text-sigflo-text">{b.asset}</span>
                  <span className="font-semibold text-white">{formatQuoteNumber(b.total)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
