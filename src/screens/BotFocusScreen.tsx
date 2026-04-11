import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BotExecutionSheet } from '@/components/bots/BotExecutionSheet';
import { TradeChartPanel } from '@/components/trade/TradeChartPanel';
import { BOT_FOCUS_CHART_PLOT_PX } from '@/config/tradeChartHeights';
import type { TradeChartInterval } from '@/hooks/useLiveTradeMarket';
import { useLiveTradeMarket } from '@/hooks/useLiveTradeMarket';
import { useSyncedTradeChartInterval } from '@/hooks/useSyncedTradeChartInterval';
import { ExitAiCoPilotBlock } from '@/components/trade/exit/ExitAiCoPilotBlock';
import { useAccountSnapshot } from '@/hooks/useAccountSnapshot';
import { useExitAutomation } from '@/hooks/useExitAutomation';
import { useBotStatuses } from '@/hooks/useBotStatuses';
import { useSignalEngine } from '@/hooks/useSignalEngine';
import {
  baseBots,
  botCardStatusMeta,
  formatBotPrice,
  resolveBotCardStatus,
  type BotAgent,
} from '@/lib/bots';
import {
  buildTrackedFallbackSignal,
  deriveMarketStatus,
  isFeedActionableOpportunity,
} from '@/lib/marketScannerRows';
import {
  SIGFLO_CHART_INTERVAL_EVENT,
  TRADE_CHART_INTERVAL_STORAGE_KEY,
  tradeChartIntervalShortLabel,
} from '@/lib/tradeChartIntervalPreference';
import { uiSignalStateFromMarketStatus } from '@/lib/signalState';
import { formatBybitTradeErrorMessage } from '@/lib/bybitUserFacingError';
import { linearTpSlStringsForOpen } from '@/lib/bybitLinearTpSl';
import { linearQtyFromNotionalUsd } from '@/lib/linearOrderQty';
import { buildExitAiCoPilotModel, buildManageAiExitZoneAuxLines } from '@/lib/exitAiCoPilot';
import { resolveExitGuidanceFlow } from '@/lib/tradeExitGuidanceFlow';
import {
  buildManageTradeQueryFromLinearPosition,
  buildTradeQueryString,
} from '@/lib/tradeNavigation';
import { deriveTradeMetrics } from '@/lib/tradeRisk';
import { buildTradeViewModelFromSignal, resolveTradeAnchorPrice } from '@/lib/tradeViewFromSignal';
import {
  postBybitLinearOrder,
  postBybitLinearTradingStop,
} from '@/services/api/tradeClient';
import { fetchLinearMaxLeverage } from '@/services/bybit/client';
import type { ExchangeSnapshot, PositionItem } from '@/types/integrations';
import type { TradeViewModel } from '@/types/trade';
import type { TradeSide } from '@/types/trade';

const BETA_FALLBACK_MIN_ORDER_USD = 5;
const SYMBOL_MIN_NOTIONAL_USD: Record<string, number> = {
  BTCUSDT: 5,
  ETHUSDT: 5,
};

function resolveMinOrderUsd(symbol: string): number {
  const s = symbol.toUpperCase();
  return SYMBOL_MIN_NOTIONAL_USD[s] ?? BETA_FALLBACK_MIN_ORDER_USD;
}

function roundUsdAmount(n: number): number {
  return Math.round(n * 100) / 100;
}

