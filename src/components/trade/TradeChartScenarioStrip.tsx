import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_AUTOMATION_SAFEGUARDS,
  EXIT_AI_MODE_LABEL,
  EXIT_STRATEGY_LABEL,
} from '@/lib/aiExitAutomation';
import { formatQuoteNumber } from '@/lib/formatQuote';
import type { ExitGuidance, ExitState } from '@/lib/exitGuidance';
import { resolveExitGuidanceFlow } from '@/lib/tradeExitGuidanceFlow';
import type { AutomationSafeguards, ExitAiMode, ExitStrategyPreset } from '@/types/aiExitAutomation';
import type { TradeSide } from '@/types/trade';

const ACCENT = '#00ffc8';
const CONF_HIGH = '#00ffc8';
const CONF_MED = '#fbbf24';
const CONF_LOW = '#f87171';

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

type StripConfidenceTier = 'high' | 'medium' | 'low';

function exitStateColor(s: ExitState) {
  if (s === 'hold') return ACCENT;
  if (s === 'trim') return CONF_MED;
  return CONF_LOW;
}

/** Blend setup quality, live trade score, trend, and momentum — updates as inputs change. */
function computeStripConfidence(args: {
  setupScore: number;
  tradeScore: number;
  trendAlignment: number;
  momentumQuality: number;
}): { tier: StripConfidenceTier; dots: number } {
  const setup01 = clamp(args.setupScore / 100, 0, 1);
  const trade01 = clamp(args.tradeScore / 100, 0, 1);
  const trend01 = clamp(args.trendAlignment / 25, 0, 1);
  const mom01 = clamp(args.momentumQuality / 20, 0, 1);
  const score =
    (0.3 * setup01 + 0.34 * trade01 + 0.22 * trend01 + 0.14 * mom01) * 100;
  const dots = clamp(Math.round((score / 100) * 5), 1, 5);
  const tier: StripConfidenceTier =
    score >= 58 ? 'high' : score >= 38 ? 'medium' : 'low';
  return { tier, dots };
}

function StripConfidenceIndicator(props: { tier: StripConfidenceTier; dots: number }) {
  const { tier, dots } = props;
  const color = tier === 'high' ? CONF_HIGH : tier === 'medium' ? CONF_MED : CONF_LOW;
  const label = tier === 'high' ? 'High' : tier === 'medium' ? 'Medium' : 'Low';
  const chipGlow = tier === 'high' ? 'shadow-[0_0_12px_-3px_rgba(0,255,200,0.45)]' : '';

  return (
    <div
      className={`flex flex-col items-end gap-px ${chipGlow} transition-opacity duration-300`}
      aria-label={`Confidence ${label}, ${dots} of 5`}
    >
      <span
        className="text-[6px] font-bold uppercase leading-none tracking-[0.14em]"
        style={{ color }}
      >
        {label}
      </span>
      <div className="flex items-center gap-px" role="presentation">
        {Array.from({ length: 5 }, (_, i) => {
          const on = i < dots;
          return (
            <span
              key={i}
              className="h-[3px] w-[3px] shrink-0 rounded-full transition-colors duration-200"
              style={{
                backgroundColor: on ? color : 'rgba(255,255,255,0.12)',
                opacity: on ? 1 : 0.35,
                boxShadow: on && tier === 'high' ? `0 0 4px ${color}66` : undefined,
              }}
            />
          );
        })}
      </div>
    </div>
  );
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
  side: TradeSide;
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
  /** 0–25 from signal breakdown; drives confidence with trade inputs. */
  trendAlignment: number;
  /** 0–20 from signal breakdown. */
  momentumQuality: number;
  exitAiMode?: ExitAiMode;
  exitStrategyPreset?: ExitStrategyPreset;
  automationSafeguards?: AutomationSafeguards;
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
  stop: number;
  target: number;
  trendAlignment: number;
  momentumQuality: number;
  exitAiMode?: ExitAiMode;
  exitStrategyPreset?: ExitStrategyPreset;
  automationSafeguards?: AutomationSafeguards;
};

export type TradeChartScenarioStripProps = TradeChartScenarioStripTradeProps | TradeChartScenarioStripManageProps;

