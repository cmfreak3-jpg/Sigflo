import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PositionSwipeCard } from '@/components/portfolio/PositionSwipeCard';
import { useAccountSnapshot } from '@/hooks/useAccountSnapshot';
import { useSignalEngine } from '@/hooks/useSignalEngine';
import { formatQuoteNumber } from '@/lib/formatQuote';
import { isFeedActionableOpportunity, symbolToPair } from '@/lib/marketScannerRows';
import { positionMicroInsight } from '@/lib/positionMicroInsight';
import { buildPortfolioPositionTradeQuery } from '@/lib/tradeNavigation';
import type { ClosedTradeRow, ExchangeId, ExchangeSnapshot, PositionItem } from '@/types/integrations';

const ACCENT = '#00ffc8';
const BYBIT_HISTORY_HREF = 'https://www.bybit.com/app/assets/home';

/** Subtle lift on hover, tuck on press — mobile-friendly */
const cardInteract = 'transition-transform duration-200 ease-out will-change-transform hover:scale-[1.01] active:scale-[0.98]';

const sectionTitleClass =
  'text-[11px] font-bold uppercase tracking-[0.16em] text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.06)]';

type PortfolioMoodTone = 'setup' | 'idle' | 'active' | 'risk' | 'defend';

/** Decision-system headline: situation, not just numbers. */
function computePortfolioMood(input: {
  connected: boolean;
  loading: boolean;
  positionCount: number;
  exposurePct: number;
  unrealizedPnl: number;
  netWorth: number;
}): { tone: PortfolioMoodTone; title: string; rest: string } {
  const { connected, loading, positionCount: n, exposurePct: exp, unrealizedPnl: u, netWorth: nw } = input;
  if (!connected) {
    return { tone: 'setup', title: 'Setup', rest: 'connect your exchange to read your situation' };
  }
  if (loading) {
    return { tone: 'setup', title: 'Syncing', rest: 'pulling your latest book' };
  }
  if (n > 0 && (exp >= 62 || (exp >= 48 && n >= 2))) {
    return { tone: 'risk', title: 'Overexposed', rest: 'reduce risk' };
  }
  if (n > 0 && u < -Math.max(Math.abs(nw) * 0.008, 12)) {
    return { tone: 'defend', title: 'Under pressure', rest: 'open PnL is offside — defend or cut' };
  }
  if (n > 0) {
    return { tone: 'active', title: 'Active', rest: `${n} position${n === 1 ? '' : 's'} live` };
  }
  return { tone: 'idle', title: 'Idle', rest: 'waiting for opportunity' };
}

function moodTitleClass(tone: PortfolioMoodTone): string {
  switch (tone) {
    case 'idle':
      return 'text-sigflo-accent';
    case 'active':
      return 'text-emerald-300';
    case 'risk':
      return 'text-amber-300';
    case 'defend':
      return 'text-rose-300';
    default:
      return 'text-sigflo-muted';
  }
}

/** Approximate USDT notional for linear positions (size × entry). */
function positionNotionalUsd(p: PositionItem): number {
  return Math.abs(p.size * p.entryPrice);
}

const STABLE_ASSETS = new Set(['USDT', 'USDC', 'USD', 'BUSD', 'DAI', 'TUSD', 'FDUSD', 'USDE']);

function aggregateStablesAndPnl(snapshots: ExchangeSnapshot[]) {
  let stables = 0;
  let unrealized = 0;
  let connected = false;
  for (const s of snapshots) {
    if (s.status !== 'connected') continue;
    connected = true;
    for (const b of s.balances) {
      if (STABLE_ASSETS.has(b.asset.toUpperCase())) stables += b.total;
    }
    for (const p of s.positions) unrealized += p.unrealizedPnl ?? 0;
  }
  return { stables, unrealized, connected };
}

function flattenPositions(snapshots: ExchangeSnapshot[]): Array<PositionItem & { exchange: ExchangeId }> {
  const out: Array<PositionItem & { exchange: ExchangeId }> = [];
  for (const s of snapshots) {
    if (s.status !== 'connected') continue;
    for (const p of s.positions) out.push({ ...p, exchange: s.exchange });
  }
  return out;
}

