import { useState } from 'react';
import { formatQuoteNumber } from '@/lib/formatQuote';

const ACCENT = '#00ffc8';

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/** Heuristic scenario probabilities from trade quality + setup (not market odds). */
export function computeScenarioProbabilities(args: {
  tradeScore: number;
  setupScore: number;
  side: 'long' | 'short';
}): { probUp: number; probDown: number } {
  const { tradeScore, setupScore, side } = args;
  const momentum = 28 + tradeScore * 0.38;
  const setupBias = (setupScore - 55) * 0.2;
  const probUp = Math.round(
    clamp(side === 'long' ? momentum + setupBias * 0.6 : momentum - setupBias * 0.35, 18, 84),
  );
  const probDown = Math.round(
    clamp(24 + (100 - tradeScore) * 0.3 + (side === 'short' ? setupBias * 0.45 : -setupBias * 0.25), 16, 76),
  );
  return { probUp, probDown };
}

function fmtUsdSigned(n: number, compact = false) {
  const sign = n >= 0 ? '+' : '−';
  const v = Math.round(Math.abs(n));
  const s = compact
    ? v >= 1000
      ? `${(v / 1000).toFixed(1)}k`
      : String(v)
    : v.toLocaleString('en-US');
  return `${sign}$${s}`;
}

export type TradeChartScenarioStripTradeProps = {
  mode: 'trade';
  estimatedPnlUsd: number;
  estimatedPnlPct: number;
  targetProfitUsd: number;
  stopLossUsd: number;
  riskReward: number;
  probUp: number;
  probDown: number;
  marginUsd: number;
  estFeeUsd: number;
  liqPrice: number | null;
  entry: number;
  stop: number;
  target: number;
  positionSizeUsd: number;
  leverage: number;
  isFutures: boolean;
  tradeScore: number;
  setupScore: number;
};

export type TradeChartScenarioStripManageProps = {
  mode: 'manage';
  pnlUsd: number;
  pnlPct: number;
  pair: string;
  entry: number;
  mark: number;
  sizeLabel: string;
  side: 'long' | 'short';
  riskReward: number;
};

export type TradeChartScenarioStripProps = TradeChartScenarioStripTradeProps | TradeChartScenarioStripManageProps;

