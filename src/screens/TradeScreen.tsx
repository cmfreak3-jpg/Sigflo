import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SigfloLogo } from '@/components/branding/SigfloLogo';
import { AssistedExitConfirmBar } from '@/components/trade/AssistedExitConfirmBar';
import { ExitAutomationControls } from '@/components/trade/ExitAutomationControls';
import { TradeChartScenarioStrip, computeScenarioProbabilities } from '@/components/trade/TradeChartScenarioStrip';
import { MarketToggle } from '@/components/trade/MarketToggle';
import { ActivePositionsPanel } from '@/components/trade/ActivePositionsPanel';
import { CloseAllPositionsModal } from '@/components/trade/CloseAllPositionsModal';
import { ClosedPositionSummaryModal } from '@/components/trade/ClosedPositionSummaryModal';
import { ExitModePanel } from '@/components/trade/ExitModePanel';
import { LiveMarketStrip } from '@/components/trade/LiveMarketStrip';
import { PositionActionsBar } from '@/components/trade/PositionActionsBar';
import { TradeChartPanel } from '@/components/trade/TradeChartPanel';
import { ChartDockScoreGrid, ChartInlineTradeButtons } from '@/components/trade/TradeActionBar';
import { StatusChip } from '@/components/trade/StatusChip';
import { TradeControls } from '@/components/trade/TradeControls';
import { LiveIndicator } from '@/components/trade/LiveIndicator';
import { ManagePartialCloseSheet } from '@/components/trade/position/ManagePartialCloseSheet';
import { ManagePositionControlPanel } from '@/components/trade/position/ManagePositionControlPanel';
import { TradeStats } from '@/components/trade/TradeStats';
import { TRADE_CHART_PLOT_EXPANDED_PX } from '@/config/tradeChartHeights';
import { formatQuoteNumber } from '@/lib/formatQuote';
import { useExitAutomation } from '@/hooks/useExitAutomation';
import { useAccountSnapshot } from '@/hooks/useAccountSnapshot';
import { useSignalEngine } from '@/hooks/useSignalEngine';
import { useLiveTradeMarket, type TradeChartInterval } from '@/hooks/useLiveTradeMarket';
import { useThrottledLiveUnrealized } from '@/hooks/useThrottledLiveUnrealized';
import { managePnlFromPrices, parseManageTradeContext } from '@/lib/manageTradeContext';
import { buildManageTradeQueryFromLinearPosition, buildTradeQueryString } from '@/lib/tradeNavigation';
import { computePositionHealth } from '@/lib/positionHealth';
import { positionMicroInsight } from '@/lib/positionMicroInsight';
import {
  buildTrackedFallbackSignal,
  deriveMarketStatus,
  parseMarketStatusQuery,
  symbolToPair,
} from '@/lib/marketScannerRows';
import { formatElapsedAgo, postedAgoToSeconds, uiSignalStateClasses, uiSignalStateFromMarketStatus, uiSignalStateLabel } from '@/lib/signalState';
import { EXIT_AI_MODE_LABEL, EXIT_STRATEGY_LABEL } from '@/lib/aiExitAutomation';
import { TRADE_CHART_LEVEL_COLORS } from '@/lib/tradeChartLevels';
import {
  readPersistedTradeChartInterval,
  SIGFLO_CHART_INTERVAL_EVENT,
  TRADE_CHART_INTERVAL_STORAGE_KEY,
} from '@/lib/tradeChartIntervalPreference';
import {
  nextExitFlowForDisplay,
  type ExitFlowDisplayStash,
} from '@/lib/exitFlowDisplayStabilize';
import { buildExitAiCoPilotModel, buildManageAiExitZoneAuxLines } from '@/lib/exitAiCoPilot';
import { resolveExitGuidanceFlow } from '@/lib/tradeExitGuidanceFlow';
import { tradeTimingChipProps } from '@/lib/tradeTimingChip';
import { setupScoreBandShort } from '@/lib/setupScore';
import { buildClosedPositionSummary, type ClosedPositionSummary } from '@/lib/closedPositionSummary';
import { BYBIT_ASSET_TRANSFER_HREF } from '@/lib/exchangeTransferUrls';
import {
  buildTradeViewModelFromSignal,
  coerceStopTargetToSide,
  ensureStopForOpenPosition,
  ensureTargetForOpenPosition,
  resolveTradeAnchorPrice,
} from '@/lib/tradeViewFromSignal';
import { syntheticFromExchangePosition, syntheticFromSpotHolding } from '@/lib/exchangePositionSynthetic';
import { formatBybitTradeErrorMessage } from '@/lib/bybitUserFacingError';
import { formatLinearPriceStringForBybit, linearTpSlStringsForOpen } from '@/lib/bybitLinearTpSl';
import { linearQtyFromBaseAmount, linearQtyFromNotionalUsd, spotQuoteQtyFromUsd } from '@/lib/linearOrderQty';
import { spotBaseAssetFromOrderSymbol } from '@/lib/spotSymbol';
import { deriveTradeMetrics } from '@/lib/tradeRisk';
import {
  postBybitLinearOrder,
  postBybitLinearTradingStop,
  postBybitSpotOrder,
} from '@/services/api/tradeClient';
import { fetchLinearMaxLeverage } from '@/services/bybit/client';
import type { SymbolTicker } from '@/types/market';
import type { CryptoSignal, SetupScoreLabel, SignalRiskTag, SignalSetupTag } from '@/types/signal';
import type { SimulatedActivePosition } from '@/types/activePosition';
import type { ExchangeSnapshot, PositionItem } from '@/types/integrations';
import type { MarketMode, TradeSide } from '@/types/trade';

/** Matches `App.tsx` `FEED_ROUTE` — feed is `/feed` at site root, `/` when hosted under a subpath. */
const FEED_PATH = import.meta.env.BASE_URL !== '/' ? '/' : '/feed';

const TRADE_PAIR_PICKER_FALLBACKS: CryptoSignal[] = [
  buildTrackedFallbackSignal('BTC', 'BTCUSDT'),
  buildTrackedFallbackSignal('ETH', 'ETHUSDT'),
  buildTrackedFallbackSignal('SOL', 'SOLUSDT'),
];

function roundUsdAmount(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Fresh snapshot after an order — pick the open leg for TP/SL sync (hedge-safe `positionIdx`). */
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
  { value: '1', label: '1m' },
  { value: '5', label: '5m' },
  { value: '15', label: '15m' },
  { value: '60', label: '1H' },
  { value: '240', label: '4H' },
  { value: 'D', label: '1D' },
  { value: 'W', label: '1W' },
];

/**
 * Beta fallback minimum notional when per-symbol exchange rules are not wired yet.
 * Keep this low so small-balance users can still validate flows.
 */
const BETA_FALLBACK_MIN_ORDER_USD = 5;

/**
 * Optional symbol-specific overrides (USD notional). Add real exchange metadata when available.
 */
const SYMBOL_MIN_NOTIONAL_USD: Record<string, number> = {
  BTCUSDT: 5,
  ETHUSDT: 5,
};

function resolveMinOrderUsd(symbol: string, _market: MarketMode): number {
  const s = symbol.toUpperCase();
  return SYMBOL_MIN_NOTIONAL_USD[s] ?? BETA_FALLBACK_MIN_ORDER_USD;
}

function pairBaseToLinearSymbol(pair: string): string {
  const raw = pair.trim().toUpperCase();
  const base = raw.includes('/') ? raw.split('/')[0].trim() : raw.replace(/USDT$/i, '').trim();
  const clean = base.replace(/[^A-Z0-9]/g, '');
  return `${clean || 'BTC'}USDT`;
}

/** Linked Bybit overview subset — used for UTA sizing vs display (must stay in sync). */
type TradeBalanceOverview = {
  availableToTrade: number | null;
  totalWalletBalance: number | null;
};

/**
 * Cap for amount slider / validation when the exchange is linked. Bybit often reports
 * `availableToTrade === 0` while `totalWalletBalance` still reflects equity you see in the app;
 * using only the former makes `amountMax` 0 and triggers "Insufficient available balance".
 */
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

