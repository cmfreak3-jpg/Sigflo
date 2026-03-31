import { useNavigate } from 'react-router-dom';
import { LiveBadge } from '@/components/ui/LiveBadge';
import { buildTradeQueryString } from '@/lib/tradeNavigation';
import { deriveMarketStatus } from '@/lib/marketScannerRows';
import { formatQuoteNumber } from '@/lib/formatQuote';
import type { CryptoSignal } from '@/types/signal';
import type { Candle } from '@/types/market';

function confidenceLabel(score: number): string {
  if (score >= 85) return 'Elite';
  if (score >= 70) return 'Strong';
  if (score >= 55) return 'OK';
  return 'Weak';
}

function riskShort(tag: string): string {
  return tag.replace(' Risk', '');
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

export function SignalCard({ signal, miniCandles }: { signal: CryptoSignal; miniCandles?: Candle[] }) {
  const navigate = useNavigate();
  const isTriggered = deriveMarketStatus(signal) === 'triggered';
  const miniSeries =
    miniCandles && miniCandles.length >= 8 ? seriesFromCandles(miniCandles.slice(-28)) : buildMiniSeries(signal);
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
      className="group cursor-pointer animate-fade-in-up"
      aria-label={`Open trade for ${signal.pair}`}
    >
      <div
        className={`relative overflow-hidden rounded-2xl border bg-sigflo-surface p-5 transition-all active:scale-[0.98] ${
          isTriggered
            ? 'border-sigflo-accent/25 animate-glow-breathe'
            : 'border-white/[0.06] hover:border-white/10'
        }`}
      >
        {/* Top row: pair + timeframe | live badge or time ago */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex shrink-0 items-center gap-2">
            <h2 className="text-base font-bold tracking-tight text-white">{signal.pair}/USDT</h2>
            <span className="text-[11px] text-sigflo-muted">5m</span>
          </div>
          <div className="mx-1 min-w-0 flex-1">
            <div className="overflow-hidden rounded-md border border-white/[0.05] bg-black/20 px-1.5 py-1">
              <svg viewBox={`0 0 ${chartW} ${chartH}`} className="h-[60px] w-full" aria-hidden>
                <defs>
                  <linearGradient id={`sigflo-area-${signal.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={signal.side === 'long' ? '#22d3ee' : '#fb7185'} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={signal.side === 'long' ? '#22d3ee' : '#fb7185'} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={area} fill={`url(#sigflo-area-${signal.id})`} />
                <path
                  d={line}
                  fill="none"
                  stroke={signal.side === 'long' ? '#2dd4bf' : '#fb7185'}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
          {isTriggered ? (
            <div className="shrink-0">
              <LiveBadge />
            </div>
          ) : (
            <span className="shrink-0 text-[11px] text-sigflo-muted">{signal.postedAgo}</span>
          )}
        </div>

        {/* Entry + confidence + risk */}
        <div className="mt-7 flex items-end justify-between gap-3 text-xs">
          <span className="text-sigflo-muted">
            Entry:{' '}
            <span className="text-base font-bold tabular-nums tracking-tight text-white">
              {formatQuoteNumber(signal.setupScore >= 70 ? 67240 : 1842)}
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
          Open Trade →
        </button>
      </div>
    </article>
  );
}
