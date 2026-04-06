import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getMockTradeForPair, getMockTradeForSignalId } from '@/data/mockTrade';
import { mockSignals } from '@/data/mockSignals';
import { AssistedExitConfirmBar } from '@/components/trade/AssistedExitConfirmBar';
import { ExitAutomationControls } from '@/components/trade/ExitAutomationControls';
import { TradeChartScenarioStrip, computeScenarioProbabilities } from '@/components/trade/TradeChartScenarioStrip';
import { MarketToggle } from '@/components/trade/MarketToggle';
import { ActivePositionsPanel } from '@/components/trade/ActivePositionsPanel';
import { CloseAllPositionsModal } from '@/components/trade/CloseAllPositionsModal';
import { ExitModePanel } from '@/components/trade/ExitModePanel';
import { LiveMarketStrip } from '@/components/trade/LiveMarketStrip';
import { PositionActionsBar } from '@/components/trade/PositionActionsBar';
import { TradeChartPanel } from '@/components/trade/TradeChartPanel';
import { ChartInlineTradeButtons } from '@/components/trade/TradeActionBar';
import { TradeControls } from '@/components/trade/TradeControls';
import { LiveIndicator } from '@/components/trade/LiveIndicator';
import { TradeStats } from '@/components/trade/TradeStats';
import { TRADE_CHART_PLOT_EXPANDED_PX } from '@/config/tradeChartHeights';
import { formatQuoteNumber } from '@/lib/formatQuote';
import type { ManageTradePositionContext } from '@/lib/manageTradeContext';
import { useExitAutomation } from '@/hooks/useExitAutomation';
import { useLiveTradeMarket, type TradeChartInterval } from '@/hooks/useLiveTradeMarket';
import { managePnlFromPrices, parseManageTradeContext } from '@/lib/manageTradeContext';
import { positionMicroInsight } from '@/lib/positionMicroInsight';
import { deriveMarketStatus, parseMarketStatusQuery } from '@/lib/marketScannerRows';
import { formatElapsedAgo, postedAgoToSeconds, uiSignalStateClasses, uiSignalStateFromMarketStatus, uiSignalStateLabel } from '@/lib/signalState';
import { EXIT_AI_MODE_LABEL, EXIT_STRATEGY_LABEL } from '@/lib/aiExitAutomation';
import { TRADE_CHART_LEVEL_COLORS } from '@/lib/tradeChartLevels';
import { resolveExitGuidanceFlow } from '@/lib/tradeExitGuidanceFlow';
import { tradeTimingChipProps } from '@/lib/tradeTimingChip';
import { setupScoreBandShort } from '@/lib/setupScore';
import { deriveTradeMetrics } from '@/lib/tradeRisk';
import type { SymbolTicker } from '@/types/market';
import type { CryptoSignal, SetupScoreLabel, SignalRiskTag, SignalSetupTag } from '@/types/signal';
import type { SimulatedActivePosition } from '@/types/activePosition';
import type { MarketMode, TradeSide } from '@/types/trade';

/**
 * Trade screen layout map (refinement anchor):
 * - Signal / scanner state: sticky header (pair, `uiSignalState` + LiveIndicator, live connection meta).
 * - Timing / readiness: `ScannerInsightCard`, `ChartHeader` subtitle, chart dock `dockMeta` on `ChartInlineTradeButtons`.
 * - LONG / SHORT: `ChartInlineTradeButtons` (dock + assistant) and `TradeControls` when the sheet is expanded.
 * - Chart, intervals, Clean vs Setup: `TradeChartPanel` → `PriceChartCard` (`SetupToggle`).
 * - Entry / stop / target overlays: `PriceChartCard`, gated by `setupMode` (default false).
 * - AI explanation: `ScannerInsightCard`.
 */
const TRADE_CHART_INTERVAL_OPTIONS: { value: TradeChartInterval; label: string }[] = [
  { value: '5', label: '5m' },
  { value: '15', label: '15m' },
  { value: '60', label: '1H' },
  { value: '240', label: '4H' },
  { value: 'D', label: '1D' },
  { value: 'W', label: '1W' },
];

