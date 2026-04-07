import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildTradeQueryString } from '@/lib/tradeNavigation';
import { deriveMarketStatus } from '@/lib/marketScannerRows';
import { formatQuoteNumber } from '@/lib/formatQuote';
import { useTriggeredMotion } from '@/hooks/useTriggeredMotion';
import {
  formatElapsedAgo,
  postedAgoToSeconds,
  uiSignalStateClasses,
  uiSignalStateFromMarketStatus,
  uiSignalStateLabel,
} from '@/lib/signalState';
import type { CryptoSignal } from '@/types/signal';
import type { Candle } from '@/types/market';

function confidenceLabel(score: number): string {
  if (score >= 70) return 'Strong';
  if (score >= 55) return 'Medium';
  return 'Weak';
}

function riskShort(tag: string): string {
  return tag.replace(' Risk', '');
}

function isFreshPosted(postedAgo: string): boolean {
  const v = postedAgo.trim().toLowerCase();
  if (v === 'live' || v === 'just now') return true;
  const m = /^(\d+)\s*m/.exec(v);
  if (m) return Number(m[1]) <= 10;
  return false;
}

function buildMiniSeries(signal: CryptoSignal): number[] {
  const len = 22;
  const trendBias = (signal.scoreBreakdown.trendAlignment - 12) / 22;
  const momentumBias = (signal.scoreBreakdown.momentumQuality - 10) / 18;
  const structureBias = (signal.scoreBreakdown.structureQuality - 12) / 20;
  const setupBias = (signal.setupScore - 60) / 120;
  const sideBias = signal.side === 'long' ? 0.02 : -0.02;
  const slope = trendBias * 0.45 + momentumBias * 0.25 + structureBias * 0.2 + setupBias * 0.1 + sideBias;
  const waveA = 0.05 + Math.abs(momentumBias) * 0.04;
  const waveB = 0.03 + Math.abs(structureBias) * 0.03;
  const out: number[] = [];

  for (let i = 0; i < len; i += 1) {
    const t = i / (len - 1);
    const a = Math.sin((i + signal.id.length) * 0.75) * waveA;
    const b = Math.cos((i + signal.setupScore) * 0.35) * waveB;
    const v = 0.5 + slope * (t - 0.5) + a + b;
    out.push(Math.max(0.08, Math.min(0.92, v)));
  }
  return out;
}

