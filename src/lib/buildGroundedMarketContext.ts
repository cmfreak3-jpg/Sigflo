import type { GroundedMarketContext } from '@/types/aiGrounded';
import { deriveMarketRegimeFromContext, regimeToneGuideFor } from '@/lib/marketRegime';
import type { MarketRowStatus } from '@/types/markets';
import type { CryptoSignal } from '@/types/signal';
import type { MarketMode } from '@/types/trade';
import type { TradeChartCandle, TradeViewModel } from '@/types/trade';

function finite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function pushLevel(set: Set<number>, n: number, tol = 1e-8) {
  for (const x of set) {
    if (Math.abs(x - n) <= tol) return;
  }
  set.add(n);
}

function buildFactsRecord(signal: CryptoSignal): Record<string, number | string> | undefined {
  const f = signal.facts;
  if (!f) return undefined;
  const out: Record<string, number | string> = {};
  if (f.emaTrend != null) out.emaTrend = f.emaTrend;
  if (f.volumeRatio != null && Number.isFinite(f.volumeRatio)) out.volumeRatio = f.volumeRatio;
  if (f.rsi != null && Number.isFinite(f.rsi)) out.rsi = f.rsi;
  if (f.distanceToBreakoutAtr != null && Number.isFinite(f.distanceToBreakoutAtr)) {
    out.distanceToBreakoutAtr = f.distanceToBreakoutAtr;
  }
  if (f.pullbackDepthAtr != null && Number.isFinite(f.pullbackDepthAtr)) out.pullbackDepthAtr = f.pullbackDepthAtr;
  if (f.extensionAtr != null && Number.isFinite(f.extensionAtr)) out.extensionAtr = f.extensionAtr;
  return Object.keys(out).length > 0 ? out : undefined;
}

function allowedIndicatorsFromFacts(signal: CryptoSignal): string[] {
  const terms: string[] = [];
  const f = signal.facts;
  if (f?.rsi != null && Number.isFinite(f.rsi)) terms.push('RSI');
  if (f?.emaTrend) terms.push('EMA trend');
  if (f?.volumeRatio != null && Number.isFinite(f.volumeRatio)) terms.push('relative volume');
  if (
    f?.distanceToBreakoutAtr != null ||
    f?.pullbackDepthAtr != null ||
    f?.extensionAtr != null
  ) {
    terms.push('ATR-based structure distances');
  }
  return terms;
}

function formatTimeframe(interval: string): string {
  if (interval === 'D') return '1D';
  if (interval === 'W') return '1W';
  if (interval === '60') return '1H';
  if (interval === '240') return '4H';
  return `${interval}m`;
}

export function buildGroundedMarketContext(input: {
  signal: CryptoSignal;
  status: MarketRowStatus;
  tradeScore: number;
  market: MarketMode;
  chartInterval: string;
  model: TradeViewModel;
  /** Last N candles only; omit if empty */
  recentCandles?: TradeChartCandle[];
}): GroundedMarketContext {
  const { signal, status, tradeScore, market, chartInterval, model, recentCandles } = input;
  const gaps: string[] = [];
  const levelSet = new Set<number>();

  if (finite(model.lastPrice)) pushLevel(levelSet, model.lastPrice);
  if (finite(model.entry)) pushLevel(levelSet, model.entry);
  if (finite(model.stop)) pushLevel(levelSet, model.stop);
  if (finite(model.target)) pushLevel(levelSet, model.target);
  if (market === 'futures' && finite(model.liquidation)) pushLevel(levelSet, model.liquidation);
  if (signal.plannedEntry != null && finite(signal.plannedEntry)) pushLevel(levelSet, signal.plannedEntry);
  if (signal.plannedStop != null && finite(signal.plannedStop)) pushLevel(levelSet, signal.plannedStop);
  if (signal.plannedTarget != null && finite(signal.plannedTarget)) pushLevel(levelSet, signal.plannedTarget);

  const allowedPriceLevels = [...levelSet].sort((a, b) => a - b);

  if (!finite(model.lastPrice)) gaps.push('last_price');
  if (!finite(model.entry) && !finite(signal.plannedEntry)) gaps.push('entry_level');
  if (!finite(model.stop) && !finite(signal.plannedStop)) gaps.push('stop_level');
  if (!finite(model.target) && !finite(signal.plannedTarget)) gaps.push('target_level');
  if (!recentCandles?.length) gaps.push('recent_ohlc_series');

  const candles =
    recentCandles && recentCandles.length > 0
      ? recentCandles.slice(-12).map((c) => ({
          o: c.open,
          h: c.high,
          l: c.low,
          c: c.close,
        }))
      : undefined;

  const facts = buildFactsRecord(signal);
  if (!facts) gaps.push('computed_indicator_facts');

  const base: GroundedMarketContext = {
    symbol: signal.pair,
    market,
    timeframe: formatTimeframe(chartInterval),
    ...(finite(model.lastPrice) ? { lastPrice: model.lastPrice } : {}),
    ...(finite(model.entry) ? { entry: model.entry } : {}),
    ...(finite(model.stop) ? { stop: model.stop } : {}),
    ...(finite(model.target) ? { target: model.target } : {}),
    ...(market === 'futures' && finite(model.liquidation) ? { liquidation: model.liquidation } : {}),
    ...(finite(model.change24hPct) ? { change24hPct: model.change24hPct } : {}),
    ...(finite(model.high24h) ? { high24h: model.high24h } : {}),
    ...(finite(model.low24h) ? { low24h: model.low24h } : {}),
    allowedPriceLevels,
    scannerStatus: status,
    tradeReadinessScore: Math.round(tradeScore),
    signal: {
      id: signal.id,
      side: signal.side,
      setupType: signal.setupType,
      setupScore: signal.setupScore,
      setupScoreLabel: signal.setupScoreLabel,
      riskTag: signal.riskTag,
      setupTags: [...signal.setupTags],
      biasLabel: signal.biasLabel,
      scoreBreakdown: { ...signal.scoreBreakdown },
      ...(facts ? { facts } : {}),
      ...(signal.watchCue?.trim() ? { watchCue: signal.watchCue.trim() } : {}),
      ...(signal.watchNext?.trim() ? { watchNext: signal.watchNext.trim() } : {}),
      ...(signal.plannedEntry != null && finite(signal.plannedEntry) ? { plannedEntry: signal.plannedEntry } : {}),
      ...(signal.plannedStop != null && finite(signal.plannedStop) ? { plannedStop: signal.plannedStop } : {}),
      ...(signal.plannedTarget != null && finite(signal.plannedTarget) ? { plannedTarget: signal.plannedTarget } : {}),
    },
    signalNarrative: {
      aiExplanation: signal.aiExplanation.trim(),
      whyThisMatters: signal.whyThisMatters.trim(),
    },
    ...(candles ? { recentCandles: candles } : {}),
    dataGaps: gaps,
    allowedIndicatorTerms: allowedIndicatorsFromFacts(signal),
    marketRegime: 'transition',
    regimeToneGuide: regimeToneGuideFor('transition'),
  };

  const marketRegime = deriveMarketRegimeFromContext(base);
  return {
    ...base,
    marketRegime,
    regimeToneGuide: regimeToneGuideFor(marketRegime),
  };
}