export function TradeScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const signalId = params.get('signal') ?? 'sig-1';
  const [market, setMarket] = useState<MarketMode>('futures');
  const [chartInterval, setChartInterval] = useState<TradeChartInterval>(() => {
    const saved = window.localStorage.getItem('sigflo.trade.chartInterval');
    if (saved === '5' || saved === '15' || saved === '60' || saved === '240' || saved === 'D' || saved === 'W') return saved;
    return '5';
  });
  const [amountUsd, setAmountUsd] = useState<number>(1200);
  const [leverage, setLeverage] = useState<number>(8);
  const [side, setSide] = useState<TradeSide>('long');
  const [stopStr, setStopStr] = useState('');
  const [targetStr, setTargetStr] = useState('');
  const [tradeToast, setTradeToast] = useState<string | null>(null);
  const toastClearRef = useRef<number>(0);
  const [execFlash, setExecFlash] = useState<'long' | 'short' | null>(null);
  const execFlashClearRef = useRef<number>(0);
  /** Price chart dock always mounts collapsed; preference is not persisted across visits. */
  const [chartDockOpen, setChartDockOpen] = useState(false);
  /** After user toggles the chart dock (title or chevron), drop the chevron glow/pulse. */
  const [chartDockChevronIdle, setChartDockChevronIdle] = useState(false);
  /** Clean = no trade overlays; Setup = entry / stop / target (and liq on perps). */
  const [setupMode, setSetupMode] = useState(false);
  /** Simulated fills after Short/Long — demo only; list-ready for multiple positions. */
  const [paperPositions, setPaperPositions] = useState<SimulatedActivePosition[]>([]);
  const [closeAllModalOpen, setCloseAllModalOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const appliedPortfolioDefaults = useRef<string | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => setTick((v) => v + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const pairFromQuery = params.get('pair');
  const ticketIntent = params.get('ticketIntent');
  const modeRaw = params.get('mode');
  const manageCtx = useMemo(() => parseManageTradeContext(params), [params]);
  const requestedManage = modeRaw === 'manage';
  const isManageMode = Boolean(requestedManage && manageCtx);
  const manageDataInvalid = requestedManage && manageCtx === null;
  const model = useMemo(() => {
    if (pairFromQuery && pairFromQuery.trim().length > 0) return getMockTradeForPair(pairFromQuery);
    return getMockTradeForSignalId(signalId);
  }, [pairFromQuery, signalId]);

  const selectedSignal = useMemo(() => {
    const fromQuery = buildSignalContextFromQuery(params, signalId);
    if (fromQuery) return fromQuery;
    return mockSignals.find((s) => s.id === signalId) ?? mockSignals[0];
  }, [params, signalId]);

  useEffect(() => {
    if (isManageMode || signalId.startsWith('pf-')) return;
    setSide(selectedSignal.side === 'short' ? 'short' : 'long');
  }, [isManageMode, signalId, selectedSignal.side]);

  const manageSideParam = params.get('side');
  useEffect(() => {
    if (!isManageMode) return;
    if (manageSideParam === 'long' || manageSideParam === 'short') setSide(manageSideParam);
  }, [isManageMode, manageSideParam]);

  useEffect(() => {
    const fromPf = signalId.startsWith('pf-');
    if (!fromPf) {
      appliedPortfolioDefaults.current = null;
      return;
    }
    const key = `${signalId}|${params.toString()}`;
    if (appliedPortfolioDefaults.current === key) return;
    appliedPortfolioDefaults.current = key;

    const pu = Number(params.get('positionUsd'));
    if (Number.isFinite(pu) && pu > 0) {
      setAmountUsd(Math.round(Math.min(Math.max(pu, 10), 1_000_000)));
    }
    const s = params.get('side');
    if (s === 'long' || s === 'short') setSide(s);
  }, [params, signalId]);

  const scannerStatus = useMemo(
    () => parseMarketStatusQuery(params.get('marketStatus')) ?? deriveMarketStatus(selectedSignal),
    [params, selectedSignal],
  );
  const uiState = uiSignalStateFromMarketStatus(scannerStatus);
  const uiStateStyle = uiSignalStateClasses(uiState);
  const isTriggered = uiState === 'triggered';
  const stateAgeLabel = useMemo(
    () => formatElapsedAgo(postedAgoToSeconds(selectedSignal.postedAgo) + tick),
    [selectedSignal.postedAgo, tick],
  );

  const liveSymbol = useMemo(() => pairBaseToLinearSymbol(selectedSignal.pair), [selectedSignal.pair]);
  const live = useLiveTradeMarket(liveSymbol, chartInterval);

  const portfolioEntryRaw = params.get('portfolioEntry');
  const portfolioEntry = portfolioEntryRaw ? Number(portfolioEntryRaw) : NaN;

  const mergedModel = useMemo(() => {
    const next = { ...model };
    if (live.lastPrice != null) next.lastPrice = live.lastPrice;
    if (live.change24hPct != null) next.change24hPct = live.change24hPct;
    if (live.high24h != null) next.high24h = live.high24h;
    if (live.low24h != null) next.low24h = live.low24h;
    if (live.volume24h != null) next.volume24h = live.volume24h;
    if (live.priceSeries && live.priceSeries.length > 20) next.priceSeries = live.priceSeries;
    if (live.chartCandles && live.chartCandles.length > 20) next.chartCandles = live.chartCandles;
    if (Number.isFinite(portfolioEntry) && portfolioEntry > 0) next.entry = portfolioEntry;
    if (isManageMode && manageCtx) {
      next.entry = manageCtx.entryPrice;
      if (manageCtx.pair) next.pair = manageCtx.pair;
    }
    return next;
  }, [live, model, portfolioEntry, isManageMode, manageCtx]);

  useEffect(() => {
    setStopStr(String(mergedModel.stop));
    setTargetStr(String(mergedModel.target));
  }, [mergedModel.pair]);

  useEffect(() => {
    setPaperPositions([]);
  }, [mergedModel.pair]);

  const stopParsed = parseFloat(stopStr.replace(/,/g, ''));
  const targetParsed = parseFloat(targetStr.replace(/,/g, ''));
  const modelForMetrics = useMemo(() => {
    const next = { ...mergedModel };
    if (Number.isFinite(stopParsed) && stopParsed > 0) next.stop = stopParsed;
    if (Number.isFinite(targetParsed) && targetParsed > 0) next.target = targetParsed;
    return next;
  }, [mergedModel, stopParsed, targetParsed]);

  const markForManage = live.lastPrice ?? manageCtx?.markPrice ?? mergedModel.lastPrice;

  const insightTicker = useMemo((): SymbolTicker | undefined => {
    if (live.lastPrice == null || live.high24h == null || live.low24h == null) return undefined;
    return {
      symbol: liveSymbol,
      lastPrice: live.lastPrice,
      high24h: live.high24h,
      low24h: live.low24h,
      volume24h: 0,
      turnover24h: 0,
      price24hPcnt: (live.change24hPct ?? 0) / 100,
    };
  }, [liveSymbol, live.lastPrice, live.high24h, live.low24h, live.change24hPct]);

  const managePnlDisplay = useMemo(() => {
    if (!isManageMode || !manageCtx) return null;
    return managePnlFromPrices(manageCtx.side, manageCtx.entryPrice, markForManage, manageCtx.positionUsd);
  }, [isManageMode, manageCtx, markForManage]);

  const manageInsightLine = useMemo(() => {
    if (!isManageMode || !manageCtx || !managePnlDisplay) return null;
    return positionMicroInsight({ side: manageCtx.side }, markForManage, managePnlDisplay.pnlPct, insightTicker);
  }, [isManageMode, manageCtx, managePnlDisplay, markForManage, insightTicker]);

  const levForMetrics = market === 'spot' ? 1 : leverage;
  const metrics = useMemo(
    () =>
      deriveTradeMetrics(modelForMetrics, {
        amountUsd,
        leverage: levForMetrics,
        side,
        market,
        setupScore: selectedSignal.setupScore,
      }),
    [amountUsd, levForMetrics, market, modelForMetrics, selectedSignal.setupScore, side],
  );

  const primaryOpenPosition = paperPositions[0] ?? null;
  const hasOpenPosition = !isManageMode && paperPositions.length > 0;
  const isLiveTradeMode = hasOpenPosition;

  /** Chart overlays: liquidation tracks sizing inputs (`deriveTradeMetrics`), not static mock liq. */
  const chartModelForPlot = useMemo(() => {
    const next = { ...modelForMetrics };
    if (market === 'futures' && Number.isFinite(metrics.liquidation) && metrics.liquidation > 0) {
      next.liquidation = metrics.liquidation;
    }
    const pos = primaryOpenPosition;
    if (pos && !isManageMode) {
      next.entry = pos.entryPrice;
      if (pos.stopLossPrice != null && Number.isFinite(pos.stopLossPrice) && pos.stopLossPrice > 0) {
        next.stop = pos.stopLossPrice;
      }
      if (pos.takeProfitPrice != null && Number.isFinite(pos.takeProfitPrice) && pos.takeProfitPrice > 0) {
        next.target = pos.takeProfitPrice;
      }
      if (
        market === 'futures' &&
        pos.liquidationPrice != null &&
        Number.isFinite(pos.liquidationPrice) &&
        pos.liquidationPrice > 0
      ) {
        next.liquidation = pos.liquidationPrice;
      }
    }
    return next;
  }, [isManageMode, market, metrics.liquidation, modelForMetrics, primaryOpenPosition]);

  const liveUnrealized = useMemo(() => {
    const mark = modelForMetrics.lastPrice;
    if (primaryOpenPosition && Number.isFinite(mark)) {
      const entry = Math.max(1e-9, primaryOpenPosition.entryPrice);
      const dir = primaryOpenPosition.side === 'long' ? 1 : -1;
      const movePct = ((mark - entry) / entry) * 100 * dir;
      const pnlUsd = primaryOpenPosition.positionNotionalUsd * (movePct / 100);
      return { pnlUsd, movePct };
    }
    const entry = Math.max(0.000001, modelForMetrics.entry);
    const dir = side === 'long' ? 1 : -1;
    const movePct = ((modelForMetrics.lastPrice - entry) / entry) * 100 * dir;
    const pnlUsd = metrics.positionSizeUsd * (movePct / 100);
    return { pnlUsd, movePct };
  }, [
    primaryOpenPosition,
    modelForMetrics.entry,
    modelForMetrics.lastPrice,
    metrics.positionSizeUsd,
    side,
  ]);

  /** Round-trip taker fee heuristic (~0.055% per side). */
  const estFeeUsd = metrics.positionSizeUsd * 0.00055 * 2;

  const canExecute = amountUsd > 0 && metrics.balanceUsd > 0 && Number.isFinite(metrics.positionSizeUsd);

  const tradeDockStats = useMemo(() => {
    const entry = chartModelForPlot.entry;
    const stop = chartModelForPlot.stop;
    const target = chartModelForPlot.target;
    const rr = mergedModel.riskReward;
    const effSide = primaryOpenPosition && !isManageMode ? primaryOpenPosition.side : side;
    if (!Number.isFinite(entry) || entry <= 0) {
      return { rewardPercent: 0, riskPercent: 0, rrRatio: Number.isFinite(rr) ? rr : 0 };
    }
    let rewardPct: number;
    let riskPct: number;
    if (effSide === 'long') {
      rewardPct = ((target - entry) / entry) * 100;
      riskPct = ((entry - stop) / entry) * 100;
    } else {
      rewardPct = ((entry - target) / entry) * 100;
      riskPct = ((stop - entry) / entry) * 100;
    }
    return {
      rewardPercent: Number.isFinite(rewardPct) ? rewardPct : 0,
      riskPercent: Number.isFinite(riskPct) ? Math.abs(riskPct) : 0,
      rrRatio: Number.isFinite(rr) ? rr : 0,
    };
  }, [
    chartModelForPlot.entry,
    chartModelForPlot.stop,
    chartModelForPlot.target,
    isManageMode,
    mergedModel.riskReward,
    primaryOpenPosition,
    side,
  ]);

  const scenarioProb = useMemo(
    () =>
      computeScenarioProbabilities({
        tradeScore: metrics.riskSummary.tradeScore,
        setupScore: selectedSignal.setupScore,
        side: side === 'long' ? 'long' : 'short',
      }),
    [metrics.riskSummary.tradeScore, selectedSignal.setupScore, side],
  );

  const dockTimingChip = useMemo(
    () => tradeTimingChipProps(scannerStatus, metrics.riskSummary.tradeScore),
    [scannerStatus, metrics.riskSummary.tradeScore],
  );

  const dockDecisionMeta = useMemo(
    () => ({
      confidenceLabel: String(metrics.riskSummary.tradeScore),
      setupQualityLabel: setupScoreBandShort(selectedSignal),
      timing: dockTimingChip,
    }),
    [dockTimingChip, metrics.riskSummary.tradeScore, selectedSignal],
  );

  const exitAutomationScopeKey = useMemo(() => {
    if (isManageMode && manageCtx) {
      return `pos:${manageCtx.pair}:${manageCtx.entryPrice}:${manageCtx.side}`;
    }
    return `pre:${signalId}:${mergedModel.pair}`;
  }, [isManageMode, manageCtx, signalId, mergedModel.pair]);

  const exitAuto = useExitAutomation(exitAutomationScopeKey);

  const loggedModeRef = useRef<typeof exitAuto.mode | null>(null);
  const loggedStratRef = useRef<typeof exitAuto.strategy | null>(null);
  const prevEffStateRef = useRef<string | null>(null);
  const prevAutoStateRef = useRef<'hold' | 'trim' | 'exit' | null>(null);
  const prevPnlForSafeguardRef = useRef<number | null>(null);

  useEffect(() => {
    loggedModeRef.current = null;
    loggedStratRef.current = null;
    prevEffStateRef.current = null;
    prevAutoStateRef.current = null;
    prevPnlForSafeguardRef.current = null;
  }, [exitAutomationScopeKey]);

  const exitFlow = useMemo(() => {
    if (isManageMode) {
      if (!manageCtx || !managePnlDisplay) return null;
      const mark =
        typeof markForManage === 'number' && Number.isFinite(markForManage)
          ? markForManage
          : mergedModel.entry;
      return resolveExitGuidanceFlow({
        variant: 'manage',
        side: manageCtx.side,
        entry: manageCtx.entryPrice,
        mark,
        stop: modelForMetrics.stop,
        target: modelForMetrics.target,
        trendAlignment: selectedSignal.scoreBreakdown.trendAlignment,
        momentumQuality: selectedSignal.scoreBreakdown.momentumQuality,
        pnlPct: managePnlDisplay.pnlPct,
        strategyPreset: exitAuto.strategy,
        safeguards: exitAuto.safeguards,
        exitAiMode: exitAuto.mode,
      });
    }
    return resolveExitGuidanceFlow({
      variant: 'trade',
      side: primaryOpenPosition?.side ?? side,
      entry: primaryOpenPosition?.entryPrice ?? modelForMetrics.entry,
      estimatedPnlPct: liveUnrealized.movePct,
      stop: chartModelForPlot.stop,
      target: chartModelForPlot.target,
      trendAlignment: selectedSignal.scoreBreakdown.trendAlignment,
      momentumQuality: selectedSignal.scoreBreakdown.momentumQuality,
      strategyPreset: exitAuto.strategy,
      safeguards: exitAuto.safeguards,
      exitAiMode: exitAuto.mode,
    });
  }, [
    chartModelForPlot.stop,
    chartModelForPlot.target,
    isManageMode,
    manageCtx,
    managePnlDisplay,
    markForManage,
    mergedModel.entry,
    primaryOpenPosition?.entryPrice,
    primaryOpenPosition?.side,
    side,
    liveUnrealized.movePct,
    selectedSignal.scoreBreakdown.trendAlignment,
    selectedSignal.scoreBreakdown.momentumQuality,
    exitAuto.mode,
    exitAuto.strategy,
    exitAuto.safeguards,
  ]);

  const chartAuxiliaryLines = useMemo(() => {
    if (!isLiveTradeMode || !exitFlow) return undefined;
    if (exitFlow.effective.state !== 'trim') return undefined;
    const e = chartModelForPlot.entry;
    const t = chartModelForPlot.target;
    if (!Number.isFinite(e) || !Number.isFinite(t) || e <= 0 || t <= 0) return undefined;
    const mid = e + (t - e) * 0.55;
    if (!Number.isFinite(mid) || mid <= 0) return undefined;
    return [{ id: 'trim-sig', price: mid, color: TRADE_CHART_LEVEL_COLORS.trim, title: 'Trim' }];
  }, [chartModelForPlot.entry, chartModelForPlot.target, exitFlow, isLiveTradeMode]);

  const chartProximity = useMemo((): 'stop' | 'target' | null => {
    if (!isLiveTradeMode) return null;
    const mark = mergedModel.lastPrice;
    const stop = chartModelForPlot.stop;
    const target = chartModelForPlot.target;
    if (Number.isFinite(mark) && mark > 0 && Number.isFinite(stop) && stop > 0) {
      if (Math.abs(mark - stop) / mark < 0.004) return 'stop';
    }
    if (Number.isFinite(mark) && mark > 0 && Number.isFinite(target) && target > 0) {
      if (Math.abs(mark - target) / mark < 0.004) return 'target';
    }
    return null;
  }, [chartModelForPlot.stop, chartModelForPlot.target, isLiveTradeMode, mergedModel.lastPrice]);

  const liveChartRefitKey =
    isLiveTradeMode && primaryOpenPosition
      ? `${mergedModel.pair}|${primaryOpenPosition.id}|${chartDockOpen ? '1' : '0'}`
      : undefined;

  /** Chart dock header (under `LiveMarketStrip`): R / T / R:R + setup tier or live exit-state badge — not last price. */
  const dockChartHeaderMetrics = useMemo(() => {
    const setupBand = setupScoreBandShort(selectedSignal);
    const setupBadge = setupBand === 'Developing' ? 'Building' : setupBand;
    let badge: string | undefined = setupBadge;
    if (isLiveTradeMode && exitFlow) {
      const st = exitFlow.effective.state;
      badge = st === 'trim' ? 'TRIM' : st === 'exit' ? 'EXIT' : setupBadge;
    }
    const secondaryLine =
      isLiveTradeMode && Number.isFinite(liveUnrealized.pnlUsd)
        ? `uPnL ${liveUnrealized.pnlUsd >= 0 ? '+' : '−'}$${formatQuoteNumber(Math.abs(liveUnrealized.pnlUsd))}`
        : undefined;
    return {
      riskPercent: tradeDockStats.riskPercent,
      rewardPercent: tradeDockStats.rewardPercent,
      rrRatio: tradeDockStats.rrRatio,
      badge,
      secondaryLine,
    };
  }, [
    exitFlow,
    isLiveTradeMode,
    liveUnrealized.pnlUsd,
    selectedSignal,
    tradeDockStats.rewardPercent,
    tradeDockStats.riskPercent,
    tradeDockStats.rrRatio,
  ]);

  const scenarioSummaryLine = useMemo(() => {
    const score = metrics.riskSummary.tradeScore;
    const setup = setupScoreBandShort(selectedSignal);
    const setupShown = setup === 'Developing' ? 'Building' : setup;
    const st = exitFlow?.effective.state;
    const head = st && st !== 'hold' ? `${st.toUpperCase()} · ` : '';
    return `${head}Trade ${score} · ${setupShown}`;
  }, [exitFlow?.effective.state, metrics.riskSummary.tradeScore, selectedSignal]);

  const exitAiModeLabel = EXIT_AI_MODE_LABEL[exitAuto.mode];
  const exitStrategyLabel = EXIT_STRATEGY_LABEL[exitAuto.strategy];

  useEffect(() => {
    if (loggedModeRef.current === null) {
      loggedModeRef.current = exitAuto.mode;
      return;
    }
    if (loggedModeRef.current !== exitAuto.mode) {
      exitAuto.pushActivity({
        kind: 'mode_change',
        message: `Switched to ${EXIT_AI_MODE_LABEL[exitAuto.mode]}`,
      });
      loggedModeRef.current = exitAuto.mode;
    }
  }, [exitAuto.mode, exitAuto.pushActivity]);

  useEffect(() => {
    if (loggedStratRef.current === null) {
      loggedStratRef.current = exitAuto.strategy;
      return;
    }
    if (loggedStratRef.current !== exitAuto.strategy) {
      exitAuto.pushActivity({
        kind: 'strategy_change',
        message: `Exit behavior set to ${EXIT_STRATEGY_LABEL[exitAuto.strategy]}`,
      });
      loggedStratRef.current = exitAuto.strategy;
    }
  }, [exitAuto.strategy, exitAuto.pushActivity]);

  useEffect(() => {
    if (!exitFlow) return;
    const s = exitFlow.effective.state;
    if (prevEffStateRef.current === null) {
      prevEffStateRef.current = s;
      return;
    }
    if (prevEffStateRef.current !== s) {
      exitAuto.pushActivity({
        kind: 'exit_state',
        message: `Exit state changed to ${s.toUpperCase()}`,
      });
      prevEffStateRef.current = s;
    }
  }, [exitFlow, exitAuto.pushActivity]);

  useEffect(() => {
    if (!exitFlow) return;
    const maxL = exitAuto.safeguards.maxLossPct;
    const pnl = exitFlow.pnlPct;
    const prev = prevPnlForSafeguardRef.current;
    const crossed = prev !== null && prev > -maxL && pnl <= -maxL;
    if (crossed) {
      exitAuto.pushActivity({
        kind: 'safeguard',
        message: 'Max loss safeguard crossed — favoring protective exit.',
      });
    }
    prevPnlForSafeguardRef.current = pnl;
  }, [exitFlow, exitAuto.safeguards.maxLossPct, exitAuto.pushActivity]);

  useEffect(() => {
    if (!exitFlow) {
      prevAutoStateRef.current = null;
      return;
    }
    if (exitAuto.mode !== 'auto') {
      prevAutoStateRef.current = exitFlow.effective.state;
      return;
    }
    const curr = exitFlow.effective.state;
    const prev = prevAutoStateRef.current;
    if (prev !== null && prev !== curr) {
      if (curr === 'trim' && prev === 'hold' && exitAuto.safeguards.allowPartialExits) {
        exitAuto.pushActivity({
          kind: 'auto_trim',
          message: `Closed 50% at ${formatQuoteNumber(exitFlow.lastPrice)} (simulated)`,
        });
      }
      if (
        curr === 'exit' &&
        exitAuto.safeguards.allowFullAutoClose &&
        (prev === 'hold' || prev === 'trim')
      ) {
        exitAuto.pushActivity({
          kind: 'auto_close',
          message: `Remaining position exited at ${formatQuoteNumber(exitFlow.lastPrice)} (simulated)`,
        });
      }
    }
    prevAutoStateRef.current = curr;
  }, [
    exitFlow,
    exitAuto.mode,
    exitAuto.safeguards.allowPartialExits,
    exitAuto.safeguards.allowFullAutoClose,
    exitAuto.pushActivity,
  ]);

  const flashTradeToast = useCallback((message: string) => {
    setTradeToast(message);
    window.clearTimeout(toastClearRef.current);
    toastClearRef.current = window.setTimeout(() => setTradeToast(null), 2600);
  }, []);

  const executeTrade = useCallback(
    (nextSide: TradeSide) => {
      setSide(nextSide);
      setExecFlash(nextSide === 'long' ? 'long' : 'short');
      window.clearTimeout(execFlashClearRef.current);
      execFlashClearRef.current = window.setTimeout(() => setExecFlash(null), 420);
      const usd = Math.round(amountUsd).toLocaleString('en-US');
      const lev = market === 'spot' ? 1 : leverage;
      if (market === 'spot') {
        flashTradeToast(nextSide === 'long' ? `Buy — $${usd}` : `Sell — $${usd}`);
      } else if (nextSide === 'long') {
        flashTradeToast(`Long opened — $${usd} @ ${lev}x`);
      } else {
        flashTradeToast(`Short opened — $${usd} @ ${lev}x`);
      }

      const mark = mergedModel.lastPrice;
      if (!Number.isFinite(mark) || mark <= 0) return;
      const tp = Number.isFinite(targetParsed) && targetParsed > 0 ? targetParsed : null;
      const sl = Number.isFinite(stopParsed) && stopParsed > 0 ? stopParsed : null;
      const liq =
        market === 'futures' && Number.isFinite(metrics.liquidation) && metrics.liquidation > 0
          ? metrics.liquidation
          : null;
      const pos: SimulatedActivePosition = {
        id: crypto.randomUUID(),
        symbol: mergedModel.pair,
        side: nextSide,
        market,
        leverage: lev,
        entryPrice: mark,
        positionNotionalUsd: metrics.positionSizeUsd,
        marginUsd: metrics.amountUsedUsd,
        liquidationPrice: liq,
        takeProfitPrice: tp,
        stopLossPrice: sl,
        openedAtMs: Date.now(),
      };
      setPaperPositions((prev) => [...prev, pos]);
    },
    [
      amountUsd,
      flashTradeToast,
      leverage,
      market,
      mergedModel.lastPrice,
      mergedModel.pair,
      metrics.amountUsedUsd,
      metrics.liquidation,
      metrics.positionSizeUsd,
      stopParsed,
      targetParsed,
    ],
  );

  const onPaperCloseOne = useCallback(
    (id: string) => {
      setPaperPositions((prev) => prev.filter((p) => p.id !== id));
      flashTradeToast('Position cleared (demo). Confirm exit on your exchange.');
    },
    [flashTradeToast],
  );

  const onPaperPartialClose = useCallback(
    (id: string, fraction: number) => {
      setPaperPositions((prev) =>
        prev
          .map((p) => {
            if (p.id !== id) return p;
            const nextNotional = p.positionNotionalUsd * (1 - fraction);
            const nextMargin = p.marginUsd * (1 - fraction);
            if (nextNotional < 12) return null;
            return { ...p, positionNotionalUsd: nextNotional, marginUsd: nextMargin };
          })
          .filter((p): p is SimulatedActivePosition => p != null),
      );
      flashTradeToast(`Simulated ${Math.round(fraction * 100)}% scale-out — finalize on your exchange.`);
    },
    [flashTradeToast],
  );

  const onPaperCloseAll = useCallback(() => {
    setPaperPositions([]);
    flashTradeToast('All demo positions cleared.');
  }, [flashTradeToast]);

  const onClosePosition = useCallback(() => {
    flashTradeToast('Close position on your exchange — Sigflo does not route orders.');
  }, [flashTradeToast]);

  const onAddToPosition = useCallback(() => {
    flashTradeToast('Add size on your exchange — use the plan above as guidance.');
  }, [flashTradeToast]);

  const onReducePosition = useCallback(() => {
    flashTradeToast('Reduce or partially close on your exchange.');
  }, [flashTradeToast]);

  const intervalLabel =
    chartInterval === 'D' ? '1D' : chartInterval === 'W' ? '1W' : chartInterval === '60' ? '1h' : chartInterval === '240' ? '4h' : `${chartInterval}m`;

  const toggleChartDock = useCallback(() => {
    setChartDockChevronIdle(true);
    setChartDockOpen((o) => !o);
  }, []);

  const tradeScrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#050505] text-white">
      {!isManageMode ? (
        <CloseAllPositionsModal
          open={closeAllModalOpen}
          onCancel={() => setCloseAllModalOpen(false)}
          onConfirm={() => {
            setCloseAllModalOpen(false);
            onPaperCloseAll();
          }}
        />
      ) : null}
      {tradeToast ? (
        <div
          className="pointer-events-none fixed left-1/2 z-[60] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 transition-opacity duration-200"
          style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
          role="status"
        >
          <div className="rounded-xl border border-[#00ffc8]/35 bg-black/90 px-3 py-2.5 text-center text-sm font-semibold text-[#00ffc8] shadow-[0_12px_40px_-12px_rgba(0,255,200,0.22)] backdrop-blur-md">
            {tradeToast}
          </div>
        </div>
      ) : null}

      <div className="sticky top-0 z-30 shrink-0 border-b border-white/10 bg-black/60 backdrop-blur-md transition-[box-shadow] duration-300">
        <header className="mx-auto max-w-lg px-3 pb-1.5 pt-[max(0.35rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] text-sigflo-muted transition hover:text-white"
              aria-label="Back"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {isManageMode ? (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200/90">Managing position</p>
                  <p className="mt-0.5 truncate text-sm font-bold text-white">{mergedModel.pair}</p>
                </div>
                {market === 'spot' ? (
                  <div className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-sigflo-muted">Spot</div>
                ) : null}
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-1 rounded-xl border border-transparent py-1 text-left transition hover:border-white/[0.06] hover:bg-white/[0.03]"
                  aria-label="Pair"
                >
                  <span className="truncate text-base font-bold tracking-tight text-white">{mergedModel.pair}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-sigflo-muted" aria-hidden>
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {isTriggered ? (
                  <button
                    type="button"
                    onClick={() => navigate('/feed')}
                    className={`sigflo-trade-header-triggered flex max-w-[40%] shrink-0 flex-col items-end gap-0.5 rounded-lg py-0.5 pl-2 text-right text-[10px] font-semibold leading-tight transition hover:bg-white/[0.08] active:scale-[0.98] ${uiStateStyle.text}`}
                    aria-label="Back to signals"
                  >
                    <span className="inline-flex items-center justify-end gap-1">
                      <LiveIndicator
                        pulse={uiStateStyle.pulse}
                        dotClassName={uiStateStyle.dot}
                        size="md"
                        pulseDurationSec={2.4}
                      />
                      <span className="truncate uppercase tracking-[0.11em] text-[#b2ffef]">
                        {uiSignalStateLabel(uiState)}
                      </span>
                      <span className="shrink-0 font-normal text-sigflo-muted">· {stateAgeLabel}</span>
                    </span>
                  </button>
                ) : (
                  <div
                    className={`flex max-w-[40%] shrink-0 flex-col items-end gap-0.5 text-right text-[10px] font-semibold leading-tight ${uiStateStyle.text}`}
                  >
                    <span className="inline-flex items-center justify-end gap-1">
                      <LiveIndicator
                        pulse={uiStateStyle.pulse}
                        dotClassName={uiStateStyle.dot}
                        size="sm"
                        pulseDurationSec={2.8}
                      />
                      <span className="truncate">{uiSignalStateLabel(uiState)}</span>
                    </span>
                    <span className="max-w-full truncate font-normal text-sigflo-muted">
                      {live.mode} · {live.connection}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] text-sigflo-muted transition hover:text-amber-200/90"
                  aria-label="Watchlist"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M12 3l2.09 6.26H21l-5.45 3.96 2.09 6.26L12 15.77 6.36 19.48l2.09-6.26L3 9.26h6.91L12 3z" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] text-sigflo-muted transition hover:text-white"
                  aria-label="More"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="5" cy="12" r="1.5" fill="currentColor" />
                    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                    <circle cx="19" cy="12" r="1.5" fill="currentColor" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </header>
      </div>

      <div
        ref={tradeScrollRef}
        className={`trade-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain ${
          isLiveTradeMode ? 'gap-0' : 'gap-1'
        }`}
      >
        <div
          className={`mx-auto flex w-full max-w-lg flex-col px-3 pb-0 ${isLiveTradeMode ? 'gap-0 pt-1.5' : 'gap-1 pt-2'}`}
        >
          <div className="flex flex-col gap-1">
            <MarketToggle value={market} onChange={setMarket} />
            {!isManageMode ? (
              <TradeChartScenarioStrip
                mode="trade"
                side={primaryOpenPosition?.side ?? side}
                estimatedPnlUsd={liveUnrealized.pnlUsd}
                estimatedPnlPct={liveUnrealized.movePct}
                targetProfitUsd={metrics.targetProfitUsd}
                stopLossUsd={metrics.stopLossUsd}
                riskReward={mergedModel.riskReward}
                probUp={scenarioProb.probUp}
                probDown={scenarioProb.probDown}
                marginUsd={primaryOpenPosition?.marginUsd ?? metrics.amountUsedUsd}
                estFeeUsd={estFeeUsd}
                liqPrice={
                  market === 'futures'
                    ? (primaryOpenPosition?.liquidationPrice ?? metrics.liquidation)
                    : null
                }
                entry={primaryOpenPosition?.entryPrice ?? modelForMetrics.entry}
                stop={modelForMetrics.stop}
                target={modelForMetrics.target}
                positionSizeUsd={primaryOpenPosition?.positionNotionalUsd ?? metrics.positionSizeUsd}
                leverage={primaryOpenPosition?.leverage ?? leverage}
                isFutures={market === 'futures'}
                tradeScore={metrics.riskSummary.tradeScore}
                setupScore={selectedSignal.setupScore}
                trendAlignment={selectedSignal.scoreBreakdown.trendAlignment}
                momentumQuality={selectedSignal.scoreBreakdown.momentumQuality}
                exitAiMode={exitAuto.mode}
                exitStrategyPreset={exitAuto.strategy}
                automationSafeguards={exitAuto.safeguards}
              />
            ) : managePnlDisplay && manageCtx ? (
              <TradeChartScenarioStrip
                mode="manage"
                pnlUsd={managePnlDisplay.pnlUsd}
                pnlPct={managePnlDisplay.pnlPct}
                pair={manageCtx.pair}
                entry={manageCtx.entryPrice}
                mark={
                  typeof markForManage === 'number' && Number.isFinite(markForManage)
                    ? markForManage
                    : mergedModel.entry
                }
                sizeLabel={manageStripSizeLabel(manageCtx)}
                side={manageCtx.side}
                riskReward={mergedModel.riskReward}
                stop={modelForMetrics.stop}
                target={modelForMetrics.target}
                trendAlignment={selectedSignal.scoreBreakdown.trendAlignment}
                momentumQuality={selectedSignal.scoreBreakdown.momentumQuality}
                exitAiMode={exitAuto.mode}
                exitStrategyPreset={exitAuto.strategy}
                automationSafeguards={exitAuto.safeguards}
              />
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            {exitAuto.mode === 'assisted' &&
            exitFlow &&
            (exitFlow.effective.state === 'trim' || exitFlow.effective.state === 'exit') ? (
              <AssistedExitConfirmBar
                headline={exitFlow.effective.headline}
                detail={exitFlow.effective.action}
                onConfirm={() => {
                  exitAuto.pushActivity({
                    kind: 'assisted_ready',
                    message: `Confirmed prepared exit (${exitFlow.effective.headline})`,
                  });
                  flashTradeToast('Prepared exit acknowledged — complete on your exchange.');
                }}
              />
            ) : null}
            <ExitModePanel live={Boolean(isLiveTradeMode)}>
              <ExitAutomationControls
                mode={exitAuto.mode}
                onModeChange={exitAuto.setMode}
                strategy={exitAuto.strategy}
                onStrategyChange={exitAuto.setStrategy}
                safeguards={exitAuto.safeguards}
                onSafeguardsChange={exitAuto.setSafeguards}
                activity={exitAuto.activity}
                onClearActivity={exitAuto.clearActivity}
                compactActivity={!isManageMode}
              />
            </ExitModePanel>
          </div>
          {!isManageMode ? (
            <ActivePositionsPanel
              positions={paperPositions}
              markPrice={
                Number.isFinite(mergedModel.lastPrice) && mergedModel.lastPrice > 0
                  ? mergedModel.lastPrice
                  : paperPositions[0]?.entryPrice ?? 0
              }
              nowMs={Date.now()}
              onRequestCloseAllModal={() => setCloseAllModalOpen(true)}
              exitAiModeLabel={exitAiModeLabel}
              exitStrategyLabel={exitStrategyLabel}
              scenarioSummary={scenarioSummaryLine}
            />
          ) : null}
        </div>

        <TradeControls
          manageDataInvalid={manageDataInvalid}
          ticketIntent={ticketIntent}
          market={market}
          mergedModel={mergedModel}
          isManageMode={isManageMode}
          manageCtx={manageCtx}
          managePnlDisplay={managePnlDisplay}
          markForManage={markForManage}
          manageInsightLine={manageInsightLine}
          selectedSignal={selectedSignal}
          scannerStatus={scannerStatus}
          amountUsd={amountUsd}
          leverage={leverage}
          side={side}
          stopStr={stopStr}
          targetStr={targetStr}
          onAmountChange={setAmountUsd}
          onLeverageChange={setLeverage}
          onStopStrChange={setStopStr}
          onTargetStrChange={setTargetStr}
          metrics={metrics}
          estFeeUsd={estFeeUsd}
          onClosePosition={onClosePosition}
          onAddToPosition={onAddToPosition}
        />
      </div>

      <div
        className={`sticky bottom-0 z-30 shrink-0 bg-black/[0.92] backdrop-blur-xl ${
          isLiveTradeMode
            ? 'border-t border-[#00ffc8]/20 shadow-[0_-20px_56px_-24px_rgba(0,255,200,0.14)]'
            : 'border-t border-white/10'
        }`}
      >
        <div className="divide-y divide-white/[0.06]">
          {!isManageMode ? (
            <LiveMarketStrip
              symbol={mergedModel.pair}
              lastPrice={Number.isFinite(mergedModel.lastPrice) ? mergedModel.lastPrice : null}
              movePct={mergedModel.change24hPct ?? null}
              moveLabel="24h"
              statusLabel={isLiveTradeMode ? 'In play' : undefined}
              pulse={isLiveTradeMode}
            />
          ) : null}
          <div className="mx-auto w-full max-w-lg border-b border-white/[0.08] bg-gradient-to-b from-black/55 to-black/[0.38] backdrop-blur-sm">
              <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-[4.8px] px-[7px] py-[3px] sm:gap-x-[7px] sm:px-[10px]">
                <div className="min-w-0 justify-self-start flex flex-wrap items-center gap-x-[5.4px] gap-y-0">
                  <button
                    type="button"
                    onClick={toggleChartDock}
                    className="max-w-full truncate rounded py-[2px] pl-[6px] pr-[6px] text-left transition hover:bg-white/[0.03] active:bg-white/[0.05]"
                    aria-expanded={chartDockOpen}
                    aria-label={chartDockOpen ? 'Collapse price chart' : 'Expand price chart'}
                  >
                    <span className="whitespace-nowrap">
                      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-sigflo-muted">Price chart</span>
                      <span className="ml-[5px] text-[13px] font-semibold text-white">{intervalLabel}</span>
                    </span>
                  </button>
                  {!isManageMode ? (
                    <div className="min-w-0 border-l border-white/[0.1] pl-[7px] sm:pl-[10px]">
                      <TradeStats
                        variant="strip"
                        compact
                        riskPercent={tradeDockStats.riskPercent}
                        rewardPercent={tradeDockStats.rewardPercent}
                        rrRatio={tradeDockStats.rrRatio}
                      />
                    </div>
                  ) : null}
                </div>
                <div className="flex max-w-[min(100%,17.5rem)] justify-center justify-self-center">
                  {!isManageMode ? (
                    isLiveTradeMode && primaryOpenPosition ? (
                      <PositionActionsBar
                        variant="dock"
                        onClosePosition={() => onPaperCloseOne(primaryOpenPosition.id)}
                        onCloseAll={() => setCloseAllModalOpen(true)}
                        onPartialClose={(f) => onPaperPartialClose(primaryOpenPosition.id, f)}
                      />
                    ) : (
                      <ChartInlineTradeButtons
                        variant="dock"
                        market={market}
                        canExecute={canExecute}
                        flashSide={execFlash}
                        onOpenShort={() => executeTrade('short')}
                        onOpenLong={() => executeTrade('long')}
                        signalBias={selectedSignal.side === 'short' ? 'short' : 'long'}
                        dockMeta={dockDecisionMeta}
                      />
                    )
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={toggleChartDock}
                  className={`justify-self-end flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[7px] transition hover:bg-white/[0.06] active:bg-white/[0.08] ${
                    chartDockChevronIdle
                      ? 'text-sigflo-muted hover:text-white'
                      : 'sigflo-chart-dock-chevron-btn hover:text-cyan-100'
                  }`}
                  aria-expanded={chartDockOpen}
                  aria-label={chartDockOpen ? 'Collapse price chart' : 'Expand price chart'}
                >
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    className={`text-current transition-transform duration-200 ${chartDockOpen ? 'rotate-180' : ''}`}
                    aria-hidden
                  >
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            {chartDockOpen ? (
              <TradeChartPanel
                collapsed={false}
                plotExpandedPx={TRADE_CHART_PLOT_EXPANDED_PX}
                model={chartModelForPlot}
                market={market}
                intervalLabel={intervalLabel}
                loadingInterval={live.loadingInterval}
                liveUpdatedAt={live.lastUpdateTs}
                change24hPct={mergedModel.change24hPct}
                timeframeOptions={TRADE_CHART_INTERVAL_OPTIONS}
                chartInterval={chartInterval}
                onChartIntervalChange={(v) => {
                  setChartInterval(v);
                  window.localStorage.setItem('sigflo.trade.chartInterval', v);
                }}
                exchangeStyleHero={!isManageMode}
                heroPairLabel={isManageMode ? mergedModel.pair : undefined}
                metaCaption={
                  isManageMode
                    ? undefined
                    : market === 'futures'
                      ? 'PERP · Funding +0.010%'
                      : 'Spot · No funding'
                }
                setupMode={!isManageMode ? hasOpenPosition || setupMode : undefined}
                onSetupModeToggle={
                  !isManageMode && !hasOpenPosition ? () => setSetupMode((v) => !v) : undefined
                }
                onRequestSetupMode={!isManageMode ? () => setSetupMode(true) : undefined}
                tradeTimingState={!isManageMode ? dockTimingChip.state : undefined}
                liveTradeMode={Boolean(!isManageMode && isLiveTradeMode && chartDockOpen)}
                suppressExchangeHeroLivePrice={!isManageMode}
                liveTradeOverlayPreset={Boolean(!isManageMode && hasOpenPosition)}
                auxiliaryPriceLines={!isManageMode ? chartAuxiliaryLines : undefined}
                liveHeaderMetrics={!isManageMode && chartDockOpen ? dockChartHeaderMetrics : undefined}
                liveTradeRefitKey={!isManageMode ? liveChartRefitKey : undefined}
                chartProximity={!isManageMode ? chartProximity : null}
                className="pb-2"
              />
            ) : null}

          </div>

          {isManageMode ? (
            <div className="px-2 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              <div className="mx-auto max-w-lg space-y-2">
                <button
                  type="button"
                  onClick={onClosePosition}
                  className="w-full rounded-2xl border border-rose-400/35 bg-rose-500/[0.12] py-3.5 text-base font-bold text-rose-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] transition hover:bg-rose-500/18 active:scale-[0.98]"
                >
                  Close Position
                </button>
                <button
                  type="button"
                  onClick={onAddToPosition}
                  className="w-full rounded-2xl bg-sigflo-accent py-3.5 text-base font-bold text-sigflo-bg shadow-glow transition hover:brightness-110 active:scale-[0.98]"
                >
                  Add to Position
                </button>
                <button
                  type="button"
                  onClick={onReducePosition}
                  className="w-full rounded-2xl border border-white/[0.1] bg-white/[0.04] py-3 text-sm font-semibold text-sigflo-text transition hover:bg-white/[0.07] active:scale-[0.98]"
                >
                  Reduce Position
                </button>
                <p className="text-center text-[10px] leading-relaxed text-sigflo-muted">
                  Executes on your exchange — Sigflo is your control view.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function manageStripSizeLabel(ctx: ManageTradePositionContext): string {
  const base = ctx.pair.includes('/') ? ctx.pair.split('/')[0].trim() : ctx.pair;
  if (ctx.posSize != null && Number.isFinite(ctx.posSize)) {
    return `${formatQuoteNumber(Math.abs(ctx.posSize))} ${base}`;
  }
  return `≈ $${Math.round(ctx.positionUsd).toLocaleString('en-US')} position size`;
}

function pairBaseToLinearSymbol(pair: string): string {
  const raw = pair.trim().toUpperCase();
  const base = raw.includes('/') ? raw.split('/')[0].trim() : raw.replace(/USDT$/i, '').trim();
  const clean = base.replace(/[^A-Z0-9]/g, '');
  return `${clean || 'BTC'}USDT`;
}

function buildSignalContextFromQuery(params: URLSearchParams, signalId: string): CryptoSignal | null {
  const setupScore = Number(params.get('setupScore'));
  const trend = Number(params.get('trend'));
  const momentum = Number(params.get('momentum'));
  const structure = Number(params.get('structure'));
  const volume = Number(params.get('volume'));
  const risk = Number(params.get('risk'));
  const pair = params.get('pair');
  if (!Number.isFinite(setupScore) || !Number.isFinite(trend) || !Number.isFinite(momentum)) return null;
  if (!Number.isFinite(structure) || !Number.isFinite(volume) || !Number.isFinite(risk) || !pair) return null;
  const tagsRaw = params.get('tags') ?? '';
  const tags = tagsRaw.split(',').map((t) => t.trim()).filter((t): t is SignalSetupTag => t === 'Breakout' || t === 'Pullback' || t === 'Overextended');
  const setupScoreLabel = (params.get('setupScoreLabel') ?? 'Developing') as SetupScoreLabel;
  const riskTag = (params.get('riskTag') ?? 'Medium Risk') as SignalRiskTag;
  const sideParam = (params.get('side') ?? 'long') as 'long' | 'short';
  return {
    id: signalId,
    pair,
    side: sideParam,
    biasLabel: params.get('biasLabel') ?? (sideParam === 'long' ? 'Potential Long' : 'Potential Short'),
    setupScore,
    setupScoreLabel,
    setupType: (params.get('setupType') as 'breakout' | 'pullback' | 'overextended' | null) ?? 'breakout',
    scoreBreakdown: { trendAlignment: trend, momentumQuality: momentum, structureQuality: structure, volumeConfirmation: volume, riskConditions: risk },
    riskTag,
    setupTags: tags,
    exchange: 'Bybit',
    postedAgo: 'Live',
    aiExplanation: params.get('explanation') ?? 'Setup context loaded from feed.',
    whyThisMatters: 'Loaded from selected setup context.',
    watchCue: params.get('watch')?.trim() || undefined,
    watchNext: params.get('watchNext')?.trim() || undefined,
  };
}