export function TradeChartScenarioStrip(props: TradeChartScenarioStripProps) {
  const [open, setOpen] = useState(false);

  const isTrade = props.mode === 'trade';

  const confidence = useMemo(() => {
    if (props.mode !== 'trade') return null;
    return computeStripConfidence({
      setupScore: props.setupScore,
      tradeScore: props.tradeScore,
      trendAlignment: props.trendAlignment,
      momentumQuality: props.momentumQuality,
    });
  }, [
    props.mode,
    props.mode === 'trade' ? props.setupScore : 0,
    props.mode === 'trade' ? props.tradeScore : 0,
    props.mode === 'trade' ? props.trendAlignment : 0,
    props.mode === 'trade' ? props.momentumQuality : 0,
  ]);

  const exitAiMode = props.exitAiMode ?? 'manual';
  const strategyPreset = props.exitStrategyPreset ?? 'custom';
  const safeguards = props.automationSafeguards ?? DEFAULT_AUTOMATION_SAFEGUARDS;

  const { effective: exitGuidance, nextPlanned: nextPlannedAutomation } = useMemo(() => {
    if (props.mode === 'trade') {
      return resolveExitGuidanceFlow({
        variant: 'trade',
        side: props.side,
        entry: props.entry,
        estimatedPnlPct: props.estimatedPnlPct,
        stop: props.stop,
        target: props.target,
        trendAlignment: props.trendAlignment,
        momentumQuality: props.momentumQuality,
        strategyPreset,
        safeguards,
        exitAiMode,
      });
    }
    return resolveExitGuidanceFlow({
      variant: 'manage',
      side: props.side,
      entry: props.entry,
      mark: props.mark,
      stop: props.stop,
      target: props.target,
      trendAlignment: props.trendAlignment,
      momentumQuality: props.momentumQuality,
      pnlPct: props.pnlPct,
      strategyPreset,
      safeguards,
      exitAiMode,
    });
  }, [
    props.mode,
    props.mode === 'trade'
      ? `${props.side}|${props.entry}|${props.estimatedPnlPct}|${props.stop}|${props.target}|${props.trendAlignment}|${props.momentumQuality}|${strategyPreset}|${exitAiMode}|${JSON.stringify(safeguards)}`
      : `${props.side}|${props.entry}|${props.mark}|${props.stop}|${props.target}|${props.trendAlignment}|${props.momentumQuality}|${props.pnlPct}|${strategyPreset}|${exitAiMode}|${JSON.stringify(safeguards)}`,
  ]);

  const prevExitRef = useRef<ExitState | undefined>(undefined);
  const [exitFlash, setExitFlash] = useState(false);
  useEffect(() => {
    if (!exitGuidance) return;
    const s = exitGuidance.state;
    if (prevExitRef.current !== undefined && prevExitRef.current !== s) {
      setExitFlash(true);
      const id = window.setTimeout(() => setExitFlash(false), 700);
      prevExitRef.current = s;
      return () => window.clearTimeout(id);
    }
    prevExitRef.current = s;
  }, [exitGuidance]);

  const confidenceLowDim = isTrade && confidence?.tier === 'low' ? 'opacity-[0.97]' : '';

  return (
    <div className="mx-auto mt-1.5 w-full max-w-lg px-1.5 pb-0 md:mt-2">
      <div
        className={`overflow-visible rounded-xl border border-white/[0.1] bg-gradient-to-b from-white/[0.05] to-black/55 transition-all duration-500 ease-out ring-1 ring-white/[0.06] ${confidenceLowDim}`}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`flex w-full items-start gap-1.5 px-2 py-1.5 text-left transition active:scale-[0.995] md:gap-2 md:px-2 md:py-1.5 ${
            open ? 'rounded-t-xl' : 'rounded-xl'
          }`}
          aria-expanded={open}
        >
          <div className="min-w-0 flex-1 space-y-0.5">
            {isTrade ? (
              <TradeStripTradeHero {...props} exitGuidance={exitGuidance} exitFlash={exitFlash} />
            ) : (
              <TradeStripManageHero {...props} exitGuidance={exitGuidance} exitFlash={exitFlash} />
            )}
            <ExitAutomationMicroSummary
              exitAiMode={exitAiMode}
              strategyPreset={strategyPreset}
              guidance={exitGuidance}
              nextPlanned={nextPlannedAutomation}
            />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 sm:gap-1.5">
            <span
              className="text-[9px] font-extrabold uppercase leading-none tracking-[0.18em] text-blue-400 sm:text-[10px]"
              style={{ textShadow: '0 0 14px rgba(96,165,250,0.55), 0 0 28px rgba(96,165,250,0.28)' }}
            >
              Scenario
            </span>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="text-right text-[8px] font-semibold leading-none tabular-nums sm:text-[9px]">
                {isTrade ? (
                  <span>
                    <span className="text-emerald-300">{props.probUp}%↑</span>
                    <span className="mx-0.5 text-white/30">/</span>
                    <span className="text-rose-300">{props.probDown}%↓</span>
                  </span>
                ) : (
                  <span className="uppercase tracking-wider text-sigflo-muted">Live</span>
                )}
              </div>
              {isTrade && confidence ? (
                <StripConfidenceIndicator tier={confidence.tier} dots={confidence.dots} />
              ) : null}
              <span className={open ? 'sigflo-scenario-chevron-pulse-open' : 'sigflo-scenario-chevron-pulse'}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  className={`shrink-0 text-blue-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
                  aria-hidden
                >
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </div>
        </button>

        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            open ? 'grid-rows-[1fr] overflow-hidden rounded-b-xl' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="border-t border-white/[0.08] bg-black/40 px-2 py-1.5 text-[9px] leading-snug text-sigflo-muted sm:text-[10px]">
              {isTrade ? (
                <TradeScenarioPanelTrade {...props} exitGuidance={exitGuidance} />
              ) : (
                <TradeScenarioPanelManage {...props} exitGuidance={exitGuidance} />
              )}
              <p className="mt-1 border-t border-white/[0.06] pt-1 text-[7px] leading-snug text-sigflo-muted/80 sm:text-[8px]">
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

function TradeStripTradeHero(
  props: TradeChartScenarioStripTradeProps & {
    exitGuidance: ExitGuidance | null;
    exitFlash: boolean;
  },
) {
  const roiPct = props.isFutures
    ? props.estimatedPnlPct * props.leverage
    : props.estimatedPnlPct;
  const pnlClass = props.estimatedPnlUsd >= 0 ? 'text-[#00ffc8]' : 'text-rose-300';
  const eg = props.exitGuidance;
  const exitColor = eg ? exitStateColor(eg.state) : ACCENT;

  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0 leading-none">
        <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-sigflo-muted">Est. PnL</span>
        <span className={`text-base font-bold tabular-nums tracking-tight sm:text-lg ${pnlClass}`}>
          {fmtUsdSigned(props.estimatedPnlUsd)}
        </span>
        <span className={`text-xs font-semibold tabular-nums sm:text-sm ${pnlClass}`}>
          ({props.estimatedPnlPct >= 0 ? '+' : ''}
          {props.estimatedPnlPct.toFixed(1)}%)
        </span>
      </div>
      {eg ? (
        <p
          className={`mt-0.5 text-[7px] font-semibold uppercase tracking-[0.14em] transition-all duration-300 ${
            props.exitFlash ? 'rounded-sm px-0.5 py-px' : ''
          }`}
          style={{
            color: exitColor,
            boxShadow: props.exitFlash ? `0 0 14px ${exitColor}55` : undefined,
          }}
        >
          Exit: {eg.headline}
        </p>
      ) : null}
      <div className="mt-1 grid w-full min-w-0 grid-cols-3 gap-x-2 gap-y-0 text-[8px] leading-tight sm:text-[9px]">
        <div className="min-w-0">
          <p className="text-sigflo-muted">Entry</p>
          <p className="truncate font-semibold tabular-nums text-white">${formatQuoteNumber(props.entry)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-sigflo-muted">Liq</p>
          <p className="truncate font-semibold tabular-nums text-amber-200/95">
            {props.liqPrice != null ? `$${formatQuoteNumber(props.liqPrice)}` : '—'}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-sigflo-muted">ROI</p>
          <p className="truncate font-bold tabular-nums" style={{ color: ACCENT }}>
            {roiPct >= 0 ? '+' : ''}
            {Math.round(roiPct)}%
          </p>
        </div>
      </div>
    </div>
  );
}

function TradeStripManageHero(
  props: TradeChartScenarioStripManageProps & {
    exitGuidance: ExitGuidance | null;
    exitFlash: boolean;
  },
) {
  const pnlClass = props.pnlUsd >= 0 ? 'text-[#00ffc8]' : 'text-rose-300';
  const eg = props.exitGuidance;
  const exitColor = eg ? exitStateColor(eg.state) : ACCENT;

  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0 leading-none">
        <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-sigflo-muted">Open PnL</span>
        <span className={`text-base font-bold tabular-nums sm:text-lg ${pnlClass}`}>{fmtUsdSigned(props.pnlUsd)}</span>
        <span className={`text-xs font-semibold tabular-nums sm:text-sm ${pnlClass}`}>
          ({props.pnlPct >= 0 ? '+' : ''}
          {props.pnlPct.toFixed(1)}%)
        </span>
      </div>
      {eg ? (
        <p
          className={`mt-0.5 text-[7px] font-semibold uppercase tracking-[0.14em] transition-all duration-300 ${
            props.exitFlash ? 'rounded-sm px-0.5 py-px' : ''
          }`}
          style={{
            color: exitColor,
            boxShadow: props.exitFlash ? `0 0 14px ${exitColor}55` : undefined,
          }}
        >
          Exit: {eg.headline}
        </p>
      ) : null}
      <div className="mt-1 grid w-full min-w-0 grid-cols-3 gap-x-2 gap-y-0 text-[8px] leading-tight sm:text-[9px]">
        <div className="min-w-0">
          <p className="text-sigflo-muted">Pair</p>
          <p className="truncate font-semibold text-white">{props.pair}</p>
        </div>
        <div className="min-w-0">
          <p className="text-sigflo-muted">Entry</p>
          <p className="truncate font-semibold tabular-nums text-white">${formatQuoteNumber(props.entry)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-sigflo-muted">Mark</p>
          <p className="truncate font-semibold tabular-nums text-white">${formatQuoteNumber(props.mark)}</p>
        </div>
      </div>
    </div>
  );
}

function exitConfidenceColor(label: ExitGuidance['confidenceLabel']) {
  if (label === 'High') return CONF_HIGH;
  if (label === 'Medium') return CONF_MED;
  return CONF_LOW;
}

function ExitAutomationMicroSummary(props: {
  exitAiMode: ExitAiMode;
  strategyPreset: ExitStrategyPreset;
  guidance: ExitGuidance;
  nextPlanned: string;
}) {
  const strat =
    props.exitAiMode === 'manual' ? '—' : EXIT_STRATEGY_LABEL[props.strategyPreset];
  const confColor = exitConfidenceColor(props.guidance.confidenceLabel);
  const stateColor = exitStateColor(props.guidance.state);

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-1.5 py-1 text-[6px] leading-relaxed sm:text-[7px]">
      <p className="font-semibold uppercase tracking-[0.1em] text-sigflo-muted">
        Exit AI: <span className="text-sigflo-text">{EXIT_AI_MODE_LABEL[props.exitAiMode]}</span>
        <span className="mx-1 text-white/20">·</span>
        Strategy: <span className="text-sigflo-text/90">{strat}</span>
      </p>
      <p className="mt-0.5 text-sigflo-muted">
        State:{' '}
        <span className="font-bold" style={{ color: stateColor }}>
          {props.guidance.headline}
        </span>
        <span className="mx-1 text-white/20">·</span>
        <span className="text-sigflo-text/85">Next: {props.nextPlanned}</span>
      </p>
      <p className="mt-0.5 text-sigflo-muted">
        Confidence:{' '}
        <span className="font-semibold" style={{ color: confColor }}>
          {props.guidance.confidenceLabel}
        </span>
      </p>
    </div>
  );
}

function ExitGuidanceExpandedBlock({ eg }: { eg: ExitGuidance | null }) {
  if (!eg) return null;
  const stroke = exitStateColor(eg.state);
  const confColor = exitConfidenceColor(eg.confidenceLabel);

  return (
    <div
      className="col-span-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 transition-colors duration-300"
      style={{ boxShadow: `inset 0 0 0 1px ${stroke}22` }}
    >
      <p className="mb-1 text-[8px] font-bold uppercase tracking-[0.12em]" style={{ color: stroke }}>
        Exit guidance
      </p>
      <dl className="space-y-1 text-[10px] leading-snug text-white">
        <div>
          <dt className="text-[8px] uppercase tracking-wider text-sigflo-muted">Suggested action</dt>
          <dd className="font-semibold text-white/95">{eg.action}</dd>
        </div>
        <div>
          <dt className="text-[8px] uppercase tracking-wider text-sigflo-muted">Reason</dt>
          <dd className="text-white/85">{eg.reason}</dd>
        </div>
        <div>
          <dt className="text-[8px] uppercase tracking-wider text-sigflo-muted">Confidence</dt>
          <dd className="font-semibold" style={{ color: confColor }}>
            {eg.confidenceLabel}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function TradeScenarioPanelTrade(
  props: TradeChartScenarioStripTradeProps & { exitGuidance: ExitGuidance | null },
) {
  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-white">
      <ExitGuidanceExpandedBlock eg={props.exitGuidance} />
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
        <div className="col-span-2 rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-1.5 py-1">
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

function TradeScenarioPanelManage(
  props: TradeChartScenarioStripManageProps & { exitGuidance: ExitGuidance | null },
) {
  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-white">
      <ExitGuidanceExpandedBlock eg={props.exitGuidance} />
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