export function TradeChartScenarioStrip(props: TradeChartScenarioStripProps) {
  const [open, setOpen] = useState(false);

  const isTrade = props.mode === 'trade';
  const pnlPositive = isTrade ? props.estimatedPnlUsd >= 0 : props.pnlUsd >= 0;

  const glowClass = pnlPositive
    ? 'shadow-[0_0_28px_-10px_rgba(0,255,200,0.35)] ring-1 ring-[#00ffc8]/15'
    : 'ring-1 ring-white/[0.06]';

  return (
    <div className="mx-auto w-full max-w-lg px-2 pb-1.5">
      <div
        className={`overflow-hidden rounded-2xl border border-white/[0.1] bg-gradient-to-b from-white/[0.05] to-black/55 transition-all duration-300 ease-out ${glowClass}`}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full gap-2 px-3 py-2.5 text-left transition active:scale-[0.995] md:px-3.5 md:py-3"
          aria-expanded={open}
        >
          {isTrade ? (
            <TradeStripTradeHero {...props} />
          ) : (
            <TradeStripManageHero {...props} />
          )}
          <div className="flex shrink-0 flex-col items-end justify-between py-0.5">
            <span className="text-[10px] font-semibold text-emerald-300/90">View scenario</span>
            <div className="mt-2 flex items-center gap-1">
              <div className="hidden text-[9px] leading-none tabular-nums text-sigflo-muted sm:block">
                {isTrade ? (
                  <span>
                    <span className="text-emerald-300/95">{props.probUp}%↑</span>
                    <span className="mx-0.5 text-white/25">/</span>
                    <span className="text-rose-300/90">{props.probDown}%↓</span>
                  </span>
                ) : (
                  <span className="uppercase tracking-wider">Live</span>
                )}
              </div>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                className={`shrink-0 text-sigflo-muted transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
                aria-hidden
              >
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </button>

        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="border-t border-white/[0.08] bg-black/40 px-2.5 py-2 text-[10px] leading-snug text-sigflo-muted sm:text-[11px]">
              {isTrade ? <TradeScenarioPanelTrade {...props} /> : <TradeScenarioPanelManage {...props} />}
              <p className="mt-1.5 border-t border-white/[0.06] pt-1.5 text-[8px] leading-snug text-sigflo-muted/80 sm:text-[9px]">
                {isTrade
                  ? 'Probabilities are scenario heuristics from setup + score (not exchange odds). Updates with size, leverage, and SL/TP.'
                  : 'Open position view — executes on your exchange.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TradeStripTradeHero(props: TradeChartScenarioStripTradeProps) {
  const roiPct = props.isFutures
    ? props.estimatedPnlPct * props.leverage
    : props.estimatedPnlPct;
  const pnlClass = props.estimatedPnlUsd >= 0 ? 'text-[#00ffc8]' : 'text-rose-300';

  return (
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sigflo-muted">Est. PnL</p>
      <p className={`mt-0.5 text-xl font-bold tabular-nums tracking-tight md:text-2xl ${pnlClass}`}>
        {fmtUsdSigned(props.estimatedPnlUsd)}{' '}
        <span className="text-base font-semibold md:text-lg">
          ({props.estimatedPnlPct >= 0 ? '+' : ''}
          {props.estimatedPnlPct.toFixed(1)}%)
        </span>
      </p>
      <div className="mt-2.5 grid grid-cols-3 gap-2 text-[10px]">
        <div>
          <p className="text-sigflo-muted">Entry</p>
          <p className="mt-0.5 font-semibold tabular-nums text-white">
            ${formatQuoteNumber(props.entry)}
          </p>
        </div>
        <div>
          <p className="text-sigflo-muted">Liq</p>
          <p className="mt-0.5 font-semibold tabular-nums text-amber-200/95">
            {props.liqPrice != null ? `$${formatQuoteNumber(props.liqPrice)}` : '—'}
          </p>
        </div>
        <div>
          <p className="text-sigflo-muted">ROI</p>
          <p className="mt-0.5 font-bold tabular-nums" style={{ color: ACCENT }}>
            {roiPct >= 0 ? '+' : ''}
            {Math.round(roiPct)}%
          </p>
        </div>
      </div>
    </div>
  );
}

function TradeStripManageHero(props: TradeChartScenarioStripManageProps) {
  const pnlClass = props.pnlUsd >= 0 ? 'text-[#00ffc8]' : 'text-rose-300';
  return (
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sigflo-muted">Open PnL</p>
      <p className={`mt-0.5 text-xl font-bold tabular-nums md:text-2xl ${pnlClass}`}>
        {fmtUsdSigned(props.pnlUsd)}{' '}
        <span className="text-base font-semibold md:text-lg">
          ({props.pnlPct >= 0 ? '+' : ''}
          {props.pnlPct.toFixed(1)}%)
        </span>
      </p>
      <div className="mt-2.5 grid grid-cols-3 gap-2 text-[10px]">
        <div>
          <p className="text-sigflo-muted">Pair</p>
          <p className="mt-0.5 font-semibold text-white">{props.pair}</p>
        </div>
        <div>
          <p className="text-sigflo-muted">Entry</p>
          <p className="mt-0.5 font-semibold tabular-nums text-white">${formatQuoteNumber(props.entry)}</p>
        </div>
        <div>
          <p className="text-sigflo-muted">Mark</p>
          <p className="mt-0.5 font-semibold tabular-nums text-white">${formatQuoteNumber(props.mark)}</p>
        </div>
      </div>
    </div>
  );
}

function TradeScenarioPanelTrade(props: TradeChartScenarioStripTradeProps) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-white">
      <div>
        <p className="text-[9px] uppercase tracking-wider text-sigflo-muted">Notional</p>
        <p className="font-semibold tabular-nums">${Math.round(props.positionSizeUsd).toLocaleString('en-US')}</p>
      </div>
      <div>
        <p className="text-[9px] uppercase tracking-wider text-sigflo-muted">Leverage</p>
        <p className="font-semibold tabular-nums">{props.isFutures ? `${props.leverage}x` : '1× spot'}</p>
      </div>
      <div>
        <p className="text-[9px] uppercase tracking-wider text-sigflo-muted">Margin</p>
        <p className="font-semibold tabular-nums">${Math.round(props.marginUsd).toLocaleString('en-US')}</p>
      </div>
      <div>
        <p className="text-[9px] uppercase tracking-wider text-sigflo-muted">Est. fee (rt)</p>
        <p className="font-semibold tabular-nums">${props.estFeeUsd.toFixed(2)}</p>
      </div>
      <div>
        <p className="text-[9px] uppercase tracking-wider text-sigflo-muted">Entry</p>
        <p className="font-semibold tabular-nums">
          <span className="text-sigflo-muted/80">$</span>
          {formatQuoteNumber(props.entry)}
        </p>
      </div>
      <div>
        <p className="text-[9px] uppercase tracking-wider text-sigflo-muted">Stop</p>
        <p className="font-semibold tabular-nums text-rose-200/95">
          <span className="text-sigflo-muted/80">$</span>
          {formatQuoteNumber(props.stop)}
        </p>
      </div>
      <div className="col-span-2">
        <p className="text-[9px] uppercase tracking-wider text-sigflo-muted">Target</p>
        <p className="font-semibold tabular-nums text-emerald-200/95">
          <span className="text-sigflo-muted/80">$</span>
          {formatQuoteNumber(props.target)}
        </p>
      </div>
      {props.liqPrice != null ? (
        <div className="col-span-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-2 py-1.5">
          <p className="text-[9px] uppercase tracking-wider text-amber-200/80">Est. liquidation</p>
          <p className="font-bold tabular-nums text-amber-100">
            <span className="text-amber-200/70">$</span>
            {formatQuoteNumber(props.liqPrice)}
          </p>
        </div>
      ) : null}
      <div className="col-span-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
        <span>
          <span className="text-sigflo-muted">PnL @ target </span>
          <span className="font-semibold text-emerald-300">{fmtUsdSigned(props.targetProfitUsd)}</span>
        </span>
        <span>
          <span className="text-sigflo-muted">PnL @ stop </span>
          <span className="font-semibold text-rose-300">{fmtUsdSigned(props.stopLossUsd)}</span>
        </span>
        <span style={{ color: ACCENT }} className="font-semibold">
          RR 1:{props.riskReward >= 10 ? props.riskReward.toFixed(0) : props.riskReward.toFixed(1)}
        </span>
        <span>
          Score: <span className="text-white">{props.tradeScore}</span> / setup {props.setupScore}
        </span>
      </div>
    </div>
  );
}

function TradeScenarioPanelManage(props: TradeChartScenarioStripManageProps) {
  return (
    <div className="grid grid-cols-2 gap-2 text-white">
      <div>
        <p className="text-[9px] uppercase tracking-wider text-sigflo-muted">Pair</p>
        <p className="font-semibold">{props.pair}</p>
      </div>
      <div>
        <p className="text-[9px] uppercase tracking-wider text-sigflo-muted">Side</p>
        <p className={`font-bold uppercase ${props.side === 'long' ? 'text-emerald-300' : 'text-rose-300'}`}>{props.side}</p>
      </div>
      <div>
        <p className="text-[9px] uppercase tracking-wider text-sigflo-muted">Entry</p>
        <p className="font-semibold tabular-nums">
          <span className="text-sigflo-muted/80">$</span>
          {formatQuoteNumber(props.entry)}
        </p>
      </div>
      <div>
        <p className="text-[9px] uppercase tracking-wider text-sigflo-muted">Mark</p>
        <p className="font-semibold tabular-nums">
          <span className="text-sigflo-muted/80">$</span>
          {formatQuoteNumber(props.mark)}
        </p>
      </div>
      <div className="col-span-2">
        <p className="text-[9px] uppercase tracking-wider text-sigflo-muted">Size</p>
        <p className="font-semibold">{props.sizeLabel}</p>
      </div>
    </div>
  );
}