function exposurePct(snapshots: ExchangeSnapshot[], equity: number): number {
  let notional = 0;
  for (const s of snapshots) {
    if (s.status !== 'connected') continue;
    for (const p of s.positions) notional += Math.abs(p.size * p.entryPrice);
  }
  if (notional <= 0) return 0;
  if (equity <= 0) return notional > 0 ? 100 : 0;
  return Math.min(100, Math.round((notional / equity) * 100));
}

function biasFromPositions(positions: PositionItem[]): { label: string; sub: string } {
  let longN = 0;
  let shortN = 0;
  let hasBtc = false;
  for (const p of positions) {
    if (p.side === 'long') longN += Math.abs(p.size * p.entryPrice);
    else shortN += Math.abs(p.size * p.entryPrice);
    if (p.symbol.includes('BTC')) hasBtc = true;
  }
  const label = longN > shortN * 1.05 ? 'Long' : shortN > longN * 1.05 ? 'Short' : 'Neutral';
  const sub = hasBtc ? 'BTC correlated' : positions.length ? 'Mixed book' : '—';
  return { label, sub };
}

function leverageLabel(exposure: number): { value: string; sub: string } {
  if (exposure >= 70) return { value: 'High', sub: 'Risk level' };
  if (exposure >= 35) return { value: 'Medium', sub: 'Risk level' };
  return { value: 'Low', sub: 'Risk level' };
}

function closedPnlTodayUtc(closed: ClosedTradeRow[]): number {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return closed.reduce((sum, t) => {
    const d = new Date(t.closedAt);
    return d >= start ? sum + t.closedPnl : sum;
  }, 0);
}

function closedPnlLastDays(closed: ClosedTradeRow[], days: number): number {
  const cutoff = Date.now() - days * 86400000;
  return closed.filter((t) => new Date(t.closedAt).getTime() >= cutoff).reduce((s, t) => s + t.closedPnl, 0);
}

function winRatePercent(closedPnl: number[]): number | null {
  const settled = closedPnl.filter((x) => Math.abs(x) >= 1e-10);
  if (settled.length === 0) return null;
  return Math.round((settled.filter((x) => x > 0).length / settled.length) * 100);
}

function winStreakNewestFirst(closed: ClosedTradeRow[]): number {
  let s = 0;
  for (const t of closed) {
    if (t.closedPnl > 1e-10) s += 1;
    else if (t.closedPnl < -1e-10) break;
  }
  return s;
}

function formatUsd2(n: number): string {
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtSignedUsd(n: number): string {
  const sign = n >= 0 ? '+' : '-';
  return `${sign}$${formatUsd2(n)}`;
}

function fmtSignedPct(n: number): string {
  const sign = n >= 0 ? '+' : '-';
  return `${sign}${Math.abs(n).toFixed(1)}%`;
}

function pairLabel(symbol: string): string {
  if (symbol.endsWith('USDT')) return `${symbolToPair(symbol)} / USDT`;
  return symbol;
}

/** Base asset for linear-style symbols (e.g. BTCUSDT → BTC). */
function linearSymbolBase(symbol: string): string {
  const u = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const quotes = ['USDT', 'USDC', 'USD', 'BUSD', 'USDE', 'PERP'] as const;
  for (const q of quotes) {
    if (u.endsWith(q) && u.length > q.length) return u.slice(0, -q.length);
  }
  return u || symbol;
}

/**
 * One-line book read when multiple positions are open — confidence, not exchange tables.
 * (Position “quality score” per leg can layer on later with entry time + regime data.)
 */
function multiPositionBookLine(positions: PositionItem[]): string | null {
  if (positions.length < 2) return null;
  const bases = positions.map((p) => linearSymbolBase(p.symbol));
  const uniq = [...new Set(bases)];
  const n = positions.length;

  if (uniq.length === 1) {
    const b = uniq[0];
    if (n === 2 && b === 'BTC') return '2 positions open — both BTC-correlated';
    if (n === 2) return `2 positions open — both ${b}-correlated`;
    if (b === 'BTC') return `${n} positions open — all BTC-correlated`;
    return `${n} positions open — all ${b}-correlated`;
  }

  const majors = new Set([
    'BTC',
    'ETH',
    'SOL',
    'BNB',
    'XRP',
    'DOGE',
    'ADA',
    'AVAX',
    'LINK',
    'DOT',
    'POL',
    'MATIC',
  ]);
  if (uniq.every((b) => majors.has(b))) {
    return `${n} positions open — majors basket; tape still keys off BTC`;
  }

  return `${n} positions open — different underlyings; PnL won’t move as one`;
}

function sparklinePath(values: number[], w: number, h: number): { line: string; area: string } {
  if (values.length < 2) return { line: '', area: '' };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / span) * (h * 0.72) - h * 0.14;
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  return { line, area };
}