function coerceUsdField(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

type TradeBalanceOverview = {
  availableToTrade: number | null;
  totalWalletBalance: number | null;
};

function utaSizingCapUsd(o: TradeBalanceOverview): number {
  const av = o.availableToTrade;
  const tw = o.totalWalletBalance;
  if (av != null && Number.isFinite(av) && av > 0) return av;
  if (tw != null && Number.isFinite(tw) && tw > 0) return tw;
  return 0;
}

function utaBalanceDisplayUsd(o: TradeBalanceOverview): number {
  const cap = utaSizingCapUsd(o);
  if (cap > 0) return cap;
  const av = o.availableToTrade;
  if (av != null && Number.isFinite(av)) return Math.max(0, av);
  const tw = o.totalWalletBalance;
  if (tw != null && Number.isFinite(tw)) return Math.max(0, tw);
  return 0;
}

function findBybitLinearOpenLeg(
  snapshots: ExchangeSnapshot[],
  orderSymbol: string,
  legSide: TradeSide,
): PositionItem | null {
  const bybit = snapshots.find((s) => s.exchange === 'bybit' && s.status === 'connected');
  if (!bybit?.positions?.length) return null;
  const open = bybit.positions.filter((x) => x.symbol === orderSymbol && x.size > 0);
  if (open.length === 0) return null;
  return open.find((x) => x.side === legSide) ?? open[0];
}

const FOCUS_INTERVAL_OPTIONS: { value: TradeChartInterval; label: string }[] = [
  { value: '1', label: '1m' },
  { value: '5', label: '5m' },
  { value: '15', label: '15m' },
  { value: '60', label: '1H' },
  { value: '240', label: '4H' },
  { value: 'D', label: '1D' },
  { value: 'W', label: '1W' },
];

function pairToLinearSymbol(raw: string): string {
  const t = raw.trim().toUpperCase();
  if (!t) return 'BTCUSDT';
  if (t.endsWith('USDT') && t.length > 4) return t;
  const base = t.replace(/[^A-Z0-9]/g, '').replace(/USDT$/i, '') || 'BTC';
  return `${base}USDT`;
}

function pairFromWatched(raw: string): string {
  const t = raw.trim().toUpperCase();
  if (t.includes('/')) return t.split('/')[0]?.trim() || 'BTC';
  return t.replace(/USDT$/i, '').replace(/[^A-Z0-9]/g, '') || 'BTC';
}

function levelsValid(e?: number, s?: number, t?: number): boolean {
  return (
    e != null &&
    s != null &&
    t != null &&
    Number.isFinite(e) &&
    Number.isFinite(s) &&
    Number.isFinite(t) &&
    e > 0 &&
    s > 0 &&
    t > 0
  );
}

function rrFromLevels(side: TradeSide, entry: number, stop: number, target: number): number {
  const risk = side === 'long' ? entry - stop : stop - entry;
  const reward = side === 'long' ? target - entry : entry - target;
  if (!Number.isFinite(risk) || risk <= 0) return 0;
  return reward / risk;
}

function biasToSide(bias: string): TradeSide {
  return bias.trim().toLowerCase() === 'short' ? 'short' : 'long';
}

function focusStateLabel(args: {
  paused: boolean;
  pending: boolean;
  hasSignal: boolean;
  actionable: boolean;
  marketStatus: ReturnType<typeof deriveMarketStatus>;
}): string {
  if (args.paused) return 'Watching';
  if (args.pending || !args.hasSignal) return 'Waiting';
  if (args.marketStatus === 'triggered') return 'Triggered';
  if (args.actionable) return 'Ready';
  if (args.marketStatus === 'developing' || args.marketStatus === 'overextended') return 'Waiting';
  return 'Watching';
}

function mergeModelWithBotLevels(
  base: TradeViewModel,
  bot: BotAgent,
  hasActiveSetup: boolean,
): TradeViewModel {
  if (!hasActiveSetup || !levelsValid(bot.detail.entry, bot.detail.stop, bot.detail.target)) {
    return base;
  }
  const side = biasToSide(bot.detail.bias);
  const entry = bot.detail.entry!;
  const stop = bot.detail.stop!;
  const target = bot.detail.target!;
  const stopMovePct = Math.abs((stop - entry) / entry);
  const targetMovePct = Math.abs((target - entry) / entry);
  const riskReward = rrFromLevels(side, entry, stop, target);
  const positionSizeUsd = base.positionSizeUsd;
  const targetProfitUsd = positionSizeUsd * targetMovePct;
  const stopLossUsd = -(positionSizeUsd * stopMovePct);

  return {
    ...base,
    side,
    entry,
    stop,
    target,
    riskReward: Number.isFinite(riskReward) && riskReward > 0 ? riskReward : base.riskReward,
    targetProfitUsd,
    stopLossUsd,
  };
}

function BotFocusHeader({
  bot,
  cardStatus,
  onBack,
}: {
  bot: BotAgent;
  cardStatus: ReturnType<typeof resolveBotCardStatus>;
  onBack: () => void;
}) {
  const meta = botCardStatusMeta(cardStatus);
  const glow =
    cardStatus === 'active' || cardStatus === 'in_trade'
      ? 'shadow-[0_0_20px_-6px_rgba(0,200,120,0.45)]'
      : '';

  return (
    <header className="flex items-center gap-3 border-b border-landing-border/80 bg-landing-bg/90 px-3 py-2.5 backdrop-blur-md">
      <button
        type="button"
        onClick={onBack}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-landing-border bg-landing-surface/80 text-landing-text transition active:scale-[0.96]"
        aria-label="Back"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M15 6l-6 6 6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <h1 className="truncate text-base font-bold tracking-tight text-landing-text">{bot.name}</h1>
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-landing-muted">
            {bot.strategy}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-landing-surface/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.textClass} ${glow}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
            {meta.label}
          </span>
        </div>
      </div>
    </header>
  );
}

function MarketContextTags({
  volatility,
  structure,
  volume,
}: {
  volatility: string;
  structure: string;
  volume: string;
}) {
  const items = [
    { k: 'Volatility', v: volatility },
    { k: 'Structure', v: structure },
    { k: 'Volume', v: volume },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ k, v }) => (
        <span
          key={k}
          className="inline-flex items-center rounded-full border border-white/[0.08] bg-black/30 px-2.5 py-1 text-[10px] font-medium text-landing-muted"
        >
          <span className="text-landing-text/75">{k}:</span>
          <span className="ml-1 text-landing-accent-hi">{v}</span>
        </span>
      ))}
    </div>
  );
}