/** API JSON sometimes returns numeric strings; `Number.isFinite("16.91")` is false and breaks sizing. */
function coerceUsdField(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Display label for signal `pair` in the live strip ticker (matches chart pair style when possible). */
function formatSignalPairForTicker(pair: string): string {
  const p = pair.trim();
  if (p.includes('/')) return p;
  const base = p.replace(/USDT$/i, '').replace(/[^a-zA-Z0-9]/g, '');
  return `${base || '—'} / USDT`;
}

export function TradeScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const signalId = params.get('signal') ?? 'sig-1';
  const [market, setMarket] = useState<MarketMode>('futures');
  const [chartInterval, setChartInterval] = useState<TradeChartInterval>(readPersistedTradeChartInterval);
  const [amountUsd, setAmountUsd] = useState<number>(0);
  const [leverage, setLeverage] = useState<number>(8);
  /** Bybit linear `instruments-info` max leverage for the active symbol (futures only). */
  const [symbolMaxLeverage, setSymbolMaxLeverage] = useState<number | null>(null);
  const [side, setSide] = useState<TradeSide>('long');
  const [stopStr, setStopStr] = useState('');
  const [targetStr, setTargetStr] = useState('');
  const [tradeToast, setTradeToast] = useState<string | null>(null);
  const toastClearRef = useRef<number>(0);
  const [execFlash, setExecFlash] = useState<'long' | 'short' | null>(null);
  const execFlashClearRef = useRef<number>(0);
  /** Price chart dock always mounts collapsed; preference is not persisted across visits. */
  const [chartDockOpen, setChartDockOpen] = useState(false);
  const [managePartialSheetOpen, setManagePartialSheetOpen] = useState(false);
  const [managePartialFraction, setManagePartialFraction] = useState(0.25);
  /** After user toggles the chart dock (title or chevron), drop the chevron glow/pulse. */
  const [chartDockChevronIdle, setChartDockChevronIdle] = useState(false);
  /** Header pair chevron: pick another tracked setup / watchlist symbol. */
  const [tradePairMenuOpen, setTradePairMenuOpen] = useState(false);
  const tradePairMenuRef = useRef<HTMLDivElement>(null);
  /** Clean = no trade overlays; Setup = entry / stop / target (and liq on perps). */
  const [setupMode, setSetupMode] = useState(false);
  const [orderPending, setOrderPending] = useState<'open' | 'close' | 'tpsl' | null>(null);
  const [manageTpSlDirty, setManageTpSlDirty] = useState(false);
  const [closeAllModalOpen, setCloseAllModalOpen] = useState(false);
  const [closedPositionSummary, setClosedPositionSummary] = useState<ClosedPositionSummary | null>(null);
  const [tick, setTick] = useState(0);
  const appliedPortfolioDefaults = useRef<string | null>(null);
  /** One-time seed for amount from balance cap (avoid default $1200 → 100% on small UTA). */
  const amountFromCapSeededRef = useRef(false);
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

  useEffect(() => {
    if (isManageMode) setChartDockOpen(true);
  }, [isManageMode]);

  const { signals: liveSignals, liveTickersBySymbol } = useSignalEngine();

  const selectedSignal = useMemo(() => {
    const fromQuery = buildSignalContextFromQuery(params, signalId);
    if (fromQuery) return fromQuery;
    const direct = liveSignals.find((s) => s.id === signalId);
    if (direct) return direct;
    const legacy = resolveShellSignalForLegacyId(signalId, liveSignals);
    if (legacy) return legacy;
    if (liveSignals.length > 0) return liveSignals[0];
    return buildTrackedFallbackSignal('BTC', 'BTCUSDT');
  }, [params, signalId, liveSignals]);

  /** Prefer live engine signal that matches `?pair=` so levels align with that asset. */
  const signalForTrade = useMemo(() => {
    const raw = pairFromQuery?.trim();
    if (raw) {
      const sym = pairBaseToLinearSymbol(raw);
      const pair = symbolToPair(sym);
      const fromLive = liveSignals.find(
        (s) => s.pair.trim().toUpperCase() === pair || s.pair.trim().toUpperCase() === raw.toUpperCase().replace(/\s+/g, ''),
      );
      if (fromLive) return fromLive;
      return buildTrackedFallbackSignal(pair, sym);
    }
    return selectedSignal;
  }, [pairFromQuery, selectedSignal, liveSignals]);

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
      setAmountUsd(roundUsdAmount(Math.min(Math.max(pu, 0.01), 1_000_000)));
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

  const liveSymbol = useMemo(() => {
    if (pairFromQuery?.trim()) return pairBaseToLinearSymbol(pairFromQuery);
    return pairBaseToLinearSymbol(selectedSignal.pair);
  }, [pairFromQuery, selectedSignal.pair]);

  const tradePairPickerSignals = useMemo(() => {
    const source = liveSignals.length > 0 ? liveSignals : TRADE_PAIR_PICKER_FALLBACKS;
    const bySym = new Map<string, CryptoSignal>();
    for (const s of source) {
      const sym = pairBaseToLinearSymbol(s.pair);
      const prev = bySym.get(sym);
      if (!prev || s.setupScore > prev.setupScore) bySym.set(sym, s);
    }
    return [...bySym.values()].sort(
      (a, b) =>
        b.setupScore - a.setupScore ||
        formatSignalPairForTicker(a.pair).localeCompare(formatSignalPairForTicker(b.pair)),
    );
  }, [liveSignals]);

  const live = useLiveTradeMarket(liveSymbol, chartInterval);
  const { items: accountSnapshots, refresh: refreshAccountSnapshots } = useAccountSnapshot({ pollMs: 12_000 });

  const liveMarketTickerItems = useMemo(
    () =>
      liveSignals.map((s) => {
        const sym = pairBaseToLinearSymbol(s.pair);
        const t = liveTickersBySymbol[sym];
        return {
          pair: formatSignalPairForTicker(s.pair),
          lastPrice: t != null && Number.isFinite(t.lastPrice) ? t.lastPrice : null,
          movePct: t != null && Number.isFinite(t.price24hPcnt) ? t.price24hPcnt * 100 : null,
        };
      }),
    [liveSignals, liveTickersBySymbol],
  );

  const tradeBalance = useMemo(() => {
    const bybit = accountSnapshots.find((s) => s.exchange === 'bybit' && s.status === 'connected');
    const overview = bybit?.accountBreakdown?.overview;
    if (!overview) return null;
    const unifiedBucket = bybit.accountBreakdown?.buckets?.find((b) => b.kind === 'unified');
    const utaUnrealizedPnl = unifiedBucket?.metrics?.unrealizedPnl;
    return {
      availableToTrade: coerceUsdField(overview.availableToTrade),
      totalWalletBalance: coerceUsdField(overview.totalWalletBalance),
      totalEquity: coerceUsdField(overview.totalEquity),
      marginInUseUsd: coerceUsdField(overview.unifiedMarginInUseUsd ?? null),
      utaUnrealizedPnl: utaUnrealizedPnl != null ? coerceUsdField(utaUnrealizedPnl) : null,
      fundingWalletBalance: coerceUsdField(overview.fundingWalletBalance ?? null),
      fundingPrimaryAsset: overview.fundingPrimaryAsset ?? null,
    };
  }, [accountSnapshots]);

  const tradeBalanceHelper = useMemo(() => {
    if (!tradeBalance) return undefined;
    if (market === 'futures') {
      return 'Bybit UTA metrics above sync from your account. With perps + Bybit connected, Long/Short and Close send real orders; read-only API keys cannot trade.';
    }
    return 'Bybit UTA metrics sync from your account. With spot + Bybit connected, Buy/Sell and Close send real spot orders; read-only API keys cannot trade.';
  }, [tradeBalance, market]);

  /**
   * Single raw cap for linked UTA: max of sizing + display paths (they can diverge on edge API shapes).
   * Rounded to cents everywhere so 100% === validation cap (avoids float / rounding mismatches).
   */
  const linkedUtaRawMaxUsd = useMemo(() => {
    if (!tradeBalance) return null;
    const raw = Math.max(utaSizingCapUsd(tradeBalance), utaBalanceDisplayUsd(tradeBalance));
    if (!Number.isFinite(raw)) return null;
    return Math.max(0, raw);
  }, [tradeBalance]);

  const displayBalanceUsd = useMemo((): number | null => {
    if (linkedUtaRawMaxUsd == null) return null;
    return roundUsdAmount(linkedUtaRawMaxUsd);
  }, [linkedUtaRawMaxUsd]);

  const balanceForModel = useMemo(() => {
    if (!tradeBalance) return 0;
    if (linkedUtaRawMaxUsd != null && linkedUtaRawMaxUsd > 0) {
      return roundUsdAmount(linkedUtaRawMaxUsd);
    }
    return 0;
  }, [tradeBalance, linkedUtaRawMaxUsd]);

  const [tradePriceAnchor, setTradePriceAnchor] = useState<number | null>(null);
  useEffect(() => {
    setTradePriceAnchor(null);
  }, [signalId, pairFromQuery, liveSymbol]);

  useEffect(() => {
    if (tradePriceAnchor != null) return;
    if (live.lastPrice != null && Number.isFinite(live.lastPrice) && live.lastPrice > 0) {
      setTradePriceAnchor(live.lastPrice);
    }
  }, [live.lastPrice, tradePriceAnchor]);

  const model = useMemo(() => {
    const anchorPx = resolveTradeAnchorPrice(tradePriceAnchor, live.lastPrice, signalForTrade.pair);
    return buildTradeViewModelFromSignal(
      signalForTrade,
      {
        lastPrice: live.lastPrice,
        change24hPct: live.change24hPct,
        high24h: live.high24h,
        low24h: live.low24h,
        volume24h: live.volume24h,
        priceSeries: live.priceSeries,
        chartCandles: live.chartCandles,
      },
      { anchorPrice: anchorPx, balanceUsd: balanceForModel, tradeSide: side },
    );
  }, [
    balanceForModel,
    signalForTrade,
    side,
    tradePriceAnchor,
    live.change24hPct,
    live.high24h,
    live.low24h,
    live.volume24h,
    live.priceSeries,
    live.chartCandles,
    live.lastPrice,
  ]);

  const assetTransferHref = useMemo(() => {
    const bybit = accountSnapshots.find((s) => s.exchange === 'bybit' && s.status === 'connected');
    return bybit ? BYBIT_ASSET_TRANSFER_HREF : null;
  }, [accountSnapshots]);

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
    if (market !== 'futures') {
      setSymbolMaxLeverage(null);
      return;
    }
    const sym = pairBaseToLinearSymbol(mergedModel.pair);
    let cancelled = false;
    void fetchLinearMaxLeverage(sym).then((m) => {
      if (!cancelled) setSymbolMaxLeverage(m);
    });
    return () => {
      cancelled = true;
    };
  }, [market, mergedModel.pair]);

  const bybitSnap = useMemo(
    () => accountSnapshots.find((s) => s.exchange === 'bybit' && s.status === 'connected'),
    [accountSnapshots],
  );
  /** Manage mode still posts closes/adds via `/trade/bybit/*` when Bybit is linked — only entry-mode chart shell differed before. */
  const useRealExecution = Boolean(bybitSnap && (market === 'futures' || market === 'spot'));
  const exchangePositionForSymbol = useMemo((): PositionItem | null => {
    if (!bybitSnap?.positions?.length) return null;
    const sym = pairBaseToLinearSymbol(mergedModel.pair);
    const open = bybitSnap.positions.filter((x) => x.symbol === sym && x.size > 0);
    if (open.length === 0) return null;
    /** Hedge mode: same symbol can have long + short; managing uses URL leg, else UI `side`. */
    const legSide = isManageMode && manageCtx ? manageCtx.side : side;
    return open.find((x) => x.side === legSide) ?? open[0];
  }, [bybitSnap, isManageMode, manageCtx, mergedModel.pair, side]);

  const spotBaseAsset = useMemo(
    () => spotBaseAssetFromOrderSymbol(pairBaseToLinearSymbol(mergedModel.pair)),
    [mergedModel.pair],
  );
  const exchangeSpotFreeBaseQty = useMemo(() => {
    if (!bybitSnap?.balances?.length) return null;
    const want = spotBaseAsset.toUpperCase();
    const row = bybitSnap.balances.find((b) => b.asset.toUpperCase() === want);
    if (!row || !Number.isFinite(row.free) || row.free <= 0) return null;
    return row.free;
  }, [bybitSnap, spotBaseAsset]);

  /** Sync SL/TP fields when computed plan changes, not only on pair (avoids stale stop after anchor moves from fallback to live). */
  useEffect(() => {
    if (isManageMode) return;
    setStopStr(String(mergedModel.stop));
    setTargetStr(String(mergedModel.target));
  }, [isManageMode, mergedModel.pair, mergedModel.stop, mergedModel.target]);

  useEffect(() => {
    if (!isManageMode) setManageTpSlDirty(false);
  }, [isManageMode]);

  const stopParsed = parseFloat(stopStr.replace(/,/g, ''));
  const targetParsed = parseFloat(targetStr.replace(/,/g, ''));

  /** Manage + linear: keep SL/TP inputs aligned with the exchange until the user edits (then sync again after a successful apply). */
  useEffect(() => {
    if (!isManageMode || market !== 'futures' || manageTpSlDirty) return;
    const pos = exchangePositionForSymbol;
    if (!pos) return;
    setStopStr(
      pos.stopLossPrice != null && Number.isFinite(pos.stopLossPrice) && pos.stopLossPrice > 0
        ? formatQuoteNumber(pos.stopLossPrice)
        : '',
    );
    setTargetStr(
      pos.takeProfitPrice != null && Number.isFinite(pos.takeProfitPrice) && pos.takeProfitPrice > 0
        ? formatQuoteNumber(pos.takeProfitPrice)
        : '',
    );
  }, [
    exchangePositionForSymbol,
    isManageMode,
    manageTpSlDirty,
    market,
  ]);

  const modelForMetrics = useMemo(() => {
    const next = { ...mergedModel };
    if (Number.isFinite(stopParsed) && stopParsed > 0) next.stop = stopParsed;
    if (Number.isFinite(targetParsed) && targetParsed > 0) next.target = targetParsed;
    if (tradeBalance && linkedUtaRawMaxUsd != null && linkedUtaRawMaxUsd > 0) {
      next.balanceUsd = roundUsdAmount(linkedUtaRawMaxUsd);
    }
    if (!Number.isFinite(next.balanceUsd) || next.balanceUsd < 0) {
      const fb = mergedModel.balanceUsd;
      next.balanceUsd = Number.isFinite(fb) && fb > 0 ? fb : 0;
    }
    return next;
  }, [mergedModel, stopParsed, targetParsed, tradeBalance, linkedUtaRawMaxUsd]);

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

  const futuresLevCap = market === 'futures' ? (symbolMaxLeverage ?? 200) : 200;
  const effectiveFuturesLeverage = Math.min(leverage, futuresLevCap);
  const levForMetrics = market === 'spot' ? 1 : effectiveFuturesLeverage;

  useEffect(() => {
    if (market !== 'futures') return;
    if (leverage > futuresLevCap) setLeverage(futuresLevCap);
  }, [futuresLevCap, leverage, market]);

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

  const primaryOpenPosition = useMemo((): SimulatedActivePosition | null => {
    if (isManageMode) return null;
    const linearSym = pairBaseToLinearSymbol(mergedModel.pair);
    const mark =
      Number.isFinite(mergedModel.lastPrice) && mergedModel.lastPrice > 0
        ? mergedModel.lastPrice
        : live.lastPrice != null && Number.isFinite(live.lastPrice) && live.lastPrice > 0
          ? live.lastPrice
          : NaN;
    if (useRealExecution && market === 'futures' && exchangePositionForSymbol) {
      return syntheticFromExchangePosition(
        exchangePositionForSymbol,
        mergedModel.pair,
        market,
        effectiveFuturesLeverage,
      );
    }
    if (
      useRealExecution &&
      market === 'spot' &&
      exchangeSpotFreeBaseQty != null &&
      exchangeSpotFreeBaseQty > 0 &&
      Number.isFinite(mark) &&
      mark > 0
    ) {
      return syntheticFromSpotHolding(exchangeSpotFreeBaseQty, linearSym, mergedModel.pair, mark);
    }
    return null;
  }, [
    exchangePositionForSymbol,
    exchangeSpotFreeBaseQty,
    isManageMode,
    effectiveFuturesLeverage,
    live.lastPrice,
    market,
    mergedModel.lastPrice,
    mergedModel.pair,
    useRealExecution,
  ]);

  /**
   * `primaryOpenPosition` is null in `mode=manage`, but the chart should still show the same
   * exchange-backed entry / SL / TP / liq lines as the live trade view when Bybit is connected.
   */
  const exchangeSyntheticForManageChart = useMemo((): SimulatedActivePosition | null => {
    if (!isManageMode || market !== 'futures' || !exchangePositionForSymbol) return null;
    if (!bybitSnap || bybitSnap.status !== 'connected') return null;
    return syntheticFromExchangePosition(
      exchangePositionForSymbol,
      mergedModel.pair,
      market,
      effectiveFuturesLeverage,
    );
  }, [
    bybitSnap,
    effectiveFuturesLeverage,
    exchangePositionForSymbol,
    isManageMode,
    market,
    mergedModel.pair,
  ]);

  /** Manage screen: show exchange leverage when synced, else URL (portfolio link), else trade slider. */
  const manageLeverageForUi = useMemo(() => {
    if (!isManageMode) return 1;
    if (market !== 'futures') return 1;
    if (exchangeSyntheticForManageChart != null) return exchangeSyntheticForManageChart.leverage;
    const fromUrl = manageCtx?.leverage;
    if (fromUrl != null && fromUrl > 0) return fromUrl;
    return effectiveFuturesLeverage;
  }, [
    effectiveFuturesLeverage,
    exchangeSyntheticForManageChart,
    isManageMode,
    manageCtx?.leverage,
    market,
  ]);

  const exchangeSpotPanelModel = useMemo(() => {
    if (!useRealExecution || market !== 'spot') return null;
    const p = primaryOpenPosition;
    return p != null && p.id.startsWith('bybit-spot:') ? p : null;
  }, [useRealExecution, market, primaryOpenPosition]);
  const hasActiveTradePosition = !isManageMode && primaryOpenPosition != null;

  /** Chart overlays: liquidation tracks sizing inputs (`deriveTradeMetrics`), not a fixed placeholder liq. */
  const chartModelForPlot = useMemo(() => {
    const next = { ...modelForMetrics };
    if (market === 'futures' && Number.isFinite(metrics.liquidation) && metrics.liquidation > 0) {
      next.liquidation = metrics.liquidation;
    }
    const pos = primaryOpenPosition ?? exchangeSyntheticForManageChart;
    if (pos) {
      next.entry = pos.entryPrice;
      if (pos.stopLossPrice != null && Number.isFinite(pos.stopLossPrice) && pos.stopLossPrice > 0) {
        next.stop = pos.stopLossPrice;
      } else {
        next.stop = ensureStopForOpenPosition(
          pos.side,
          pos.entryPrice,
          modelForMetrics.stop,
          selectedSignal.setupScore,
        );
      }
      if (pos.takeProfitPrice != null && Number.isFinite(pos.takeProfitPrice) && pos.takeProfitPrice > 0) {
        next.target = pos.takeProfitPrice;
      } else {
        next.target = ensureTargetForOpenPosition(
          pos.side,
          pos.entryPrice,
          modelForMetrics.target,
          selectedSignal.setupScore,
        );
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
    // Open position: exchange SL/TP win when present; otherwise `ensure*` aligns plan levels to `pos.side`
    // (UI long/short can differ from the exchange leg). Do not run full `coerceStopTargetToSide` when
    // exchange sent one leg — that helper replaces both levels and could drop a valid Bybit price.
    if (
      !pos &&
      Number.isFinite(next.entry) &&
      next.entry > 0 &&
      Number.isFinite(next.stop) &&
      next.stop > 0 &&
      Number.isFinite(next.target) &&
      next.target > 0
    ) {
      const c = coerceStopTargetToSide(side, next.entry, next.stop, next.target, selectedSignal.setupScore);
      next.stop = c.stop;
      next.target = c.target;
    }
    return next;
  }, [
    exchangeSyntheticForManageChart,
    isManageMode,
    market,
    metrics.liquidation,
    modelForMetrics,
    primaryOpenPosition,
    selectedSignal.setupScore,
    side,
  ]);

  /** Pre-entry / plan PnL from throttled React `lastPrice` (scenario strip). */
  const liveUnrealizedPre = useMemo(() => {
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

  const throttledOpenPnl = useThrottledLiveUnrealized(live.lastPriceRef, primaryOpenPosition, hasActiveTradePosition);

  const liveUnrealized = hasActiveTradePosition
    ? { pnlUsd: throttledOpenPnl.pnlUsd, movePct: throttledOpenPnl.movePct }
    : liveUnrealizedPre;

  /** Round-trip taker fee heuristic (~0.055% per side). */
  const estFeeUsd = metrics.positionSizeUsd * 0.00055 * 2;
  const orderSymbol = pairBaseToLinearSymbol(mergedModel.pair);
  const minOrderUsd = resolveMinOrderUsd(orderSymbol, market);
  const sizingValidation = useMemo(() => {
    if (orderPending) {
      return { canExecute: false, reason: 'Order in progress…' };
    }
    const available = Number.isFinite(metrics.balanceUsd) ? Math.max(0, metrics.balanceUsd) : 0;
    const availCents = Math.round(available * 100);
    const amtCents = Math.round((Number.isFinite(amountUsd) ? amountUsd : 0) * 100);
    if (available <= 0) {
      return { canExecute: false, reason: 'Insufficient available balance' };
    }
    if (available < minOrderUsd) {
      return { canExecute: false, reason: 'Insufficient available balance' };
    }
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      return { canExecute: false, reason: `Minimum order for ${orderSymbol} is $${minOrderUsd.toFixed(2)}` };
    }
    if (amtCents > availCents) {
      return { canExecute: false, reason: 'Insufficient available balance' };
    }
    if (amountUsd < minOrderUsd) {
      return { canExecute: false, reason: `Minimum order for ${orderSymbol} is $${minOrderUsd.toFixed(2)}` };
    }
    if (!Number.isFinite(metrics.positionSizeUsd) || metrics.positionSizeUsd <= 0) {
      return { canExecute: false, reason: 'Insufficient available balance' };
    }
    return { canExecute: true, reason: null as string | null };
  }, [amountUsd, metrics.balanceUsd, metrics.positionSizeUsd, minOrderUsd, orderSymbol, orderPending]);
  const canExecute = sizingValidation.canExecute;

  const onAmountUsdChange = useCallback(
    (n: number) => {
      const cap = Number.isFinite(metrics.balanceUsd) ? Math.max(0, metrics.balanceUsd) : 0;
      setAmountUsd(roundUsdAmount(Math.max(0, Math.min(Number.isFinite(n) ? n : 0, cap))));
    },
    [metrics.balanceUsd],
  );

  const onStopStrForTrade = useCallback(
    (s: string) => {
      if (isManageMode && market === 'futures') setManageTpSlDirty(true);
      setStopStr(s);
    },
    [isManageMode, market],
  );

  const onTargetStrForTrade = useCallback(
    (s: string) => {
      if (isManageMode && market === 'futures') setManageTpSlDirty(true);
      setTargetStr(s);
    },
    [isManageMode, market],
  );

  const linkedUta = tradeBalance != null;

  useEffect(() => {
    amountFromCapSeededRef.current = false;
  }, [signalId, pairFromQuery, linkedUta]);

  useEffect(() => {
    const cap = Number.isFinite(metrics.balanceUsd) ? Math.max(0, metrics.balanceUsd) : 0;
    const sym = pairBaseToLinearSymbol(mergedModel.pair);
    const minO = resolveMinOrderUsd(sym, market);
    const fromPortfolio = signalId.startsWith('pf-');

    if (!fromPortfolio && cap > 0 && !amountFromCapSeededRef.current) {
      amountFromCapSeededRef.current = true;
      const quarter = cap * 0.25;
      const target = linkedUta
        ? roundUsdAmount(Math.min(cap, Math.max(minO, quarter)))
        : roundUsdAmount(Math.min(1200, Math.max(minO, quarter)));
      setAmountUsd(target);
      return;
    }

    setAmountUsd((prev) => {
      const next = roundUsdAmount(Math.max(0, Math.min(prev, cap)));
      return next === prev ? prev : next;
    });
  }, [metrics.balanceUsd, mergedModel.pair, market, signalId, linkedUta]);

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
  const exitFlowScopeRef = useRef(exitAutomationScopeKey);
  const exitFlowDisplayStashRef = useRef<ExitFlowDisplayStash | null>(null);
  const [exitFlowDisplayTick, setExitFlowDisplayTick] = useState(0);
  /** User tapped Confirm — hide assisted bar until exit guidance returns to hold (fresh prompt next cycle). */
  const [assistedExitAcknowledged, setAssistedExitAcknowledged] = useState(false);
  /** Raw state is hold but UI still shows trim/exit (stabilizer / threshold chatter) — auto-clear the bar after a beat. */
  const [assistedExitBarForceHidden, setAssistedExitBarForceHidden] = useState(false);

  useEffect(() => {
    loggedModeRef.current = null;
    loggedStratRef.current = null;
    prevEffStateRef.current = null;
    prevAutoStateRef.current = null;
    prevPnlForSafeguardRef.current = null;
    exitFlowDisplayStashRef.current = null;
    setAssistedExitAcknowledged(false);
    setAssistedExitBarForceHidden(false);
  }, [exitAutomationScopeKey]);

  const exitFlowRaw = useMemo(() => {
    if (exitFlowScopeRef.current !== exitAutomationScopeKey) {
      exitFlowDisplayStashRef.current = null;
      exitFlowScopeRef.current = exitAutomationScopeKey;
    }
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
        customStrategyThresholds: exitAuto.customStrategyThresholds,
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
      customStrategyThresholds: exitAuto.customStrategyThresholds,
      safeguards: exitAuto.safeguards,
      exitAiMode: exitAuto.mode,
    });
  }, [
    exitAutomationScopeKey,
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
    exitAuto.customStrategyThresholds,
    exitAuto.safeguards,
  ]);

  const exitFlow = useMemo(() => {
    if (exitFlowRaw == null) {
      exitFlowDisplayStashRef.current = null;
      return null;
    }
    const stash = nextExitFlowForDisplay(
      exitFlowDisplayStashRef.current,
      exitFlowRaw,
      Date.now(),
    );
    exitFlowDisplayStashRef.current = stash;
    return stash.displayed;
  }, [exitFlowRaw, exitFlowDisplayTick]);

  useEffect(() => {
    const until = exitFlowDisplayStashRef.current?.pendingHoldUntil;
    if (until == null) return;
    const ms = Math.max(0, until - Date.now()) + 1;
    const id = window.setTimeout(() => setExitFlowDisplayTick((n) => n + 1), ms);
    return () => window.clearTimeout(id);
  }, [exitFlowRaw, exitFlowDisplayTick]);

  useEffect(() => {
    if (exitFlow?.effective.state === 'hold') {
      setAssistedExitAcknowledged(false);
      setAssistedExitBarForceHidden(false);
    }
  }, [exitFlow?.effective.state]);

  useEffect(() => {
    const rs = exitFlowRaw?.effective.state;
    if (rs === 'trim' || rs === 'exit') {
      setAssistedExitBarForceHidden(false);
    }
  }, [exitFlowRaw?.effective.state]);

  const exitFlowDispState = exitFlow?.effective.state;
  const exitFlowRawState = exitFlowRaw?.effective.state;

  useEffect(() => {
    if (exitAuto.mode !== 'assisted') {
      setAssistedExitBarForceHidden(false);
      return;
    }
    if (exitFlowDispState !== 'trim' && exitFlowDispState !== 'exit') {
      setAssistedExitBarForceHidden(false);
      return;
    }
    if (exitFlowRawState !== 'hold') {
      setAssistedExitBarForceHidden(false);
      return;
    }
    const id = window.setTimeout(() => setAssistedExitBarForceHidden(true), 2800);
    return () => window.clearTimeout(id);
  }, [exitAuto.mode, exitFlowDispState, exitFlowRawState]);

  const chartAuxiliaryLines = useMemo(() => {
    if (!hasActiveTradePosition || !exitFlow) return undefined;
    if (exitFlow.effective.state !== 'trim') return undefined;
    const e = chartModelForPlot.entry;
    const t = chartModelForPlot.target;
    if (!Number.isFinite(e) || !Number.isFinite(t) || e <= 0 || t <= 0) return undefined;
    const mid = e + (t - e) * 0.55;
    if (!Number.isFinite(mid) || mid <= 0) return undefined;
    return [{ id: 'trim-sig', price: mid, color: TRADE_CHART_LEVEL_COLORS.trim, title: 'Trim' }];
  }, [chartModelForPlot.entry, chartModelForPlot.target, exitFlow, hasActiveTradePosition]);

  const chartProximity = useMemo((): 'stop' | 'target' | null => {
    if (!hasActiveTradePosition) return null;
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
  }, [chartModelForPlot.stop, chartModelForPlot.target, hasActiveTradePosition, mergedModel.lastPrice]);

  const manageAiChartAux = useMemo(() => {
    if (!isManageMode || !manageCtx) return undefined;
    const mark =
      typeof markForManage === 'number' && Number.isFinite(markForManage) ? markForManage : mergedModel.entry;
    return buildManageAiExitZoneAuxLines({
      mode: exitAuto.mode,
      side: manageCtx.side,
      entry: chartModelForPlot.entry,
      target: chartModelForPlot.target,
      stop: chartModelForPlot.stop,
      mark,
      referencePrice: exitFlow?.effective.referencePrice,
    });
  }, [
    chartModelForPlot.entry,
    chartModelForPlot.target,
    chartModelForPlot.stop,
    exitAuto.mode,
    exitFlow?.effective.referencePrice,
    isManageMode,
    manageCtx,
    markForManage,
    mergedModel.entry,
  ]);

  const managePositionHealth = useMemo(() => {
    if (!isManageMode || !manageCtx || !managePnlDisplay) {
      return { status: 'healthy' as const, label: 'Healthy' };
    }
    const m =
      typeof markForManage === 'number' && Number.isFinite(markForManage) && markForManage > 0
        ? markForManage
        : mergedModel.lastPrice;
    return computePositionHealth({
      side: manageCtx.side,
      mark: m,
      stop: chartModelForPlot.stop,
      pnlPct: managePnlDisplay.pnlPct,
      momentumQuality: selectedSignal.scoreBreakdown.momentumQuality,
      structureQuality: selectedSignal.scoreBreakdown.structureQuality,
    });
  }, [
    chartModelForPlot.stop,
    isManageMode,
    manageCtx,
    managePnlDisplay,
    markForManage,
    mergedModel.lastPrice,
    selectedSignal.scoreBreakdown.momentumQuality,
    selectedSignal.scoreBreakdown.structureQuality,
  ]);

  const manageTimelineLines = useMemo(() => {
    if (!isManageMode || !manageCtx) return [];
    const lines: string[] = [];
    lines.push(`Entered ${manageCtx.side} at ${formatQuoteNumber(manageCtx.entryPrice)}`);
    const recent = exitAuto.activity.slice(-4);
    for (const a of recent) {
      lines.push(a.message);
    }
    return lines.slice(0, 5);
  }, [exitAuto.activity, isManageMode, manageCtx]);

  /** Omit dock open/closed — refitting on layout toggle wiped pan/zoom after the user dragged the chart. */
  const liveChartRefitKey =
    hasActiveTradePosition && primaryOpenPosition
      ? `${mergedModel.pair}|${primaryOpenPosition.id}`
      : undefined;

  /** Chart dock header (under `LiveMarketStrip`): R / T / R:R + setup tier or live exit-state badge — not last price. */
  const dockChartHeaderMetrics = useMemo(() => {
    const setupBand = setupScoreBandShort(selectedSignal);
    const setupBadge = setupBand === 'Developing' ? 'Building' : setupBand;
    let badge: string | undefined = setupBadge;
    if (hasActiveTradePosition && exitFlow) {
      const st = exitFlow.effective.state;
      badge = st === 'trim' ? 'TRIM' : st === 'exit' ? 'EXIT' : setupBadge;
    }
    const pnlOk = hasActiveTradePosition && Number.isFinite(liveUnrealized.pnlUsd);
    const pnl = pnlOk ? liveUnrealized.pnlUsd : 0;
    const secondaryLine = pnlOk
      ? `uPnL ${pnl >= 0 ? '+' : '−'}$${formatQuoteNumber(Math.abs(pnl))}`
      : undefined;
    const secondaryLineTone: 'positive' | 'negative' | 'neutral' | undefined = pnlOk
      ? pnl > 0
        ? 'positive'
        : pnl < 0
          ? 'negative'
          : 'neutral'
      : undefined;
    return {
      riskPercent: tradeDockStats.riskPercent,
      rewardPercent: tradeDockStats.rewardPercent,
      rrRatio: tradeDockStats.rrRatio,
      badge,
      secondaryLine,
      secondaryLineTone,
    };
  }, [
    exitFlow,
    hasActiveTradePosition,
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

  /** Assisted confirm applies to a real open leg only — not hypothetical pre-entry guidance after close/liq. */
  const showAssistedExitConfirmBar =
    exitAuto.mode === 'assisted' &&
    !assistedExitAcknowledged &&
    !assistedExitBarForceHidden &&
    exitFlow != null &&
    (exitFlow.effective.state === 'trim' || exitFlow.effective.state === 'exit') &&
    (isManageMode ? exchangePositionForSymbol != null && manageCtx != null : hasActiveTradePosition);

  const manageExitAiCoPilot = useMemo(
    () =>
      buildExitAiCoPilotModel({
        mode: exitAuto.mode,
        flow: exitFlow,
        nextPlanned: exitFlow?.nextPlanned ?? 'Automation watching trend and risk.',
        safeguards: exitAuto.safeguards,
        assistedPromptVisible: showAssistedExitConfirmBar,
        orderExitInFlight: orderPending === 'close',
        stop: chartModelForPlot.stop,
        target: chartModelForPlot.target,
        contextLine: manageInsightLine,
      }),
    [
      chartModelForPlot.stop,
      chartModelForPlot.target,
      exitAuto.mode,
      exitAuto.safeguards,
      exitFlow,
      manageInsightLine,
      orderPending,
      showAssistedExitConfirmBar,
    ],
  );

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
      const message =
        s === 'hold'
          ? 'Held position — readout returned to neutral'
          : s === 'trim'
            ? 'Considering partial scale-out near plan target'
            : 'Favoring a protective exit near invalidation';
      exitAuto.pushActivity({
        kind: 'exit_state',
        message,
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

  const flashTradeToast = useCallback((message: string, durationMs = 2600) => {
    setTradeToast(message);
    window.clearTimeout(toastClearRef.current);
    toastClearRef.current = window.setTimeout(() => setTradeToast(null), durationMs);
  }, []);

  const submitExchangeClose = useCallback(
    async (
      args:
        | { kind: 'linear'; pos: PositionItem; fraction: number }
        | { kind: 'spot'; symbol: string; freeBase: number; fraction: number },
    ) => {
      setOrderPending('close');
      const fraction = args.fraction;
      try {
        if (args.kind === 'spot') {
          const qtyBase = args.freeBase * Math.min(1, Math.max(0, fraction));
          if (!(qtyBase > 0)) {
            flashTradeToast('No spot balance to sell for this pair.');
            return;
          }
          const qtyStr = linearQtyFromBaseAmount(qtyBase);
          await postBybitSpotOrder({
            symbol: args.symbol,
            side: 'Sell',
            qty: qtyStr,
            marketUnit: 'baseCoin',
            orderType: 'Market',
          });
        } else {
          const pos = args.pos;
          const qtyBase = Math.abs(pos.size) * Math.min(1, Math.max(0, fraction));
          const qtyStr = linearQtyFromBaseAmount(qtyBase);
          const closeSide = pos.side === 'long' ? 'Sell' : 'Buy';
          await postBybitLinearOrder({
            symbol: pos.symbol,
            side: closeSide,
            qty: qtyStr,
            reduceOnly: true,
            positionIdx: pos.positionIdx ?? 0,
            orderType: 'Market',
          });
        }
        const mark =
          throttledOpenPnl.mark > 0 && Number.isFinite(throttledOpenPnl.mark)
            ? throttledOpenPnl.mark
            : live.lastPrice != null && live.lastPrice > 0
              ? live.lastPrice
              : Number.isFinite(mergedModel.lastPrice) && mergedModel.lastPrice > 0
                ? mergedModel.lastPrice
                : 0;
        const summaryPos = primaryOpenPosition ?? (isManageMode ? exchangeSyntheticForManageChart : null);
        const summary =
          summaryPos && mark > 0 ? buildClosedPositionSummary(summaryPos, mark, fraction) : null;
        if (summary) {
          setClosedPositionSummary(summary);
        } else {
          flashTradeToast(
            fraction >= 0.999 ? 'Close submitted — syncing account…' : 'Partial close submitted — syncing…',
          );
        }
        const pct = Math.round(fraction * 100);
        if (fraction >= 0.995) {
          exitAuto.pushActivity({
            kind: 'exit_state',
            message: 'Position fully closed on the exchange.',
          });
        } else {
          exitAuto.pushActivity({
            kind: 'exit_state',
            message: `Scaled out ${pct}% · remaining position still active`,
          });
        }
        await refreshAccountSnapshots({ silent: false });
      } catch (e) {
        flashTradeToast(formatBybitTradeErrorMessage(e, 'Close failed'), 5200);
      } finally {
        setOrderPending(null);
      }
    },
    [
      exchangeSyntheticForManageChart,
      exitAuto.pushActivity,
      flashTradeToast,
      isManageMode,
      live.lastPrice,
      mergedModel.lastPrice,
      primaryOpenPosition,
      refreshAccountSnapshots,
      throttledOpenPnl.mark,
    ],
  );

  const executeTrade = useCallback(
    async (nextSide: TradeSide) => {
      if (!canExecute) {
        flashTradeToast(sizingValidation.reason ?? 'Set a valid position size before placing an order.');
        return;
      }
      setSide(nextSide);
      setExecFlash(nextSide === 'long' ? 'long' : 'short');
      window.clearTimeout(execFlashClearRef.current);
      execFlashClearRef.current = window.setTimeout(() => setExecFlash(null), 420);

      let entryMark = NaN;
      if (Number.isFinite(mergedModel.lastPrice) && (mergedModel.lastPrice as number) > 0) {
        entryMark = mergedModel.lastPrice as number;
      } else if (Number.isFinite(mergedModel.entry) && (mergedModel.entry as number) > 0) {
        entryMark = mergedModel.entry as number;
      } else if (live.lastPrice != null && Number.isFinite(live.lastPrice) && live.lastPrice > 0) {
        entryMark = live.lastPrice;
      }
      if (!Number.isFinite(entryMark) || entryMark <= 0) {
        flashTradeToast('No price yet — wait for the chart to load, then try again.');
        return;
      }

      if (isManageMode && nextSide !== side) {
        flashTradeToast('Adding size uses your open direction — adjust side from Portfolio if needed.');
        return;
      }
      if (isManageMode && market === 'futures' && !exchangePositionForSymbol) {
        flashTradeToast(
          bybitSnap
            ? 'No open linear position on the exchange for this pair — confirm symbol or refresh Account.'
            : 'Connect Bybit in Account to add size.',
        );
        return;
      }

      if (useRealExecution) {
        setOrderPending('open');
        try {
          const sideBybit = nextSide === 'long' ? 'Buy' : 'Sell';
          if (market === 'spot') {
            if (sideBybit === 'Buy') {
              const qtyQuote = spotQuoteQtyFromUsd(metrics.positionSizeUsd);
              await postBybitSpotOrder({
                symbol: orderSymbol,
                side: 'Buy',
                orderType: 'Market',
                qty: qtyQuote,
                marketUnit: 'quoteCoin',
              });
            } else {
              const qtyStr = linearQtyFromNotionalUsd(metrics.positionSizeUsd, entryMark);
              await postBybitSpotOrder({
                symbol: orderSymbol,
                side: 'Sell',
                orderType: 'Market',
                qty: qtyStr,
                marketUnit: 'baseCoin',
              });
            }
          } else {
            const qtyStr = linearQtyFromNotionalUsd(metrics.positionSizeUsd, entryMark);
            const positionIdx = isManageMode ? (exchangePositionForSymbol?.positionIdx ?? 0) : 0;
            if (isManageMode) {
              await postBybitLinearOrder({
                symbol: orderSymbol,
                side: sideBybit,
                qty: qtyStr,
                orderType: 'Market',
                leverage: Math.min(leverage, futuresLevCap),
                positionIdx,
              });
            } else {
              const { tpSl, skippedTarget, skippedStop } = linearTpSlStringsForOpen(
                nextSide,
                entryMark,
                targetParsed,
                stopParsed,
              );
              if (skippedTarget || skippedStop) {
                flashTradeToast(
                  'Target/stop must be on the correct side of entry for exchange TP/SL — invalid level(s) were not sent.',
                  7000,
                );
              }
              await postBybitLinearOrder({
                symbol: orderSymbol,
                side: sideBybit,
                qty: qtyStr,
                orderType: 'Market',
                leverage: Math.min(leverage, futuresLevCap),
                positionIdx: 0,
                ...(tpSl.takeProfit ? { takeProfit: tpSl.takeProfit } : {}),
                ...(tpSl.stopLoss ? { stopLoss: tpSl.stopLoss } : {}),
              });
            }
          }
          flashTradeToast('Order submitted — syncing account…');
          const snapshotsAfter = await refreshAccountSnapshots({ silent: false });
          if (market === 'futures' && !isManageMode) {
            const preAttach = linearTpSlStringsForOpen(nextSide, entryMark, targetParsed, stopParsed);
            if (preAttach.tpSl.takeProfit || preAttach.tpSl.stopLoss) {
              const pos = findBybitLinearOpenLeg(snapshotsAfter, orderSymbol, nextSide);
              if (pos && Number.isFinite(pos.entryPrice) && pos.entryPrice > 0) {
                const synced = linearTpSlStringsForOpen(nextSide, pos.entryPrice, targetParsed, stopParsed);
                if (synced.skippedTarget || synced.skippedStop) {
                  flashTradeToast(
                    'TP/SL vs average fill: a level is on the wrong side — adjust in the form and use Apply TP/SL on manage if needed.',
                    7000,
                  );
                }
                if (synced.tpSl.takeProfit || synced.tpSl.stopLoss) {
                  try {
                    await postBybitLinearTradingStop({
                      symbol: orderSymbol,
                      positionIdx: pos.positionIdx ?? 0,
                      takeProfit: synced.tpSl.takeProfit ?? '0',
                      stopLoss: synced.tpSl.stopLoss ?? '0',
                    });
                  } catch (e) {
                    flashTradeToast(formatBybitTradeErrorMessage(e, 'TP/SL sync after fill failed'), 5200);
                  }
                  await refreshAccountSnapshots({ silent: true });
                }
              }
            }
          }
        } catch (e) {
          flashTradeToast(formatBybitTradeErrorMessage(e, 'Order failed'), 5200);
        } finally {
          setOrderPending(null);
        }
        return;
      }

      flashTradeToast('Connect Bybit in Account to place real orders.');
    },
    [
      amountUsd,
      bybitSnap,
      canExecute,
      exchangePositionForSymbol,
      flashTradeToast,
      futuresLevCap,
      isManageMode,
      leverage,
      live.lastPrice,
      market,
      mergedModel.entry,
      mergedModel.lastPrice,
      mergedModel.pair,
      metrics.positionSizeUsd,
      orderSymbol,
      refreshAccountSnapshots,
      side,
      sizingValidation.reason,
      stopParsed,
      targetParsed,
      useRealExecution,
    ],
  );

  const submitManageTradingStopFromNumbers = useCallback(
    async (stopPrice: number, targetPrice: number) => {
      if (!isManageMode || market !== 'futures') return;
      if (!exchangePositionForSymbol) {
        flashTradeToast(
          bybitSnap
            ? 'No open linear position on the exchange for this pair — confirm symbol or refresh Account.'
            : 'Connect Bybit in Account to update TP/SL.',
        );
        return;
      }
      if (!useRealExecution) {
        flashTradeToast('Connect Bybit in Account to update TP/SL.');
        return;
      }
      const entry = exchangePositionForSymbol.entryPrice;
      if (!Number.isFinite(entry) || entry <= 0) {
        flashTradeToast('Missing entry price — refresh Account sync.');
        return;
      }
      const legSide = exchangePositionForSymbol.side;
      const { tpSl, skippedTarget, skippedStop } = linearTpSlStringsForOpen(
        legSide,
        entry,
        targetPrice,
        stopPrice,
      );
      if (skippedTarget || skippedStop) {
        flashTradeToast(
          'A level is on the wrong side of entry — that leg was left unchanged on the exchange. Other legs still update.',
          7000,
        );
      }
      const tpExisting = exchangePositionForSymbol.takeProfitPrice;
      const slExisting = exchangePositionForSymbol.stopLossPrice;
      const takeProfit =
        tpSl.takeProfit ??
        (skippedTarget
          ? (tpExisting != null && Number.isFinite(tpExisting) && tpExisting > 0
              ? formatLinearPriceStringForBybit(tpExisting)
              : '') || '0'
          : '0');
      const stopLoss =
        tpSl.stopLoss ??
        (skippedStop
          ? (slExisting != null && Number.isFinite(slExisting) && slExisting > 0
              ? formatLinearPriceStringForBybit(slExisting)
              : '') || '0'
          : '0');
      setOrderPending('tpsl');
      try {
        await postBybitLinearTradingStop({
          symbol: orderSymbol,
          positionIdx: exchangePositionForSymbol.positionIdx ?? 0,
          takeProfit,
          stopLoss,
        });
        setStopStr(String(stopPrice));
        setTargetStr(String(targetPrice));
        setManageTpSlDirty(false);
        flashTradeToast('TP/SL updated — syncing account…');
        await refreshAccountSnapshots({ silent: false });
      } catch (e) {
        flashTradeToast(formatBybitTradeErrorMessage(e, 'Failed to update TP/SL'), 5200);
      } finally {
        setOrderPending(null);
      }
    },
    [
      bybitSnap,
      exchangePositionForSymbol,
      flashTradeToast,
      isManageMode,
      market,
      orderSymbol,
      refreshAccountSnapshots,
      useRealExecution,
    ],
  );

  const applyManageTradingStop = useCallback(async () => {
    await submitManageTradingStopFromNumbers(stopParsed, targetParsed);
  }, [submitManageTradingStopFromNumbers, stopParsed, targetParsed]);

  const moveStopToBreakeven = useCallback(async () => {
    if (!isManageMode || market !== 'futures' || !exchangePositionForSymbol) {
      flashTradeToast('Open a linear position to move stops.');
      return;
    }
    const entry = exchangePositionForSymbol.entryPrice;
    const leg = exchangePositionForSymbol.side;
    if (!Number.isFinite(entry) || entry <= 0) return;
    const buf = 0.00012;
    const beStop = leg === 'long' ? entry * (1 - buf) : entry * (1 + buf);
    await submitManageTradingStopFromNumbers(beStop, targetParsed);
    exitAuto.pushActivity({
      kind: 'exit_state',
      message: `Stop nudged toward breakeven (~${formatQuoteNumber(beStop)})`,
    });
  }, [
    exchangePositionForSymbol,
    exitAuto,
    isManageMode,
    market,
    submitManageTradingStopFromNumbers,
    targetParsed,
  ]);

  const tightenStopManage = useCallback(async () => {
    if (!isManageMode || market !== 'futures' || !exchangePositionForSymbol) {
      flashTradeToast('Open a linear position to tighten stops.');
      return;
    }
    const entry = exchangePositionForSymbol.entryPrice;
    const leg = exchangePositionForSymbol.side;
    const curSl = exchangePositionForSymbol.stopLossPrice ?? stopParsed;
    if (!Number.isFinite(entry) || entry <= 0 || !Number.isFinite(curSl) || curSl <= 0) {
      flashTradeToast('Need a valid stop on file — set SL in the form or refresh Account.');
      return;
    }
    const tightened =
      leg === 'long' ? curSl + (entry - curSl) * 0.38 : curSl - (curSl - entry) * 0.38;
    if (!Number.isFinite(tightened) || tightened <= 0) return;
    await submitManageTradingStopFromNumbers(tightened, targetParsed);
    exitAuto.pushActivity({
      kind: 'exit_state',
      message: `Stop tightened toward entry (~${formatQuoteNumber(tightened)})`,
    });
  }, [
    exchangePositionForSymbol,
    exitAuto,
    isManageMode,
    market,
    stopParsed,
    submitManageTradingStopFromNumbers,
    targetParsed,
  ]);

  const openManagePositionView = useCallback(() => {
    const pos = exchangePositionForSymbol;
    if (!pos || market !== 'futures') return;
    const mark =
      hasActiveTradePosition && Number.isFinite(throttledOpenPnl.mark) && throttledOpenPnl.mark > 0
        ? throttledOpenPnl.mark
        : live.lastPrice != null && live.lastPrice > 0
          ? live.lastPrice
          : Number.isFinite(mergedModel.lastPrice) && mergedModel.lastPrice > 0
            ? mergedModel.lastPrice
            : undefined;
    const q = buildManageTradeQueryFromLinearPosition(pos, {
      markPrice: mark,
      leverageFallback: effectiveFuturesLeverage,
    });
    navigate(`/trade?${q}`);
  }, [
    effectiveFuturesLeverage,
    exchangePositionForSymbol,
    hasActiveTradePosition,
    live.lastPrice,
    market,
    mergedModel.lastPrice,
    navigate,
    throttledOpenPnl.mark,
  ]);

  const onActivePartialClose = useCallback(
    (fraction: number) => {
      if (market === 'futures' && exchangePositionForSymbol) {
        void submitExchangeClose({ kind: 'linear', pos: exchangePositionForSymbol, fraction });
        return;
      }
      if (market === 'spot' && exchangeSpotFreeBaseQty != null && exchangeSpotFreeBaseQty > 0) {
        void submitExchangeClose({
          kind: 'spot',
          symbol: orderSymbol,
          freeBase: exchangeSpotFreeBaseQty,
          fraction,
        });
        return;
      }
      flashTradeToast(
        bybitSnap
          ? 'No matching open position on the exchange for this symbol — check pair and sync.'
          : 'Connect Bybit in Account to manage positions.',
      );
    },
    [bybitSnap, exchangePositionForSymbol, exchangeSpotFreeBaseQty, flashTradeToast, market, orderSymbol, submitExchangeClose],
  );

  const onActiveCloseAllConfirm = useCallback(() => {
    if (market === 'futures' && exchangePositionForSymbol) {
      void submitExchangeClose({ kind: 'linear', pos: exchangePositionForSymbol, fraction: 1 });
      return;
    }
    if (market === 'spot' && exchangeSpotFreeBaseQty != null && exchangeSpotFreeBaseQty > 0) {
      void submitExchangeClose({
        kind: 'spot',
        symbol: orderSymbol,
        freeBase: exchangeSpotFreeBaseQty,
        fraction: 1,
      });
      return;
    }
    flashTradeToast(
      bybitSnap
        ? 'No matching open position on the exchange for this pair.'
        : 'Connect Bybit in Account to manage positions.',
    );
  }, [bybitSnap, exchangePositionForSymbol, exchangeSpotFreeBaseQty, flashTradeToast, market, orderSymbol, submitExchangeClose]);

  /** Exit AI Auto: submit reduce-only / spot sells when guidance crosses trim/exit (Protect Profit etc.), not log-only. */
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
    const canAutoExit =
      (market === 'futures' && exchangePositionForSymbol != null) ||
      (market === 'spot' && exchangeSpotFreeBaseQty != null && exchangeSpotFreeBaseQty > 0);

    let blockedAdvancePrev = false;
    if (prev !== null && prev !== curr) {
      const trimEdge = curr === 'trim' && prev === 'hold' && exitAuto.safeguards.allowPartialExits;
      const exitEdge =
        curr === 'exit' &&
        exitAuto.safeguards.allowFullAutoClose &&
        (prev === 'hold' || prev === 'trim');

      if (trimEdge || exitEdge) {
        if (orderPending) {
          blockedAdvancePrev = true;
        } else if (useRealExecution && canAutoExit) {
          if (trimEdge) {
            exitAuto.pushActivity({
              kind: 'auto_trim',
              message: `Auto trim ~50% near $${formatQuoteNumber(exitFlow.lastPrice)} — submitting…`,
            });
            onActivePartialClose(0.5);
          } else if (exitEdge) {
            exitAuto.pushActivity({
              kind: 'auto_close',
              message: `Auto full exit near $${formatQuoteNumber(exitFlow.lastPrice)} — submitting…`,
            });
            onActiveCloseAllConfirm();
          }
        } else {
          if (trimEdge) {
            exitAuto.pushActivity({
              kind: 'auto_trim',
              message: useRealExecution
                ? `Trim signal near $${formatQuoteNumber(exitFlow.lastPrice)} — no exchange position on this pair.`
                : `Trim signal near $${formatQuoteNumber(exitFlow.lastPrice)} — connect Bybit in Account to auto-execute.`,
            });
          } else if (exitEdge) {
            exitAuto.pushActivity({
              kind: 'auto_close',
              message: useRealExecution
                ? `Exit signal near $${formatQuoteNumber(exitFlow.lastPrice)} — no exchange position on this pair.`
                : `Exit signal near $${formatQuoteNumber(exitFlow.lastPrice)} — connect Bybit in Account to auto-execute.`,
            });
          }
        }
      }
    }
    if (!blockedAdvancePrev) {
      prevAutoStateRef.current = curr;
    }
  }, [
    exitFlow,
    exitAuto.mode,
    exitAuto.safeguards.allowPartialExits,
    exitAuto.safeguards.allowFullAutoClose,
    exitAuto.pushActivity,
    exchangePositionForSymbol,
    exchangeSpotFreeBaseQty,
    market,
    onActiveCloseAllConfirm,
    onActivePartialClose,
    orderPending,
    useRealExecution,
  ]);

  const onClosePosition = useCallback(() => {
    onActiveCloseAllConfirm();
  }, [onActiveCloseAllConfirm]);

  const onAddToPosition = useCallback(() => {
    void executeTrade(side);
  }, [executeTrade, side]);

  const chartPnlHeader = useMemo(() => {
    if (isManageMode && managePnlDisplay) {
      const pnl = managePnlDisplay.pnlUsd;
      const pct = managePnlDisplay.pnlPct;
      if (!Number.isFinite(pnl) || !Number.isFinite(pct)) return { label: undefined, tone: undefined } as const;
      const sign = pnl >= 0 ? '+' : '−';
      const tone = pnl > 0 ? 'positive' : pnl < 0 ? 'negative' : 'neutral';
      return {
        label: `PnL ${sign}$${formatQuoteNumber(Math.abs(pnl))} (${sign}${Math.abs(pct).toFixed(2)}%)`,
        tone,
      } as const;
    }
    if (!isManageMode && hasActiveTradePosition && Number.isFinite(liveUnrealized.pnlUsd) && Number.isFinite(liveUnrealized.movePct)) {
      const pnl = liveUnrealized.pnlUsd;
      const pct = liveUnrealized.movePct;
      const sign = pnl >= 0 ? '+' : '−';
      const tone = pnl > 0 ? 'positive' : pnl < 0 ? 'negative' : 'neutral';
      return {
        label: `uPnL ${sign}$${formatQuoteNumber(Math.abs(pnl))} (${sign}${Math.abs(pct).toFixed(2)}%)`,
        tone,
      } as const;
    }
    return { label: undefined, tone: undefined } as const;
  }, [hasActiveTradePosition, isManageMode, liveUnrealized.movePct, liveUnrealized.pnlUsd, managePnlDisplay]);

  const manageDockChartHeaderMetrics = useMemo(() => {
    const badge =
      exitAuto.mode === 'manual'
        ? 'Static TP/SL'
        : exitFlow?.effective.state === 'trim'
          ? 'AI trim'
          : exitFlow?.effective.state === 'exit'
            ? 'AI exit'
            : 'AI exit';
    return {
      riskPercent: tradeDockStats.riskPercent,
      rewardPercent: tradeDockStats.rewardPercent,
      rrRatio: tradeDockStats.rrRatio,
      badge,
      ...(chartPnlHeader.label
        ? {
            secondaryLine: chartPnlHeader.label,
            secondaryLineTone: chartPnlHeader.tone,
          }
        : {}),
    };
  }, [
    chartPnlHeader.label,
    chartPnlHeader.tone,
    exitAuto.mode,
    exitFlow?.effective.state,
    tradeDockStats.rewardPercent,
    tradeDockStats.riskPercent,
    tradeDockStats.rrRatio,
  ]);

  const manageChartProximity = useMemo((): 'stop' | 'target' | null => {
    if (!isManageMode) return null;
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
  }, [chartModelForPlot.stop, chartModelForPlot.target, isManageMode, mergedModel.lastPrice]);

  const intervalLabel =
    chartInterval === 'D'
      ? '1D'
      : chartInterval === 'W'
        ? '1W'
        : chartInterval === '60'
          ? '1h'
          : chartInterval === '240'
            ? '4h'
            : chartInterval === '1'
              ? '1m'
              : `${chartInterval}m`;

  const toggleChartDock = useCallback(() => {
    setChartDockChevronIdle(true);
    setChartDockOpen((o) => !o);
  }, []);

  const onPickTradePair = useCallback(
    (s: CryptoSignal) => {
      setTradePairMenuOpen(false);
      navigate(`/trade?${buildTradeQueryString(s, { marketStatus: deriveMarketStatus(s) })}`);
    },
    [navigate],
  );

  useEffect(() => {
    if (isManageMode) setTradePairMenuOpen(false);
  }, [isManageMode]);

  useEffect(() => {
    if (!tradePairMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTradePairMenuOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      const el = tradePairMenuRef.current;
      if (el && !el.contains(e.target as Node)) setTradePairMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [tradePairMenuOpen]);

  const tradeScrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#050505] text-white">
      {!isManageMode ? (
        <CloseAllPositionsModal
          open={closeAllModalOpen}
          exchangeExecution={useRealExecution}
          onCancel={() => setCloseAllModalOpen(false)}
          onConfirm={() => {
            setCloseAllModalOpen(false);
            onActiveCloseAllConfirm();
          }}
        />
      ) : null}
      <ClosedPositionSummaryModal summary={closedPositionSummary} onDismiss={() => setClosedPositionSummary(null)} />
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
                  <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                    <p className="min-w-0 flex-1 truncate text-sm font-bold text-white">{mergedModel.pair}</p>
                    <button
                      type="button"
                      onClick={() => navigate(FEED_PATH)}
                      className="flex h-8 shrink-0 -translate-x-2 items-center justify-center rounded-lg border border-white/[0.08] px-1 transition hover:border-white/[0.12] hover:bg-white/[0.04]"
                      aria-label="Go to feed"
                    >
                      <SigfloLogo size={22} glowing className="shrink-0" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div ref={tradePairMenuRef} className="relative flex min-w-0 flex-1 items-center gap-1">
                  <button
                    type="button"
                    id="trade-pair-menu-button"
                    aria-expanded={tradePairMenuOpen}
                    aria-haspopup="listbox"
                    aria-controls="trade-pair-menu"
                    onClick={() => setTradePairMenuOpen((o) => !o)}
                    className="flex min-w-0 flex-1 items-center gap-1 rounded-xl border border-transparent py-1 text-left transition hover:border-white/[0.06] hover:bg-white/[0.03]"
                    aria-label="Choose trading pair"
                  >
                    <span className="truncate text-base font-bold tracking-tight text-white">{mergedModel.pair}</span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      className={`shrink-0 text-sigflo-muted transition-transform duration-200 ${tradePairMenuOpen ? 'rotate-180' : ''}`}
                      aria-hidden
                    >
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(FEED_PATH)}
                    className="flex h-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] px-1.5 transition hover:border-white/[0.12] hover:bg-white/[0.04]"
                    aria-label="Go to feed"
                  >
                    <SigfloLogo size={26} glowing className="shrink-0" />
                  </button>
                  {tradePairMenuOpen ? (
                    <div
                      id="trade-pair-menu"
                      role="listbox"
                      aria-labelledby="trade-pair-menu-button"
                      className="absolute left-0 right-0 top-[calc(100%+4px)] z-[60] max-h-[min(18rem,calc(100dvh-7rem))] overflow-y-auto overscroll-y-contain rounded-xl border border-white/[0.12] bg-[#0a0a0a] py-1 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.06]"
                    >
                      {tradePairPickerSignals.map((s) => {
                        const active = pairBaseToLinearSymbol(s.pair) === liveSymbol;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            role="option"
                            aria-selected={active}
                            onClick={() => onPickTradePair(s)}
                            className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.06] active:bg-white/[0.08] ${
                              active ? 'bg-white/[0.05]' : ''
                            }`}
                          >
                            <span className="min-w-0 truncate font-semibold text-white">
                              {formatSignalPairForTicker(s.pair)}
                            </span>
                            <span className="shrink-0 tabular-nums text-[11px] font-medium text-sigflo-muted">
                              {s.setupScore}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                {isTriggered ? (
                  <button
                    type="button"
                    onClick={() => navigate(FEED_PATH)}
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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {isManageMode ? (
          <div className="shrink-0 border-b border-landing-border/60 bg-landing-bg shadow-[0_8px_28px_-8px_rgba(0,0,0,0.45)]">
            <div className="mx-auto w-full max-w-lg px-1.5">
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
                  window.localStorage.setItem(TRADE_CHART_INTERVAL_STORAGE_KEY, v);
                  window.dispatchEvent(new CustomEvent(SIGFLO_CHART_INTERVAL_EVENT, { detail: v }));
                }}
                exchangeStyleHero={false}
                heroPairLabel={mergedModel.pair}
                metaCaption={
                  exitAuto.mode === 'manual'
                    ? 'PERP · Static SL/TP'
                    : 'PERP · AI exit · dynamic trim when guided'
                }
                setupMode={exchangeSyntheticForManageChart ? true : undefined}
                onSetupModeToggle={undefined}
                onRequestSetupMode={undefined}
                tradeTimingState={undefined}
                liveTradeMode={Boolean(exchangeSyntheticForManageChart)}
                suppressExchangeHeroLivePrice
                liveActivePositionTitle="Live position"
                liveTradeOverlayPreset={Boolean(exchangeSyntheticForManageChart)}
                auxiliaryPriceLines={manageAiChartAux}
                liveHeaderMetrics={manageDockChartHeaderMetrics}
                liveTradeRefitKey={
                  manageCtx
                    ? `${mergedModel.pair}|manage|${manageCtx.entryPrice}|${manageCtx.side}|${chartInterval}`
                    : undefined
                }
                chartProximity={manageChartProximity}
                pnlHeaderLabel={chartPnlHeader.label}
                pnlHeaderTone={chartPnlHeader.tone}
                className="pb-2"
              />
            </div>
          </div>
        ) : null}
        <div
          ref={tradeScrollRef}
          className={`trade-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain ${
            hasActiveTradePosition ? 'gap-0' : 'gap-1'
          }`}
        >
        <div
          className={`mx-auto flex w-full max-w-lg flex-col px-3 pb-0 ${hasActiveTradePosition ? 'gap-0 pt-1.5' : 'gap-1 pt-2'}`}
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
                customStrategyThresholds={exitAuto.customStrategyThresholds}
                scannerStatus={scannerStatus}
                lastPrice={
                  typeof mergedModel.lastPrice === 'number' && Number.isFinite(mergedModel.lastPrice)
                    ? mergedModel.lastPrice
                    : modelForMetrics.entry
                }
                hasOpenPosition={hasActiveTradePosition}
              />
            ) : null}
          </div>
          {isManageMode && managePnlDisplay && manageCtx ? (
            <ManagePositionControlPanel
              manageCtx={manageCtx}
              pnlUsd={managePnlDisplay.pnlUsd}
              pnlPct={managePnlDisplay.pnlPct}
              mark={typeof markForManage === 'number' && Number.isFinite(markForManage) ? markForManage : mergedModel.entry}
              leverageLabel={market === 'futures' ? `${manageLeverageForUi ?? leverage}×` : '1× spot'}
              isFutures={market === 'futures'}
              health={managePositionHealth}
              exitAiModel={manageExitAiCoPilot}
              exitMode={exitAuto.mode}
              onExitModeChange={exitAuto.setMode}
              onCloseFull={onActiveCloseAllConfirm}
              onPartialOpen={() => setManagePartialSheetOpen(true)}
              onMoveStopBreakeven={() => void moveStopToBreakeven()}
              onTightenStop={() => void tightenStopManage()}
              onAddToPosition={() => void onAddToPosition()}
              timeline={manageTimelineLines}
              actionsDisabled={!!orderPending}
              canMoveStops={Boolean(useRealExecution && exchangePositionForSymbol)}
            />
          ) : null}
          <div className="flex flex-col gap-1">
            {showAssistedExitConfirmBar && exitFlow ? (
              <AssistedExitConfirmBar
                headline={exitFlow.effective.headline}
                detail={exitFlow.effective.action}
                onConfirm={() => {
                  if (orderPending) {
                    flashTradeToast('Wait for the in-flight order to finish, then try again.');
                    return;
                  }
                  const st = exitFlow.effective.state;
                  setAssistedExitAcknowledged(true);
                  setAssistedExitBarForceHidden(false);
                  if (st === 'trim') {
                    exitAuto.pushActivity({
                      kind: 'assisted_ready',
                      message: `Assisted trim ~50% near $${formatQuoteNumber(exitFlow.lastPrice)} — submitting…`,
                    });
                    onActivePartialClose(0.5);
                    return;
                  }
                  if (st === 'exit') {
                    exitAuto.pushActivity({
                      kind: 'assisted_ready',
                      message: `Assisted full exit near $${formatQuoteNumber(exitFlow.lastPrice)} — submitting…`,
                    });
                    onActiveCloseAllConfirm();
                  }
                }}
                onDismiss={() => {
                  setAssistedExitAcknowledged(false);
                  setAssistedExitBarForceHidden(false);
                  exitAuto.pushActivity({
                    kind: 'mode_change',
                    message: 'Switched to Manual — dismissed prepared exit prompt',
                  });
                  exitAuto.setMode('manual');
                }}
              />
            ) : null}
            <ExitModePanel live={Boolean(hasActiveTradePosition) || isManageMode}>
              <ExitAutomationControls
                mode={exitAuto.mode}
                onModeChange={exitAuto.setMode}
                strategy={exitAuto.strategy}
                onStrategyChange={exitAuto.setStrategy}
                safeguards={exitAuto.safeguards}
                onSafeguardsChange={exitAuto.setSafeguards}
                customStrategyThresholds={exitAuto.customStrategyThresholds}
                onCustomStrategyThresholdsMerge={exitAuto.mergeCustomStrategyThresholds}
                onResetCustomStrategyThresholds={exitAuto.resetCustomStrategyThresholds}
                activity={exitAuto.activity}
                onClearActivity={exitAuto.clearActivity}
                compactActivity={!isManageMode}
              />
            </ExitModePanel>
          </div>
          {!isManageMode ? (
            <ActivePositionsPanel
              market={market}
              exchangePosition={exchangePositionForSymbol}
              exchangeSpotDisplay={exchangeSpotPanelModel}
              displayPair={mergedModel.pair}
              leverageFallback={leverage}
              markPrice={
                hasActiveTradePosition && Number.isFinite(throttledOpenPnl.mark) && throttledOpenPnl.mark > 0
                  ? throttledOpenPnl.mark
                  : Number.isFinite(mergedModel.lastPrice) && mergedModel.lastPrice > 0
                    ? mergedModel.lastPrice
                    : exchangePositionForSymbol?.entryPrice ?? exchangeSpotPanelModel?.entryPrice ?? 0
              }
              onRequestCloseAllModal={() => setCloseAllModalOpen(true)}
              onOpenManagePosition={
                market === 'futures' && exchangePositionForSymbol ? openManagePositionView : undefined
              }
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
          chartInterval={chartInterval}
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
          managePositionLeverage={isManageMode ? manageLeverageForUi : undefined}
          maxLeverage={market === 'futures' ? futuresLevCap : null}
          side={side}
          stopStr={stopStr}
          targetStr={targetStr}
          onAmountChange={onAmountUsdChange}
          onLeverageChange={setLeverage}
          onStopStrChange={onStopStrForTrade}
          onTargetStrChange={onTargetStrForTrade}
          metrics={metrics}
          estFeeUsd={estFeeUsd}
          balanceLabel={
            tradeBalance?.availableToTrade != null
              ? 'Available (UTA)'
              : tradeBalance?.totalWalletBalance != null
                ? 'UTA wallet balance'
                : 'Wallet Balance'
          }
          balanceHelper={tradeBalanceHelper}
          displayBalanceUsd={displayBalanceUsd}
          fundingBalanceUsd={tradeBalance?.fundingWalletBalance}
          fundingBalanceAsset={tradeBalance?.fundingPrimaryAsset}
          minOrderUsd={minOrderUsd}
          orderSymbol={orderSymbol}
          utaMarginInUseUsd={tradeBalance?.marginInUseUsd}
          utaEquityUsd={tradeBalance?.totalEquity}
          utaUnrealizedPnlUsd={tradeBalance?.utaUnrealizedPnl}
          utaWalletBalanceUsd={tradeBalance?.totalWalletBalance}
          assetTransferHref={assetTransferHref}
          onClosePosition={onClosePosition}
          onAddToPosition={onAddToPosition}
          manageFuturesTpSl={
            isManageMode && market === 'futures'
              ? {
                  canApply: Boolean(useRealExecution && exchangePositionForSymbol),
                  pending: orderPending === 'tpsl',
                  onApply: applyManageTradingStop,
                }
              : null
          }
          suppressLegacyManageHero={isManageMode && Boolean(managePnlDisplay && manageCtx)}
        />
      </div>
      </div>

      {!isManageMode ? (
      <div
        className={`sticky bottom-0 z-30 shrink-0 bg-black/[0.92] backdrop-blur-xl ${
          hasActiveTradePosition
            ? 'border-t border-[#00ffc8]/20 shadow-[0_-20px_56px_-24px_rgba(0,255,200,0.14)]'
            : 'border-t border-white/10'
        }`}
      >
        <div className="divide-y divide-white/[0.06]">
          <LiveMarketStrip
            symbol={mergedModel.pair}
            lastPrice={Number.isFinite(mergedModel.lastPrice) ? mergedModel.lastPrice : null}
            movePct={mergedModel.change24hPct ?? null}
            moveLabel="24h"
            statusLabel={hasActiveTradePosition ? 'Live' : undefined}
            pulse={hasActiveTradePosition}
            tickerItems={liveMarketTickerItems}
          />
          <div className="mx-auto w-full max-w-lg border-b border-white/[0.08] bg-gradient-to-b from-black/55 to-black/[0.38] backdrop-blur-sm">
              <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-[4.8px] px-[7px] py-[3px] sm:gap-x-[7px] sm:px-[10px]">
                <div className="min-w-0 justify-self-start flex flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-2.5">
                  <div className="flex shrink-0 flex-col items-start gap-0.5 pl-[6px]">
                    <button
                      type="button"
                      onClick={toggleChartDock}
                      className="max-w-full truncate rounded py-[2px] pr-[6px] text-left transition hover:bg-white/[0.03] active:bg-white/[0.05]"
                      aria-expanded={chartDockOpen}
                      aria-label={
                        chartDockOpen
                          ? `Collapse price chart (${intervalLabel})`
                          : `Expand price chart (${intervalLabel})`
                      }
                    >
                      <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.12em] text-sigflo-muted">
                        Price chart
                      </span>
                    </button>
                    {dockTimingChip.state !== 'developing' ? (
                      <div className="flex w-full justify-end -translate-x-1 sm:-translate-x-1.5">
                        <StatusChip label={dockTimingChip.label} state={dockTimingChip.state} compact />
                      </div>
                    ) : null}
                  </div>
                  <div className="h-7 w-px shrink-0 self-center bg-white/[0.1]" aria-hidden />
                  <div className="shrink-0 pr-0.5">
                    <TradeStats
                      variant="strip"
                      compact
                      layout="dockGrid"
                      riskPercent={tradeDockStats.riskPercent}
                      rewardPercent={tradeDockStats.rewardPercent}
                      rrRatio={tradeDockStats.rrRatio}
                    />
                  </div>
                </div>
                <div className="flex min-w-0 w-full justify-self-stretch justify-start pl-0.5 sm:pl-1">
                  {hasActiveTradePosition && primaryOpenPosition ? (
                    <div className="flex w-full min-w-0 items-center gap-x-1.5 sm:gap-x-2">
                      <div className="shrink-0 self-center">
                        <ChartDockScoreGrid dockMeta={dockDecisionMeta} />
                      </div>
                      <div className="min-w-0 flex-1 self-center">
                        <PositionActionsBar
                          variant="dock"
                          disabled={!!orderPending}
                          onCloseAll={() => setCloseAllModalOpen(true)}
                          onPartialClose={onActivePartialClose}
                          onManagePosition={
                            market === 'futures' && exchangePositionForSymbol
                              ? openManagePositionView
                              : undefined
                          }
                        />
                      </div>
                    </div>
                  ) : (
                    <ChartInlineTradeButtons
                      variant="dock"
                      market={market}
                      canExecute={canExecute && !orderPending}
                      flashSide={execFlash}
                      onOpenShort={() => void executeTrade('short')}
                      onOpenLong={() => void executeTrade('long')}
                      signalBias={selectedSignal.side === 'short' ? 'short' : 'long'}
                      dockMeta={dockDecisionMeta}
                      omitDockTimingChip
                    />
                  )}
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
                  window.localStorage.setItem(TRADE_CHART_INTERVAL_STORAGE_KEY, v);
                  window.dispatchEvent(new CustomEvent(SIGFLO_CHART_INTERVAL_EVENT, { detail: v }));
                }}
                exchangeStyleHero
                metaCaption={market === 'futures' ? 'PERP · Funding +0.010%' : 'Spot · No funding'}
                setupMode={hasActiveTradePosition || setupMode}
                onSetupModeToggle={!hasActiveTradePosition ? () => setSetupMode((v) => !v) : undefined}
                onRequestSetupMode={() => setSetupMode(true)}
                tradeTimingState={dockTimingChip.state}
                liveTradeMode={Boolean(chartDockOpen && hasActiveTradePosition)}
                suppressExchangeHeroLivePrice
                liveActivePositionTitle={hasActiveTradePosition ? 'Live position' : undefined}
                liveTradeOverlayPreset={hasActiveTradePosition}
                auxiliaryPriceLines={chartAuxiliaryLines}
                liveHeaderMetrics={chartDockOpen ? dockChartHeaderMetrics : undefined}
                liveTradeRefitKey={liveChartRefitKey}
                chartProximity={chartProximity}
                pnlHeaderLabel={chartPnlHeader.label}
                pnlHeaderTone={chartPnlHeader.tone}
                className="pb-2"
              />
            ) : null}

          </div>

        </div>
      </div>
      ) : (
        <div
          className="shrink-0 border-t border-white/[0.06] bg-[#050505] pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          aria-hidden
        />
      )}

      {isManageMode ? (
        <ManagePartialCloseSheet
          open={managePartialSheetOpen}
          onClose={() => setManagePartialSheetOpen(false)}
          fraction={managePartialFraction}
          onFractionChange={setManagePartialFraction}
          onConfirm={(f) => {
            setManagePartialSheetOpen(false);
            onActivePartialClose(f);
          }}
          disabled={!!orderPending}
          busy={!!orderPending}
        />
      ) : null}
    </div>
  );
}

/** Legacy `/trade?signal=sig-1` URLs — map to tracked pairs when the feed has not emitted that id yet. */
function resolveShellSignalForLegacyId(signalId: string, liveSignals: CryptoSignal[]): CryptoSignal | null {
  const map: Record<string, { pair: string; symbol: string }> = {
    'sig-1': { pair: 'BTC', symbol: 'BTCUSDT' },
    'sig-2': { pair: 'ETH', symbol: 'ETHUSDT' },
    'sig-3': { pair: 'SOL', symbol: 'SOLUSDT' },
  };
  const m = map[signalId];
  if (!m) return null;
  return liveSignals.find((s) => s.pair === m.pair) ?? buildTrackedFallbackSignal(m.pair, m.symbol);
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
  const entryQ = Number(params.get('entry'));
  const stopQ = Number(params.get('stop'));
  const targetQ = Number(params.get('target'));
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
    plannedEntry: Number.isFinite(entryQ) && entryQ > 0 ? entryQ : undefined,
    plannedStop: Number.isFinite(stopQ) && stopQ > 0 ? stopQ : undefined,
    plannedTarget: Number.isFinite(targetQ) && targetQ > 0 ? targetQ : undefined,
  };
}