function buildSparklineSeries(netWorth: number, up: boolean): number[] {
  const n = 36;
  const out: number[] = [];
  let v = netWorth * (up ? 0.94 : 1.04);
  for (let i = 0; i < n; i++) {
    const pull = (netWorth - v) * 0.11;
    v += pull + Math.sin(i * 0.55) * netWorth * 0.0015;
    out.push(v);
  }
  out[n - 1] = netWorth;
  return out;
}

export default function PortfolioScreen() {
  const navigate = useNavigate();
  const { items: snapshots, closedTrades, loading } = useAccountSnapshot();
  const { signals, liveTickersBySymbol } = useSignalEngine();
  const [closedExpanded, setClosedExpanded] = useState(false);

  const feedOpportunityCount = useMemo(() => signals.filter(isFeedActionableOpportunity).length, [signals]);

  const { stables, unrealized, connected } = useMemo(() => aggregateStablesAndPnl(snapshots), [snapshots]);
  const positions = useMemo(() => flattenPositions(snapshots), [snapshots]);
  const multiBookLine = useMemo(() => multiPositionBookLine(positions), [positions]);
  const netWorth = connected ? stables + unrealized : 0;
  const todayPnl = useMemo(() => (connected ? closedPnlTodayUtc(closedTrades) : 0), [connected, closedTrades]);
  const todayPct = connected
    ? (todayPnl / Math.max(Math.abs(netWorth - todayPnl), Math.max(Math.abs(netWorth), 1))) * 100
    : 0;

  const exposure = useMemo(() => exposurePct(snapshots, Math.max(netWorth, 1)), [snapshots, netWorth]);
  const bias = useMemo(() => biasFromPositions(positions), [positions]);
  const lev = leverageLabel(exposure);

  const weeklyClosedSum = useMemo(() => closedPnlLastDays(closedTrades, 7), [closedTrades]);
  const weeklyAvg = weeklyClosedSum / 7;

  const netWorthInsightWithPositions = useMemo(() => {
    if (todayPnl > 0 && todayPnl > weeklyAvg && weeklyAvg > 0) return 'Strong day — above weekly average';
    if (todayPnl < -1e-6) return 'Red session — consider sizing down if stressed';
    if (unrealized >= 0) return 'Book is green on open PnL';
    return 'Open PnL underwater — watch risk';
  }, [todayPnl, weeklyAvg, unrealized]);

  const riskInsight = useMemo(() => {
    if (!connected) return 'Connect an account to see how your capital is deployed.';
    if (positions.length === 0) {
      const idleCopy =
        new Date().getDate() % 2 === 0
          ? "No exposure — you're fully in cash"
          : 'No active risk — waiting for deployment';
      return idleCopy;
    }
    if (exposure >= 60 && bias.label !== 'Neutral')
      return `You're leaning in — book skews ${bias.label.toLowerCase()}, keep size honest`;
    if (exposure < 25) return 'Light touch — room to add size if a setup deserves it';
    return "Risk looks balanced — don't forget where you'd tap out";
  }, [connected, positions.length, exposure, bias.label]);

  const winRate = useMemo(() => winRatePercent(closedTrades.map((t) => t.closedPnl)), [closedTrades]);
  const last10Sum = useMemo(
    () => closedTrades.slice(0, 10).reduce((s, t) => s + t.closedPnl, 0),
    [closedTrades],
  );
  const streak = useMemo(() => winStreakNewestFirst(closedTrades), [closedTrades]);

  const perfInsight = useMemo(() => {
    if (!connected) return 'Connect your exchange to track win rate and streaks here.';
    if (closedTrades.length < 3) return 'No trade history yet — start small and build consistency';
    if (winRate !== null && winRate >= 58) return 'You perform best when trends extend — ride winners';
    return 'Choppy window — favor smaller size until edge returns';
  }, [connected, closedTrades.length, winRate]);

  const topActionable = useMemo(() => {
    const list = signals.filter(isFeedActionableOpportunity);
    if (list.length === 0) return undefined;
    return [...list].sort((a, b) => b.setupScore - a.setupScore)[0];
  }, [signals]);

  const insightRows = useMemo((): { key: string; node: ReactNode }[] => {
    const rows: { key: string; node: ReactNode }[] = [];
    const feedLinkClass =
      'font-semibold text-sigflo-accent underline decoration-sigflo-accent/45 underline-offset-2 transition hover:decoration-sigflo-accent';

    if (!connected) {
      rows.push({
        key: 'connect',
        node: (
          <>
            <span className="text-sigflo-text">Link Bybit in </span>
            <Link to="/profile" className={feedLinkClass}>
              Account
            </Link>
            <span className="text-sigflo-text"> — then Sigflo can speak from your real book.</span>
          </>
        ),
      });
      return rows;
    }

    if (positions.length === 0 && feedOpportunityCount > 0) {
      rows.push({
        key: 'waiting-feed',
        node: (
          <>
            <span className="text-sigflo-text">No positions — </span>
            <Link to="/feed?filter=actionable" className={feedLinkClass}>
              {feedOpportunityCount} setup{feedOpportunityCount === 1 ? '' : 's'} waiting in Feed
            </Link>
          </>
        ),
      });
    }

    const btcDay = liveTickersBySymbol['BTCUSDT']?.price24hPcnt ?? 0;
    if (rows.length < 2 && topActionable && feedOpportunityCount > 0) {
      if (topActionable.pair === 'BTC' && btcDay > 0.015) {
        rows.push({
          key: 'btc-trend',
          node: (
            <span className="text-sigflo-text">
              BTC trending on the day — strongest setup is on the board.{' '}
              <Link to="/feed?filter=actionable" className={feedLinkClass}>
                Open Feed
              </Link>
            </span>
          ),
        });
      } else {
        rows.push({
          key: 'top-pair',
          node: (
            <span className="text-sigflo-text">
              <span className="font-semibold text-white">{topActionable.pair}</span> leads your actionable list —{' '}
              <Link to="/feed?filter=actionable" className={feedLinkClass}>
                review in Feed
              </Link>
              .
            </span>
          ),
        });
      }
    }

    if (rows.length < 2 && positions.length === 0 && feedOpportunityCount === 0) {
      rows.push({
        key: 'flat-no-feed',
        node: (
          <span className="text-sigflo-text">
            No positions — tape is quiet. Scan{' '}
            <Link to="/markets" className={feedLinkClass}>
              Markets
            </Link>
            {' '}or check back when Feed lights up.
          </span>
        ),
      });
    }

    if (rows.length < 2 && positions.length > 0 && feedOpportunityCount > 0) {
      rows.push({
        key: 'in-play-feed',
        node: (
          <span className="text-sigflo-text">
            You’re deployed — plus {feedOpportunityCount} actionable idea
            {feedOpportunityCount === 1 ? '' : 's'} in{' '}
            <Link to="/feed?filter=actionable" className={feedLinkClass}>
              Feed
            </Link>
            .
          </span>
        ),
      });
    }

    if (rows.length < 2 && exposure >= 55 && bias.label === 'Long') {
      rows.push({
        key: 'long-heavy',
        node: (
          <span className="text-sigflo-text">
            Long book is chunky — trim into strength if the tape stalls.
          </span>
        ),
      });
    }

    if (rows.length === 0) {
      rows.push({
        key: 'calm',
        node: (
          <span className="text-sigflo-text">Sigflo’s watching — one clear plan beats ten noisy clicks.</span>
        ),
      });
    }
    if (rows.length === 1) {
      rows.push({
        key: 'second-nudge',
        node: (
          <span className="text-sigflo-muted">
            Tip: keep size boring on first fills, then let winners prove themselves.
          </span>
        ),
      });
    }

    return rows.slice(0, 2);
  }, [
    connected,
    positions.length,
    feedOpportunityCount,
    topActionable,
    liveTickersBySymbol,
    exposure,
    bias.label,
  ]);

  const spark = useMemo(() => {
    const nw = connected ? netWorth : 1248.32;
    const up = connected ? todayPnl >= 0 : true;
    return buildSparklineSeries(Math.max(nw, 0.01), up);
  }, [connected, netWorth, todayPnl]);
  const { line: sparkPath, area: sparkArea } = useMemo(() => sparklinePath(spark, 280, 76), [spark]);

  const displayNet = connected ? netWorth : null;
  const displayToday = connected ? todayPnl : null;
  const displayTodayPct = connected ? todayPct : null;

  const portfolioMood = useMemo(
    () =>
      computePortfolioMood({
        connected,
        loading: Boolean(loading && connected),
        positionCount: positions.length,
        exposurePct: exposure,
        unrealizedPnl: unrealized,
        netWorth,
      }),
    [connected, loading, positions.length, exposure, unrealized, netWorth],
  );

  return (
    <div className="space-y-5 pb-8 pt-3 transition-opacity duration-300">
      {/* 1. Net worth */}
      <section
        className={`relative overflow-hidden rounded-[18px] border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-transparent px-4 pb-4 pt-4 shadow-card ${cardInteract}`}
        style={{ boxShadow: '0 0 0 1px rgba(0,255,200,0.06), 0 12px 40px rgba(0,0,0,0.45)' }}
      >
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-sigflo-muted/90">Your situation</p>
        <p className="mt-1.5 text-[15px] font-semibold leading-snug tracking-tight">
          <span className={moodTitleClass(portfolioMood.tone)}>{portfolioMood.title}</span>
          <span className="font-medium text-sigflo-muted"> — </span>
          <span className="text-white/88">{portfolioMood.rest}</span>
        </p>
        <div className="my-3 border-b border-white/[0.07]" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sigflo-muted">Net worth</p>
        {loading && connected ? (
          <p className="mt-2 text-2xl font-bold text-white/50">…</p>
        ) : displayNet !== null ? (
          <p className="mt-1 font-mono text-3xl font-bold tracking-tight text-white">${formatUsd2(displayNet)}</p>
        ) : (
          <p className="mt-1 font-mono text-3xl font-bold tracking-tight text-white/80">$—</p>
        )}
        {displayToday !== null && displayTodayPct !== null ? (
          <p
            className={`mt-2 text-sm font-semibold ${displayToday >= 0 ? 'text-sigflo-accent' : 'text-sigflo-loss'}`}
          >
            {fmtSignedUsd(displayToday)} today ({fmtSignedPct(displayTodayPct)})
          </p>
        ) : (
          <p className="mt-2 text-sm text-sigflo-muted">Today’s PnL unlocks with a connected account</p>
        )}
        <div className="mt-4 overflow-hidden rounded-xl bg-black/35 px-1 py-1">
          <svg viewBox="0 0 280 76" className="h-[76px] w-full" aria-hidden>
            <defs>
              <linearGradient id="nw-spark-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity="0.2" />
                <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
              </linearGradient>
            </defs>
            {sparkArea ? <path d={sparkArea} fill="url(#nw-spark-fill)" /> : null}
            {sparkPath ? (
              <g className="motion-safe:animate-spark-glow">
                <path
                  d={sparkPath}
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  className="opacity-95"
                />
              </g>
            ) : null}
          </svg>
        </div>
        {!connected ? (
          <p className="mt-3 text-center text-[11px] leading-relaxed text-sigflo-muted">
            Connect your exchange in Account to see live net worth.
          </p>
        ) : positions.length === 0 ? (
          <p className="mt-3 text-center text-[11px] leading-relaxed">
            {feedOpportunityCount > 0 ? (
              <>
                <span className="text-sigflo-text">No positions — </span>
                <Link
                  to="/feed?filter=actionable"
                  className="font-semibold text-sigflo-accent underline decoration-sigflo-accent/40 underline-offset-2 transition hover:decoration-sigflo-accent"
                >
                  {feedOpportunityCount} opportunit{feedOpportunityCount === 1 ? 'y' : 'ies'} available in Feed
                </Link>
              </>
            ) : (
              <span className="text-sigflo-muted">No active positions — capital ready</span>
            )}
          </p>
        ) : (
          <p className="mt-3 text-center text-[11px] leading-relaxed text-sigflo-muted">{netWorthInsightWithPositions}</p>
        )}
      </section>

      {/* 2. Risk overview */}
      <section className="space-y-3">
        <div className="grid grid-cols-3 gap-2.5">
          <div
            className={`flex min-h-[108px] flex-col rounded-[16px] border border-white/[0.06] bg-sigflo-surface/90 px-2.5 py-3 text-center shadow-card ${cardInteract}`}
          >
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-sigflo-muted">Exposure</p>
            <p className="mt-auto text-xl font-bold text-white">{connected ? `${exposure}%` : '—'}</p>
            <p className="mt-0.5 text-[9px] text-sigflo-muted">Capital in use</p>
          </div>
          <div
            className={`flex min-h-[108px] flex-col rounded-[16px] border border-white/[0.06] bg-sigflo-surface/90 px-2.5 py-3 text-center shadow-card ${cardInteract}`}
          >
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-sigflo-muted">Bias</p>
            <p className="mt-auto text-lg font-bold text-white">{connected ? bias.label : '—'}</p>
            <p className="mt-0.5 text-[9px] text-sigflo-muted">{connected ? bias.sub : '—'}</p>
          </div>
          <div
            className={`flex min-h-[108px] flex-col rounded-[16px] border border-white/[0.06] bg-sigflo-surface/90 px-2.5 py-3 text-center shadow-card ${cardInteract}`}
          >
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-sigflo-muted">Leverage</p>
            <p className="mt-auto text-lg font-bold text-white">{connected ? lev.value : '—'}</p>
            <p className="mt-0.5 text-[9px] text-sigflo-muted">{lev.sub}</p>
          </div>
        </div>
        <p className="px-1 text-center text-[11px] leading-relaxed text-sigflo-muted">{riskInsight}</p>
      </section>

      {/* 3. Open positions */}
      <section className="space-y-3">
        <h2 className={sectionTitleClass}>Open positions</h2>
        {!connected ? (
          <div className="rounded-[16px] border border-dashed border-white/[0.1] bg-black/25 px-4 py-6 text-center text-sm text-sigflo-muted">
            No exchange linked — connect in Account to sync positions.
          </div>
        ) : loading ? (
          <p className="text-sm text-sigflo-muted">Loading positions…</p>
        ) : positions.length === 0 ? (
          <div
            className={`rounded-[16px] border border-sigflo-accent/15 bg-gradient-to-b from-sigflo-accent/[0.07] to-sigflo-surface/90 px-4 py-6 text-center shadow-[0_0_28px_-12px_rgba(0,255,200,0.2)] ${cardInteract}`}
          >
            <p className="text-base font-semibold text-white">No open positions</p>
            <p className="mt-1.5 text-[13px] leading-snug text-sigflo-muted">Check Feed for active setups</p>
            <Link
              to="/feed?filter=actionable"
              className="mt-4 inline-flex items-center justify-center rounded-xl border border-sigflo-accent/35 bg-sigflo-accent/10 px-4 py-2.5 text-sm font-semibold text-sigflo-accent transition hover:border-sigflo-accent/50 hover:bg-sigflo-accent/15 active:scale-[0.98]"
            >
              View Opportunities →
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {multiBookLine ? (
              <p className="rounded-[14px] border border-cyan-400/15 bg-gradient-to-r from-cyan-400/[0.06] to-transparent px-3.5 py-2.5 text-[12px] font-medium leading-snug tracking-tight text-cyan-100/95">
                {multiBookLine}
              </p>
            ) : null}
            {positions.map((p, index) => {
              const current = p.markPrice ?? p.entryPrice;
              const pnl = p.unrealizedPnl ?? 0;
              const pnlPct =
                p.entryPrice > 0
                  ? ((p.side === 'long' ? current - p.entryPrice : p.entryPrice - current) / p.entryPrice) * 100
                  : 0;
              const up = pnl >= 0;
              const ticker = liveTickersBySymbol[p.symbol];
              const insight = positionMicroInsight({ side: p.side }, current, pnlPct, ticker);
              const notional = positionNotionalUsd(p);
              const tradeExtras =
                p.entryPrice > 0
                  ? {
                      positionUsd: Math.max(1, Math.round(notional)),
                      entryPrice: p.entryPrice,
                      posSize: p.size,
                      markPrice: current,
                    }
                  : undefined;
              const tradeQuery = buildPortfolioPositionTradeQuery(p.symbol, p.side, tradeExtras);
              return (
                <PositionSwipeCard
                  key={`${p.exchange}-${p.symbol}-${index}`}
                  onOpen={() => navigate(`/trade?${tradeQuery}`)}
                  onSwipeClose={() =>
                    navigate(
                      `/trade?${buildPortfolioPositionTradeQuery(p.symbol, p.side, { ...tradeExtras, ticketIntent: 'close' })}`,
                    )
                  }
                  onSwipeAdd={() =>
                    navigate(
                      `/trade?${buildPortfolioPositionTradeQuery(p.symbol, p.side, { ...tradeExtras, ticketIntent: 'add' })}`,
                    )
                  }
                >
                  <div
                    className={`group relative overflow-hidden rounded-[16px] border px-4 py-4 text-left transition-transform duration-200 ease-out will-change-transform hover:scale-[1.01] active:scale-[0.98] ${
                      up
                        ? 'border-emerald-400/[0.20] bg-gradient-to-br from-emerald-500/[0.055] via-sigflo-surface/45 to-sigflo-surface/30 shadow-[0_0_0_1px_rgba(52,211,153,0.09),0_0_36px_-12px_rgba(52,211,153,0.18)]'
                        : 'border-rose-400/[0.12] bg-gradient-to-b from-rose-950/[0.20] via-[#0d0a0c] to-sigflo-surface shadow-[inset_0_1px_0_0_rgba(248,113,113,0.06)]'
                    }`}
                  >
                    {up ? (
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 z-[2] overflow-hidden rounded-[16px]"
                      >
                        <div className="absolute -left-1/2 top-0 h-full w-[80%] animate-position-shimmer bg-gradient-to-r from-transparent via-emerald-100/[0.09] to-transparent" />
                      </div>
                    ) : null}
                    <div className="relative z-[3]">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-base font-bold tracking-tight text-white">{pairLabel(p.symbol)}</p>
                        <span
                          className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                            p.side === 'long' ? 'bg-emerald-500/25 text-emerald-300' : 'bg-rose-500/25 text-rose-300'
                          }`}
                        >
                          {p.side === 'long' ? 'LONG' : 'SHORT'}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-sigflo-muted">
                        {p.exchange}
                      </p>

                      <div className="mt-4">
                        <p
                          className={`font-mono text-2xl font-bold tabular-nums tracking-tight ${up ? 'text-sigflo-accent' : 'text-sigflo-loss'}`}
                        >
                          {fmtSignedUsd(pnl)}
                        </p>
                        <p
                          className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${up ? 'text-sigflo-accent/90' : 'text-sigflo-loss/90'}`}
                        >
                          ({fmtSignedPct(pnlPct)})
                        </p>
                      </div>

                      <div className="mt-3 space-y-1 text-[11px] leading-relaxed text-sigflo-muted">
                        <p>
                          Entry → Current{' '}
                          <span className="font-medium text-sigflo-text">
                            {formatQuoteNumber(p.entryPrice)} → {formatQuoteNumber(current)}
                          </span>
                        </p>
                        {notional >= 1 ? (
                          <p>
                            Size{' '}
                            <span className="font-medium text-sigflo-text">
                              ${Math.round(notional).toLocaleString('en-US')} position
                            </span>
                          </p>
                        ) : null}
                      </div>

                      <p className="mt-3 border-t border-white/[0.08] pt-2.5 text-[11px] font-medium leading-snug text-cyan-200/95">
                        {insight}
                      </p>

                      <div className="mt-2 flex justify-end">
                        <span className="text-[11px] font-semibold text-sigflo-accent/90 transition group-hover:translate-x-0.5">
                          Chart →
                        </span>
                      </div>
                    </div>
                  </div>
                </PositionSwipeCard>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. Performance */}
      <section
        className={`space-y-3 rounded-[18px] border border-white/[0.06] bg-sigflo-surface/90 p-4 shadow-card ${cardInteract}`}
      >
        <h2 className={sectionTitleClass}>Performance</h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-sigflo-muted">Win rate</p>
            <p className="mt-1 text-lg font-bold text-white">
              {!connected ? '—' : loading ? '…' : winRate !== null ? `${winRate}%` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-sigflo-muted">Last 10</p>
            <p
              className={`mt-1 text-lg font-bold tabular-nums ${
                !connected ? 'text-white' : last10Sum >= 0 ? 'text-sigflo-accent' : 'text-sigflo-loss'
              }`}
            >
              {!connected ? '—' : loading ? '…' : fmtSignedUsd(last10Sum)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-sigflo-muted">Streak</p>
            <p className="mt-1 text-lg font-bold text-white">
              {!connected ? '—' : loading ? '…' : streak > 0 ? `${streak} win${streak === 1 ? '' : 's'}` : 'No streak'}
            </p>
          </div>
        </div>
        <p className="text-center text-[11px] leading-relaxed text-sigflo-muted">{perfInsight}</p>
      </section>

      {/* 5. Insights */}
      <section
        className={`rounded-[18px] border border-sigflo-accent/20 bg-gradient-to-br from-sigflo-accent/10 via-transparent to-transparent px-4 py-4 shadow-glow-sm ${cardInteract}`}
        style={{ boxShadow: '0 0 32px -12px rgba(0,255,200,0.22)' }}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-sigflo-accent/25 bg-sigflo-accent/10 text-sigflo-accent">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />
            </svg>
          </span>
          <p className={`${sectionTitleClass} text-sigflo-accent`}>Insights</p>
        </div>
        <ul className="mt-3 space-y-2.5">
          {insightRows.map((row) => (
            <li key={row.key} className="text-[13px] leading-relaxed text-sigflo-text">
              {row.node}
            </li>
          ))}
        </ul>
      </section>

      {/* 6. Closed trades */}
      <section className={`rounded-[18px] border border-white/[0.06] bg-sigflo-surface/90 shadow-card ${cardInteract}`}>
        <button
          type="button"
          onClick={() => setClosedExpanded((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3.5 text-left transition hover:bg-white/[0.03]"
        >
          <span className="text-sm font-semibold text-white">Closed trades</span>
          <span className="text-sigflo-muted">{closedExpanded ? '▴' : '▾'}</span>
        </button>
        {closedExpanded ? (
          <div className="space-y-2 border-t border-white/[0.05] px-4 py-3">
            {!connected ? (
              <p className="text-xs text-sigflo-muted">Connect an exchange to import closed PnL.</p>
            ) : loading ? (
              <p className="text-xs text-sigflo-muted">Loading…</p>
            ) : closedTrades.length === 0 ? (
              <p className="text-xs text-sigflo-muted">No rows in the current Bybit window.</p>
            ) : (
              closedTrades.slice(0, 3).map((t, i) => (
                <div
                  key={`${t.exchange}-${t.orderId ?? i}-${t.closedAt}`}
                  className="flex items-center justify-between rounded-xl bg-black/30 px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{pairLabel(t.symbol)}</p>
                    <p className="text-[10px] text-sigflo-muted">{t.exchange}</p>
                  </div>
                  <p className={t.closedPnl >= 0 ? 'text-sm font-semibold text-sigflo-accent' : 'text-sm font-semibold text-sigflo-loss'}>
                    {fmtSignedUsd(t.closedPnl)}
                  </p>
                </div>
              ))
            )}
            <a
              href={BYBIT_HISTORY_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex w-full items-center justify-center rounded-xl border border-sigflo-accent/30 py-2.5 text-xs font-semibold text-sigflo-accent transition hover:bg-sigflo-accent/10"
            >
              View full history on Bybit →
            </a>
          </div>
        ) : null}
      </section>
    </div>
  );
}