export default function BotFocusScreen() {
  const { botId } = useParams<{ botId: string }>();
  const navigate = useNavigate();
  const { signals } = useSignalEngine();
  const { statusMap, togglePause } = useBotStatuses();
  const chartInterval = useSyncedTradeChartInterval();
  const [selectedPairRaw, setSelectedPairRaw] = useState<string | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [tapFlash, setTapFlash] = useState<string | null>(null);
  const [executionOpen, setExecutionOpen] = useState(false);
  const [execLive, setExecLive] = useState(false);
  const [execFillEntry, setExecFillEntry] = useState<number | null>(null);
  const [execNotionalUsd, setExecNotionalUsd] = useState(0);

  const { items: accountSnapshots, refresh: refreshAccountSnapshots } = useAccountSnapshot({ pollMs: 12_000 });
  const [symbolMaxLeverage, setSymbolMaxLeverage] = useState<number | null>(null);

  const bot = useMemo(() => baseBots.find((b) => b.id === botId) ?? null, [botId]);

  const selectedWatched = selectedPairRaw ?? bot?.watchedPairs[0] ?? 'BTC';
  const linearSymbol = pairToLinearSymbol(selectedWatched);

  const focusSignal = useMemo(() => {
    if (!bot) return null;
    const byId = signals.find((s) => s.id === bot.signalId);
    const pair = pairFromWatched(selectedWatched);
    const sym = pairToLinearSymbol(selectedWatched);
    const forPair = signals.find((s) => s.pair === pair);
    if (byId && pairFromWatched(selectedWatched) === byId.pair) return byId;
    if (forPair) return forPair;
    if (byId) return byId;
    return buildTrackedFallbackSignal(pair, sym);
  }, [bot, signals, selectedWatched]);

  const live = useLiveTradeMarket(linearSymbol, chartInterval);

  useEffect(() => {
    let cancelled = false;
    void fetchLinearMaxLeverage(linearSymbol).then((m) => {
      if (!cancelled) setSymbolMaxLeverage(m);
    });
    return () => {
      cancelled = true;
    };
  }, [linearSymbol]);

  const tradeBalance = useMemo(() => {
    const bybit = accountSnapshots.find((s) => s.exchange === 'bybit' && s.status === 'connected');
    const overview = bybit?.accountBreakdown?.overview;
    if (!overview) return null;
    return {
      availableToTrade: coerceUsdField(overview.availableToTrade),
      totalWalletBalance: coerceUsdField(overview.totalWalletBalance),
    };
  }, [accountSnapshots]);

  const linkedUtaRawMaxUsd = useMemo(() => {
    if (!tradeBalance) return null;
    const raw = Math.max(utaSizingCapUsd(tradeBalance), utaBalanceDisplayUsd(tradeBalance));
    if (!Number.isFinite(raw)) return null;
    return Math.max(0, raw);
  }, [tradeBalance]);

  const balanceForSizing = useMemo(() => {
    if (linkedUtaRawMaxUsd != null && linkedUtaRawMaxUsd > 0) {
      return roundUsdAmount(linkedUtaRawMaxUsd);
    }
    return 0;
  }, [linkedUtaRawMaxUsd]);

  const bybitSnap = useMemo(
    () => accountSnapshots.find((s) => s.exchange === 'bybit' && s.status === 'connected'),
    [accountSnapshots],
  );

  const storedStatus = bot ? statusMap[bot.id] ?? bot.status : 'active';
  const marketStatus = focusSignal ? deriveMarketStatus(focusSignal) : 'idle';
  const uiState = focusSignal ? uiSignalStateFromMarketStatus(marketStatus) : null;
  const cardStatus = resolveBotCardStatus(storedStatus, uiState);

  const hasActiveSetup = Boolean(
    bot && !bot.expandedSetupPending && levelsValid(bot.detail.entry, bot.detail.stop, bot.detail.target),
  );

  const baseModel = useMemo(() => {
    if (!focusSignal) return null;
    const anchorPx = resolveTradeAnchorPrice(null, live.lastPrice, focusSignal.pair);
    return buildTradeViewModelFromSignal(
      focusSignal,
      {
        lastPrice: live.lastPrice,
        change24hPct: live.change24hPct,
        high24h: live.high24h,
        low24h: live.low24h,
        volume24h: live.volume24h,
        priceSeries: live.priceSeries,
        chartCandles: live.chartCandles,
      },
      {
        anchorPrice: anchorPx,
        balanceUsd: 0,
        tradeSide: bot ? biasToSide(bot.detail.bias) : undefined,
      },
    );
  }, [focusSignal, live, bot]);

  const chartModel = useMemo(() => {
    if (!baseModel || !bot) return baseModel;
    return mergeModelWithBotLevels(baseModel, bot, hasActiveSetup);
  }, [baseModel, bot, hasActiveSetup]);

  const setupSideForExec: TradeSide = bot ? biasToSide(bot.detail.bias) : 'long';

  const chartModelForPlot = useMemo((): TradeViewModel | null => {
    if (!chartModel) return null;
    if (execFillEntry != null) {
      const last =
        live.lastPrice != null && live.lastPrice > 0 ? live.lastPrice : execFillEntry;
      return { ...chartModel, entry: execFillEntry, lastPrice: last };
    }
    return chartModel;
  }, [chartModel, execFillEntry, live.lastPrice]);

  const headerSecondaryPnl = useMemo((): {
    label: string;
    tone: 'positive' | 'negative' | 'neutral';
  } | null => {
    if (!execLive || execNotionalUsd <= 0 || !chartModelForPlot) return null;
    const markPx =
      live.lastPrice != null && live.lastPrice > 0 ? live.lastPrice : chartModelForPlot.entry;
    const entryPx = execFillEntry ?? chartModelForPlot.entry;
    if (!(markPx > 0) || !(entryPx > 0)) return null;
    const frac =
      setupSideForExec === 'long'
        ? (markPx - entryPx) / entryPx
        : (entryPx - markPx) / entryPx;
    const u = execNotionalUsd * frac;
    const tone: 'positive' | 'negative' | 'neutral' =
      u > 0 ? 'positive' : u < 0 ? 'negative' : 'neutral';
    const label = `${u >= 0 ? '+' : '−'}${Math.abs(u).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })} uPnL`;
    return { label, tone };
  }, [execLive, execNotionalUsd, chartModelForPlot, live.lastPrice, execFillEntry, setupSideForExec]);

  const exitAutomationScopeKey = bot ? `botFocus:${bot.id}:${linearSymbol}` : 'botFocus:none';
  const exitAuto = useExitAutomation(exitAutomationScopeKey);

  const botExitFlow = useMemo(() => {
    if (!execLive || !chartModelForPlot || !focusSignal) return null;
    const entry = execFillEntry ?? chartModelForPlot.entry;
    const mark =
      live.lastPrice != null && live.lastPrice > 0 ? live.lastPrice : chartModelForPlot.lastPrice ?? entry;
    if (!(entry > 0) || !(mark > 0)) return null;
    const pnlPct =
      setupSideForExec === 'long' ? ((mark - entry) / entry) * 100 : ((entry - mark) / entry) * 100;
    return resolveExitGuidanceFlow({
      variant: 'manage',
      side: setupSideForExec,
      entry,
      mark,
      stop: chartModelForPlot.stop,
      target: chartModelForPlot.target,
      trendAlignment: focusSignal.scoreBreakdown.trendAlignment,
      momentumQuality: focusSignal.scoreBreakdown.momentumQuality,
      pnlPct,
      strategyPreset: exitAuto.strategy,
      customStrategyThresholds: exitAuto.customStrategyThresholds,
      safeguards: exitAuto.safeguards,
      exitAiMode: exitAuto.mode,
    });
  }, [
    chartModelForPlot,
    execFillEntry,
    execLive,
    exitAuto.customStrategyThresholds,
    exitAuto.mode,
    exitAuto.safeguards,
    exitAuto.strategy,
    focusSignal,
    live.lastPrice,
    setupSideForExec,
  ]);

  const botExitChartAux = useMemo(() => {
    if (!execLive || !chartModelForPlot) return undefined;
    const entry = execFillEntry ?? chartModelForPlot.entry;
    const mark =
      live.lastPrice != null && live.lastPrice > 0 ? live.lastPrice : chartModelForPlot.lastPrice ?? entry;
    return buildManageAiExitZoneAuxLines({
      mode: exitAuto.mode,
      side: setupSideForExec,
      entry,
      target: chartModelForPlot.target,
      stop: chartModelForPlot.stop,
      mark,
      referencePrice: botExitFlow?.effective.referencePrice,
    });
  }, [
    botExitFlow?.effective.referencePrice,
    chartModelForPlot,
    execFillEntry,
    execLive,
    exitAuto.mode,
    live.lastPrice,
    setupSideForExec,
  ]);

  const botExitAiModel = useMemo(
    () =>
      buildExitAiCoPilotModel({
        mode: exitAuto.mode,
        flow: botExitFlow,
        nextPlanned: botExitFlow?.nextPlanned ?? 'Automation watching trend and risk.',
        safeguards: exitAuto.safeguards,
        assistedPromptVisible: false,
        orderExitInFlight: false,
        stop: chartModelForPlot?.stop ?? 0,
        target: chartModelForPlot?.target ?? 0,
        contextLine: bot?.intentLine ?? null,
      }),
    [
      bot?.intentLine,
      botExitFlow,
      chartModelForPlot?.stop,
      chartModelForPlot?.target,
      exitAuto.mode,
      exitAuto.safeguards,
    ],
  );

  const navigateToTradeForExit = useCallback(() => {
    const connected = accountSnapshots.find((s) => s.exchange === 'bybit' && s.status === 'connected');
    const pos = connected ? findBybitLinearOpenLeg([connected], linearSymbol, setupSideForExec) : null;
    const mark =
      live.lastPrice != null && live.lastPrice > 0 ? live.lastPrice : chartModelForPlot?.lastPrice ?? 0;
    if (pos && mark > 0) {
      navigate(
        `/trade?${buildManageTradeQueryFromLinearPosition(pos, {
          markPrice: mark,
          leverageFallback: pos.leverage ?? 1,
        })}`,
      );
      return;
    }
    if (focusSignal) {
      navigate(`/trade?${buildTradeQueryString(focusSignal, { marketStatus })}`);
    }
  }, [
    accountSnapshots,
    chartModelForPlot?.lastPrice,
    focusSignal,
    linearSymbol,
    live.lastPrice,
    marketStatus,
    navigate,
    setupSideForExec,
  ]);

  const executeTradeFromFocus = useCallback(
    async ({
      amountUsd,
      leverage,
    }: {
      amountUsd: number;
      leverage: number;
    }): Promise<{ ok: true } | { ok: false; message: string }> => {
      if (!chartModel || !focusSignal) {
        return { ok: false, message: 'Chart or signal not ready.' };
      }
      const useReal = Boolean(bybitSnap);
      let entryMark = NaN;
      if (Number.isFinite(chartModel.lastPrice) && chartModel.lastPrice > 0) {
        entryMark = chartModel.lastPrice;
      } else if (live.lastPrice != null && live.lastPrice > 0) {
        entryMark = live.lastPrice;
      } else if (Number.isFinite(chartModel.entry) && chartModel.entry > 0) {
        entryMark = chartModel.entry;
      }
      if (!Number.isFinite(entryMark) || entryMark <= 0) {
        return { ok: false, message: 'No price yet — wait for the chart to load.' };
      }
      if (!useReal) {
        return { ok: false, message: 'Connect Bybit in Account to execute.' };
      }

      const amt = roundUsdAmount(amountUsd);
      const lev = Math.min(leverage, symbolMaxLeverage ?? 200);
      const riskModel: TradeViewModel = { ...chartModel, balanceUsd: Math.max(0, balanceForSizing) };
      const metrics = deriveTradeMetrics(riskModel, {
        amountUsd: amt,
        leverage: lev,
        side: setupSideForExec,
        market: 'futures',
        setupScore: focusSignal.setupScore,
      });
      const minOrder = resolveMinOrderUsd(linearSymbol);
      if (amt < minOrder) {
        return { ok: false, message: `Minimum margin is about $${minOrder}.` };
      }

      const qtyStr = linearQtyFromNotionalUsd(metrics.positionSizeUsd, entryMark);
      const sideBybit = setupSideForExec === 'long' ? 'Buy' : 'Sell';
      const { tpSl } = linearTpSlStringsForOpen(setupSideForExec, entryMark, chartModel.target, chartModel.stop);

      try {
        await postBybitLinearOrder({
          symbol: linearSymbol,
          side: sideBybit,
          qty: qtyStr,
          orderType: 'Market',
          leverage: lev,
          positionIdx: 0,
          ...(tpSl.takeProfit ? { takeProfit: tpSl.takeProfit } : {}),
          ...(tpSl.stopLoss ? { stopLoss: tpSl.stopLoss } : {}),
        });
        const snapshotsAfter = await refreshAccountSnapshots({ silent: false });
        if (tpSl.takeProfit || tpSl.stopLoss) {
          const pos = findBybitLinearOpenLeg(snapshotsAfter, linearSymbol, setupSideForExec);
          if (pos && Number.isFinite(pos.entryPrice) && pos.entryPrice > 0) {
            const synced = linearTpSlStringsForOpen(setupSideForExec, pos.entryPrice, chartModel.target, chartModel.stop);
            if (synced.tpSl.takeProfit || synced.tpSl.stopLoss) {
              try {
                await postBybitLinearTradingStop({
                  symbol: linearSymbol,
                  positionIdx: pos.positionIdx ?? 0,
                  takeProfit: synced.tpSl.takeProfit ?? '0',
                  stopLoss: synced.tpSl.stopLoss ?? '0',
                });
              } catch {
                /* order live; TP/SL sync best-effort */
              }
            }
          }
        }
        await refreshAccountSnapshots({ silent: true });
        setExecFillEntry(entryMark);
        setExecNotionalUsd(metrics.positionSizeUsd);
        setExecLive(true);
        return { ok: true };
      } catch (e) {
        return { ok: false, message: formatBybitTradeErrorMessage(e, 'Order failed — retry') };
      }
    },
    [
      balanceForSizing,
      bybitSnap,
      chartModel,
      focusSignal,
      linearSymbol,
      live.lastPrice,
      refreshAccountSnapshots,
      setupSideForExec,
      symbolMaxLeverage,
    ],
  );

  const actionable = Boolean(focusSignal && isFeedActionableOpportunity(focusSignal));
  const canExecute =
    Boolean(bot && focusSignal && hasActiveSetup && storedStatus !== 'paused' && (actionable || bot.detail.confidencePct >= 62));

  const confidencePct = bot
    ? Math.round((bot.detail.confidencePct + (focusSignal?.setupScore ?? bot.detail.confidencePct)) / 2)
    : 0;

  const stateLabel = bot
    ? focusStateLabel({
        paused: storedStatus === 'paused',
        pending: Boolean(bot.expandedSetupPending),
        hasSignal: focusSignal != null && !focusSignal.id.startsWith('tracked-'),
        actionable,
        marketStatus,
      })
    : 'Watching';

  const activityLines = useMemo(() => {
    if (!bot || !focusSignal) return [];
    const p0 = pairFromWatched(bot.watchedPairs[0] ?? 'BTC');
    const p1 = pairFromWatched(bot.watchedPairs[1] ?? p0);
    const p2 = pairFromWatched(bot.watchedPairs[2] ?? p1);
    const lines = [
      `Scanned ${p0} — ${hasActiveSetup ? 'structure mapped' : 'no valid setup'}`,
      `Monitoring ${p1} after ${marketStatus === 'developing' ? 'impulse' : 'pullback'}`,
    ];
    if (!hasActiveSetup) {
      lines.push(`Rejected ${p2} — ${bot.detail.marketContext.volume === 'Weak' ? 'low volume' : 'timing'}`);
    } else {
      lines.push(`${p2} momentum check complete`);
    }
    if (marketStatus === 'triggered') {
      lines.push(`Trigger watch on ${focusSignal.pair}`);
    }
    return lines.slice(0, 5);
  }, [bot, focusSignal, hasActiveSetup, marketStatus]);

  const onIntervalChange = (v: TradeChartInterval) => {
    try {
      window.localStorage.setItem(TRADE_CHART_INTERVAL_STORAGE_KEY, v);
      window.dispatchEvent(new CustomEvent(SIGFLO_CHART_INTERVAL_EVENT, { detail: v }));
    } catch {
      /* ignore */
    }
  };

  const flash = (id: string) => {
    setTapFlash(id);
    window.setTimeout(() => setTapFlash(null), 160);
  };

  if (!bot) {
    return (
      <div className="space-y-3 pt-4 text-landing-text">
        <p className="text-sm text-landing-muted">Bot not found.</p>
        <Link to="/bots" className="text-sm font-semibold text-landing-accent-hi">
          Back to Bots
        </Link>
      </div>
    );
  }

  if (!chartModel || !chartModelForPlot) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-landing-muted">
        Preparing chart…
      </div>
    );
  }

  const setupSide = setupSideForExec;
  const rrDisplay =
    hasActiveSetup && bot.detail.entry != null && bot.detail.stop != null && bot.detail.target != null
      ? rrFromLevels(setupSide, bot.detail.entry, bot.detail.stop, bot.detail.target)
      : chartModel.riskReward;

  const stickyTone =
    hasActiveSetup && cardStatus !== 'paused'
      ? 'shadow-[0_12px_40px_-12px_rgba(0,200,120,0.25)] ring-1 ring-landing-accent/15'
      : 'shadow-[0_8px_32px_rgba(0,0,0,0.35)]';

  return (
    <div className="relative -mx-4 min-h-[100dvh] bg-landing-bg text-landing-text">
      <div
        className={`sticky z-20 -mx-0 border-b border-landing-border/60 bg-landing-bg/95 backdrop-blur-xl ${stickyTone}`}
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 3.5rem)' }}
      >
        <BotFocusHeader bot={bot} cardStatus={cardStatus} onBack={() => navigate(-1)} />

        <div className="relative">
          <TradeChartPanel
            collapsed={false}
            plotExpandedPx={BOT_FOCUS_CHART_PLOT_PX}
            plotCollapsedPx={BOT_FOCUS_CHART_PLOT_PX}
            model={chartModelForPlot}
            market="futures"
            intervalLabel={tradeChartIntervalShortLabel(chartInterval)}
            loadingInterval={live.loadingInterval}
            liveUpdatedAt={live.lastUpdateTs}
            change24hPct={chartModelForPlot.change24hPct}
            timeframeOptions={FOCUS_INTERVAL_OPTIONS}
            chartInterval={chartInterval}
            onChartIntervalChange={onIntervalChange}
            exchangeStyleHero
            metaCaption={execLive ? 'PERP · Live position' : 'PERP · Bot focus'}
            setupMode
            onRequestSetupMode={undefined}
            liveTradeMode={execLive}
            liveTradeOverlayPreset={execLive}
            suppressExchangeHeroLivePrice={execLive}
            liveActivePositionTitle="Live position"
            auxiliaryPriceLines={botExitChartAux}
            liveTradeRefitKey={execLive && execFillEntry != null ? `bot-focus-${execFillEntry}` : undefined}
            liveHeaderMetrics={{
              riskPercent:
                chartModelForPlot.entry > 0
                  ? Math.abs(((chartModelForPlot.stop - chartModelForPlot.entry) / chartModelForPlot.entry) * 100)
                  : 0,
              rewardPercent:
                chartModelForPlot.entry > 0
                  ? Math.abs(
                      ((chartModelForPlot.target - chartModelForPlot.entry) / chartModelForPlot.entry) * 100,
                    )
                  : 0,
              rrRatio:
                Number.isFinite(rrDisplay) && rrDisplay > 0 ? rrDisplay : chartModelForPlot.riskReward,
              badge: `${confidencePct}%`,
              ...(headerSecondaryPnl
                ? {
                    secondaryLine: headerSecondaryPnl.label,
                    secondaryLineTone: headerSecondaryPnl.tone,
                  }
                : {}),
            }}
            pnlHeaderLabel={execLive ? headerSecondaryPnl?.label : undefined}
            pnlHeaderTone={execLive ? headerSecondaryPnl?.tone : undefined}
            className="pb-1"
          />

          <div className="pointer-events-none absolute left-3 right-3 top-[4.25rem] flex items-start justify-between gap-2">
            <span className="rounded-full border border-landing-accent/30 bg-landing-surface/90 px-2 py-0.5 text-[10px] font-bold text-landing-accent-hi shadow-landing-glow-sm backdrop-blur-sm">
              {confidencePct}% conf.
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm ${
                setupSide === 'short'
                  ? 'border-rose-400/35 bg-rose-500/15 text-rose-100'
                  : 'border-landing-accent/35 bg-landing-accent-dim text-landing-accent-hi'
              }`}
            >
              {setupSide === 'short' ? 'Short' : 'Long'}
            </span>
          </div>
        </div>

        {bot.watchedPairs.length > 1 ? (
          <div className="flex gap-1.5 overflow-x-auto px-3 pb-2 pt-1">
            {bot.watchedPairs.map((p) => {
              const active = pairFromWatched(p) === pairFromWatched(selectedWatched);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    flash(`pair-${p}`);
                    setSelectedPairRaw(p);
                  }}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition active:scale-[0.97] ${
                    active
                      ? 'border-landing-accent/40 bg-landing-accent-dim text-landing-accent-hi'
                      : 'border-white/[0.08] bg-landing-surface/80 text-landing-muted'
                  } ${tapFlash === `pair-${p}` ? 'brightness-110' : ''}`}
                >
                  {pairFromWatched(p)}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="space-y-4 px-4 pb-[calc(10.5rem+env(safe-area-inset-bottom))] pt-4">
        <section className="rounded-2xl border border-landing-border bg-landing-surface/80 p-4 shadow-landing-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-landing-muted">Intent</p>
          <p className="mt-1.5 text-sm font-medium leading-snug text-landing-text">{bot.intentLine}</p>
          <p className="mt-2 text-xs leading-relaxed text-landing-muted">
            {bot.detail.commentaryShort ?? bot.detail.aiNote}
          </p>
          <div className="mt-3 inline-flex items-center rounded-full border border-white/[0.08] bg-black/25 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-landing-accent-hi">
            {stateLabel}
          </div>
        </section>

        {execLive && chartModelForPlot && focusSignal ? (
          <ExitAiCoPilotBlock
            model={botExitAiModel}
            exitMode={exitAuto.mode}
            onExitModeChange={exitAuto.setMode}
            onCloseNow={navigateToTradeForExit}
            compact
          />
        ) : null}

        <section
          className={`rounded-2xl border bg-landing-surface/90 p-4 ${
            hasActiveSetup ? 'border-landing-accent/25 shadow-landing-glow-sm' : 'border-landing-border'
          }`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-landing-muted">Setup</p>
          {hasActiveSetup ? (
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <dt className="text-landing-muted">Bias</dt>
                <dd className="mt-0.5 font-semibold text-landing-text">{bot.detail.bias}</dd>
              </div>
              <div>
                <dt className="text-landing-muted">Confidence</dt>
                <dd className="mt-0.5 font-semibold text-landing-accent-hi">{bot.detail.confidencePct}%</dd>
              </div>
              <div>
                <dt className="text-landing-muted">Entry</dt>
                <dd className="mt-0.5 font-mono text-landing-text">{formatBotPrice(bot.detail.entry)}</dd>
              </div>
              <div>
                <dt className="text-landing-muted">Stop</dt>
                <dd className="mt-0.5 font-mono text-rose-200/90">{formatBotPrice(bot.detail.stop)}</dd>
              </div>
              <div>
                <dt className="text-landing-muted">Target</dt>
                <dd className="mt-0.5 font-mono text-emerald-200/90">{formatBotPrice(bot.detail.target)}</dd>
              </div>
              <div>
                <dt className="text-landing-muted">R:R</dt>
                <dd className="mt-0.5 font-mono font-semibold text-landing-text">
                  {Number.isFinite(rrDisplay) && rrDisplay > 0 ? `${rrDisplay.toFixed(2)} : 1` : '—'}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="mt-2">
              <p className="text-sm font-semibold text-landing-text">No active setup</p>
              <p className="mt-1 text-xs text-landing-muted">Bot is monitoring market conditions</p>
            </div>
          )}
        </section>

        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-landing-muted">
            Market context
          </p>
          <MarketContextTags
            volatility={bot.detail.marketContext.volatility}
            structure={bot.detail.marketContext.structure}
            volume={bot.detail.marketContext.volume}
          />
        </section>

        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-landing-muted">Activity</p>
          <ul className="space-y-2">
            {activityLines.map((line) => (
              <li
                key={line}
                className="relative rounded-xl border border-white/[0.06] bg-landing-surface/60 py-2.5 pl-3 pr-2 text-xs text-landing-text/90 before:absolute before:left-0 before:top-0 before:h-full before:w-0.5 before:rounded-full before:bg-landing-accent/50"
              >
                {line}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-dashed border-white/[0.08] bg-landing-surface/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-landing-muted">Risk mode (soon)</p>
          <div className="mt-2 flex gap-2 opacity-45">
            {(['Aggressive', 'Balanced', 'Conservative'] as const).map((m) => (
              <span
                key={m}
                className="rounded-full border border-white/[0.08] px-2 py-1 text-[9px] font-semibold text-landing-muted"
              >
                {m}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-landing-border bg-landing-surface/60">
          <button
            type="button"
            onClick={() => setWhyOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-semibold text-landing-text transition active:bg-white/[0.04]"
          >
            Why this setup?
            <span className="text-landing-muted">{whyOpen ? '−' : '+'}</span>
          </button>
          {whyOpen ? <p className="border-t border-landing-border px-3 py-2.5 text-xs leading-relaxed text-landing-muted">{bot.detail.aiNote}</p> : null}
        </section>
      </div>

      {!executionOpen ? (
      <div
        className={`fixed left-0 right-0 z-[35] border-t border-landing-border bg-landing-surface/95 px-4 py-2.5 backdrop-blur-xl transition ${
          tapFlash === 'trade' ? 'brightness-105' : ''
        }`}
        style={{ bottom: 'calc(4.65rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          type="button"
          disabled={!canExecute}
          onClick={() => {
            flash('trade');
            setExecutionOpen(true);
          }}
          className="w-full rounded-xl bg-landing-accent py-2.5 text-sm font-bold text-landing-bg shadow-landing-glow-sm transition enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-landing-muted disabled:shadow-none"
        >
          Execute trade
        </button>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => {
              flash('pause');
              togglePause(bot.id);
            }}
            className={`rounded-xl border border-landing-border bg-landing-bg/80 py-2 text-[11px] font-semibold transition active:scale-[0.98] ${
              storedStatus === 'paused' ? 'text-landing-accent-hi' : 'text-landing-text'
            }`}
          >
            {storedStatus === 'paused' ? 'Resume' : 'Pause bot'}
          </button>
          <button
            type="button"
            onClick={() => {
              flash('risk');
              navigate(`/bots/${bot.id}`);
            }}
            className="rounded-xl border border-landing-border bg-landing-bg/80 py-2 text-[11px] font-semibold text-landing-text transition active:scale-[0.98]"
          >
            Adjust risk
          </button>
          <button
            type="button"
            onClick={() => {
              flash('chart');
              if (focusSignal) navigate(`/trade?${buildTradeQueryString(focusSignal, { marketStatus })}`);
            }}
            className="rounded-xl border border-landing-border bg-landing-bg/80 py-2 text-[11px] font-semibold text-landing-text transition active:scale-[0.98]"
          >
            Full chart
          </button>
        </div>
      </div>
      ) : null}

      <BotExecutionSheet
        open={executionOpen}
        onClose={() => setExecutionOpen(false)}
        pairLabel={chartModel.pair}
        chartModel={chartModel}
        side={setupSideForExec}
        setupScore={focusSignal?.setupScore ?? 55}
        balanceUsd={balanceForSizing}
        minOrderUsd={resolveMinOrderUsd(linearSymbol)}
        maxLeverage={symbolMaxLeverage ?? 200}
        onExecute={executeTradeFromFocus}
        onViewPosition={() => {
          if (focusSignal) {
            navigate(`/trade?${buildTradeQueryString(focusSignal, { marketStatus })}`);
          }
        }}
        tabBarInsetPx={74}
      />
    </div>
  );
}