function sparkPath(series: number[], w: number, h: number): string {
  return series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * w;
      const y = h - v * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

function seriesFromCandles(candles: Candle[]): number[] {
  if (candles.length === 0) return [];
  const closes = candles.map((c) => c.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = Math.max(0.000001, max - min);
  return closes.map((v) => Math.max(0.08, Math.min(0.92, (v - min) / span)));
}

export function SignalCard({
  signal,
  miniCandles,
  intervalLabel = '5m',
}: {
  signal: CryptoSignal;
  miniCandles?: Candle[];
  /** Matches trade chart timeframe (e.g. `15m`, `1h`). */
  intervalLabel?: string;
}) {
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((v) => v + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const ageBaseSeconds = useMemo(() => postedAgoToSeconds(signal.postedAgo), [signal.postedAgo]);
  const liveAgeLabel = useMemo(() => formatElapsedAgo(ageBaseSeconds + tick), [ageBaseSeconds, tick]);
  const marketStatus = deriveMarketStatus(signal);
  const uiState = uiSignalStateFromMarketStatus(marketStatus);
  const uiStateStyle = uiSignalStateClasses(uiState);
  const isTriggered = uiState === 'triggered';
  const justTriggered = useTriggeredMotion(isTriggered, 900);
  const isFreshTriggered = isTriggered && isFreshPosted(signal.postedAgo);
  const hoverOutlineClass =
    uiState === 'triggered'
      ? 'group-hover:ring-2 group-hover:ring-[rgba(0,255,200,0.34)] group-hover:border-[rgba(0,255,200,0.52)]'
      : uiState === 'in_play'
        ? 'group-hover:ring-2 group-hover:ring-cyan-400/24 group-hover:border-cyan-300/34'
        : 'group-hover:ring-2 group-hover:ring-slate-400/20 group-hover:border-slate-300/24';
  const sideChipClass =
    signal.side === 'long'
      ? 'border-emerald-400/30 bg-emerald-500/12 text-emerald-300'
      : 'border-rose-400/30 bg-rose-500/12 text-rose-300';
  const entryValue =
    miniCandles && miniCandles.length > 0
      ? miniCandles[miniCandles.length - 1].close
      : signal.pair === 'BTC'
        ? 67240
        : signal.pair === 'ETH'
          ? 1842
          : signal.pair === 'SOL'
            ? 152
            : signal.pair === 'AVAX'
              ? 38
              : 100;
  const miniSeries =
    miniCandles && miniCandles.length >= 8 ? seriesFromCandles(miniCandles.slice(-28)) : buildMiniSeries(signal);
  const miniIsUp =
    miniCandles && miniCandles.length >= 2
      ? miniCandles[miniCandles.length - 1].close >= miniCandles[0].close
      : miniSeries[miniSeries.length - 1] >= miniSeries[0];
  const miniLineColor = miniIsUp ? '#34d399' : '#fb7185';
  const chartW = 156;
  const chartH = 84;
  const line = sparkPath(miniSeries, chartW, chartH);
  const area = `${line} L${chartW},${chartH} L0,${chartH} Z`;
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
      className="group cursor-pointer animate-fade-in-up focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-[rgba(34,211,238,0.45)] focus-visible:ring-offset-0 [webkit-tap-highlight-color:transparent]"
      aria-label={`Open trade for ${signal.pair}`}
    >
      <div
        className={`relative overflow-hidden rounded-2xl border bg-sigflo-surface p-5 transition-all active:scale-[0.98] ${
          isTriggered
            ? isFreshTriggered
              ? 'scale-[1.01] border-[rgba(34,211,238,0.44)] shadow-[0_14px_34px_-18px_rgba(34,211,238,0.6)] ring-1 ring-[rgba(34,211,238,0.2)]'
              : `${uiStateStyle.card} sigflo-trigger-card-rest`
            : uiStateStyle.card
        } ${isTriggered && justTriggered ? 'sigflo-trigger-card-just' : ''} ${hoverOutlineClass} group-hover:-translate-y-[1px] group-hover:shadow-[0_16px_30px_-20px_rgba(0,0,0,0.65)]`}
      >
        {/* Top row: pair + timeframe | live badge or time ago */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex shrink-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-white">{signal.pair}/USDT</h2>
              <span className="text-[11px] text-sigflo-muted">{intervalLabel}</span>
            </div>
            <span
              className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${sideChipClass}`}
            >
              {signal.side}
            </span>
          </div>
          <div className="mx-1 min-w-0 flex-1">
            <div className="overflow-hidden rounded-md border border-white/[0.05] bg-black/20 px-1.5 py-1">
              <svg viewBox={`0 0 ${chartW} ${chartH}`} className="h-[60px] w-full" aria-hidden>
                <defs>
                  <linearGradient id={`sigflo-area-${signal.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={miniLineColor} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={miniLineColor} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={area} fill={`url(#sigflo-area-${signal.id})`} />
                <path
                  d={line}
                  fill="none"
                  stroke={miniLineColor}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
          {isTriggered ? (
            <div className="shrink-0 text-right">
              <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-200">
                <span className="relative inline-flex h-2 w-2">
                  {justTriggered ? <span className="absolute inset-[-1px] rounded-full border border-[#7fffe0]/45 sigflo-trigger-dot-halo" /> : null}
                  <span className={`absolute inline-flex h-full w-full rounded-full bg-[#00ffc8] sigflo-trigger-dot ${justTriggered ? 'sigflo-trigger-dot-just' : ''}`} />
                  <span className="relative inline-flex h-full w-full rounded-full bg-[#00ffc8]" />
                </span>
                TRIGGERED
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-white/85">{liveAgeLabel}</p>
            </div>
          ) : (
            <span className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold ${uiStateStyle.text}`}>
              <span className={`inline-flex h-1.5 w-1.5 rounded-full ${uiStateStyle.dot}`} />
              {uiSignalStateLabel(uiState)}
            </span>
          )}
        </div>

        {/* Entry + confidence + risk */}
        <div className="mt-7 flex items-end justify-between gap-3 text-xs">
          <span className={`text-sigflo-muted ${isTriggered ? `sigflo-trigger-entry-active ${justTriggered ? 'sigflo-trigger-entry-shimmer' : ''}` : ''}`}>
            Entry:{' '}
            <span className="animate-entry-pulse text-base font-bold tabular-nums tracking-tight text-white">
              {formatQuoteNumber(entryValue)}
            </span>
          </span>
          <div className="flex items-center gap-4 text-right">
            <span className="text-sigflo-muted">
              Confidence: <span className="font-semibold text-sigflo-accent">{confidenceLabel(signal.setupScore)}</span>
            </span>
            <span className="text-sigflo-muted">
              Risk: <span className={`font-semibold ${riskColor}`}>{riskShort(signal.riskTag)}</span>
            </span>
          </div>
        </div>

        {/* CTA */}
        <button
          type="button"
          className="mt-4 w-full rounded-xl bg-sigflo-accent/10 py-2.5 text-sm font-bold text-sigflo-accent transition hover:bg-sigflo-accent/15"
        >
          Open Signal
        </button>
      </div>
    </article>
  );
}
