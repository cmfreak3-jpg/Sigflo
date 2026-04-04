import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getMockTradeForPair, getMockTradeForSignalId } from '@/data/mockTrade';
import { mockSignals } from '@/data/mockSignals';
import { ChartHeader } from '@/components/trade/ChartHeader';
import { TradeChartScenarioStrip, computeScenarioProbabilities } from '@/components/trade/TradeChartScenarioStrip';
import { TradeActionBar } from '@/components/trade/TradeActionBar';
import { TradeControls } from '@/components/trade/TradeControls';
import { TRADE_CHART_PLOT_COLLAPSED_PX, TRADE_CHART_PLOT_EXPANDED_PX } from '@/config/tradeChartHeights';
import { formatQuoteNumber } from '@/lib/formatQuote';
import type { ManageTradePositionContext } from '@/lib/manageTradeContext';
import { useLiveTradeMarket, type TradeChartInterval } from '@/hooks/useLiveTradeMarket';
import { managePnlFromPrices, parseManageTradeContext } from '@/lib/manageTradeContext';
import { positionMicroInsight } from '@/lib/positionMicroInsight';
import { deriveMarketStatus, parseMarketStatusQuery } from '@/lib/marketScannerRows';
import { formatElapsedAgo, postedAgoToSeconds, uiSignalStateClasses, uiSignalStateFromMarketStatus, uiSignalStateLabel } from '@/lib/signalState';
import { deriveTradeMetrics } from '@/lib/tradeRisk';
import type { SymbolTicker } from '@/types/market';
import type { CryptoSignal, SetupScoreLabel, SignalRiskTag, SignalSetupTag } from '@/types/signal';
import type { MarketMode, TradeSide } from '@/types/trade';

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
  const liveUnrealized = useMemo(() => {
    const entry = Math.max(0.000001, modelForMetrics.entry);
    const dir = side === 'long' ? 1 : -1;
    const movePct = ((modelForMetrics.lastPrice - entry) / entry) * 100 * dir;
    const pnlUsd = metrics.positionSizeUsd * (movePct / 100);
    return { pnlUsd, movePct };
  }, [modelForMetrics.entry, modelForMetrics.lastPrice, metrics.positionSizeUsd, side]);

  /** Round-trip taker fee heuristic (~0.055% per side). */
  const estFeeUsd = metrics.positionSizeUsd * 0.00055 * 2;

  const canExecute = amountUsd > 0 && metrics.balanceUsd > 0 && Number.isFinite(metrics.positionSizeUsd);

  const scenarioProb = useMemo(
    () =>
      computeScenarioProbabilities({
        tradeScore: metrics.riskSummary.tradeScore,
        setupScore: selectedSignal.setupScore,
        side: side === 'long' ? 'long' : 'short',
      }),
    [metrics.riskSummary.tradeScore, selectedSignal.setupScore, side],
  );

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
    },
    [amountUsd, flashTradeToast, leverage, market],
  );

  const intervalLabel =
    chartInterval === 'D' ? '1D' : chartInterval === 'W' ? '1W' : chartInterval === '60' ? '1h' : chartInterval === '240' ? '4h' : `${chartInterval}m`;

  const tradeScrollRef = useRef<HTMLDivElement>(null);
  const [chartHeaderCollapsed, setChartHeaderCollapsed] = useState(false);

  useLayoutEffect(() => {
    const el = tradeScrollRef.current;
    if (!el) return;
    const onScroll = () => setChartHeaderCollapsed(el.scrollTop > 50);
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [isManageMode, signalId]);

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#050505] text-white">
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
                    className={`flex max-w-[40%] shrink-0 flex-col items-end gap-0.5 rounded-lg py-0.5 pl-2 text-right text-[10px] font-semibold leading-tight transition hover:bg-white/[0.06] active:scale-[0.98] ${uiStateStyle.text}`}
                    aria-label="Back to signals"
                  >
                    <span className="inline-flex items-center justify-end gap-1">
                      <span className="relative flex h-2 w-2 shrink-0">
                        {uiStateStyle.pulse ? (
                          <>
                            <span className="absolute inset-[-4px] rounded-full bg-[#00ffc8]/22 blur-[2px]" />
                            <span className={`absolute inline-flex h-full w-full animate-pulse-dot rounded-full ${uiStateStyle.dot} [animation-duration:2.8s]`} />
                          </>
                        ) : null}
                        <span className={`relative inline-flex h-full w-full rounded-full ${uiStateStyle.dot}`} />
                      </span>
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
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        {uiStateStyle.pulse ? (
                          <>
                            <span className="absolute inset-[-4px] rounded-full bg-[#00ffc8]/22 blur-[2px]" />
                            <span className={`absolute inline-flex h-full w-full animate-pulse-dot rounded-full ${uiStateStyle.dot} [animation-duration:2.8s]`} />
                          </>
                        ) : null}
                        <span className={`relative inline-flex h-full w-full rounded-full ${uiStateStyle.dot}`} />
                      </span>
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

        <ChartHeader
          collapsed={chartHeaderCollapsed}
          plotExpandedPx={TRADE_CHART_PLOT_EXPANDED_PX}
          plotCollapsedPx={TRADE_CHART_PLOT_COLLAPSED_PX}
          model={mergedModel}
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
                ? 'Perpetual · Funding +0.010%'
                : 'Spot · No funding'
          }
        />
        {!isManageMode ? (
          <TradeChartScenarioStrip
            mode="trade"
            estimatedPnlUsd={liveUnrealized.pnlUsd}
            estimatedPnlPct={liveUnrealized.movePct}
            targetProfitUsd={metrics.targetProfitUsd}
            stopLossUsd={metrics.stopLossUsd}
            riskReward={mergedModel.riskReward}
            probUp={scenarioProb.probUp}
            probDown={scenarioProb.probDown}
            marginUsd={metrics.amountUsedUsd}
            estFeeUsd={estFeeUsd}
            liqPrice={market === 'futures' ? metrics.liquidation : null}
            entry={modelForMetrics.entry}
            stop={modelForMetrics.stop}
            target={modelForMetrics.target}
            positionSizeUsd={metrics.positionSizeUsd}
            leverage={leverage}
            isFutures={market === 'futures'}
            tradeScore={metrics.riskSummary.tradeScore}
            setupScore={selectedSignal.setupScore}
          />
        ) : managePnlDisplay && manageCtx ? (
          <TradeChartScenarioStrip
            mode="manage"
            pnlUsd={managePnlDisplay.pnlUsd}
            pnlPct={managePnlDisplay.pnlPct}
            pair={manageCtx.pair}
            entry={manageCtx.entryPrice}
            mark={markForManage}
            sizeLabel={manageStripSizeLabel(manageCtx)}
            side={manageCtx.side}
            riskReward={mergedModel.riskReward}
          />
        ) : null}
      </div>

      <div
        ref={tradeScrollRef}
        className="trade-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain"
      >
        <TradeControls
          manageDataInvalid={manageDataInvalid}
          ticketIntent={ticketIntent}
          market={market}
          onMarketChange={setMarket}
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
        />
        {!isManageMode ? (
          <TradeActionBar
            market={market}
            canExecute={canExecute}
            flashSide={execFlash}
            onSellShort={() => executeTrade('short')}
            onBuyLong={() => executeTrade('long')}
          />
        ) : null}
      </div>

      {isManageMode ? (
        <div className="sticky bottom-0 z-30 shrink-0 border-t border-white/[0.08] bg-black/80 px-2 py-1.5 backdrop-blur-xl">
          <div className="mx-auto max-w-lg space-y-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              className="w-full rounded-2xl border border-rose-400/35 bg-rose-500/[0.12] py-3.5 text-base font-bold text-rose-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] transition hover:bg-rose-500/18 active:scale-[0.98]"
            >
              Close Position
            </button>
            <button
              type="button"
              className="w-full rounded-2xl bg-sigflo-accent py-3.5 text-base font-bold text-sigflo-bg shadow-glow transition hover:brightness-110 active:scale-[0.98]"
            >
              Add to Position
            </button>
            <button
              type="button"
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
  );
}

function manageStripSizeLabel(ctx: ManageTradePositionContext): string {
  const base = ctx.pair.includes('/') ? ctx.pair.split('/')[0].trim() : ctx.pair;
  if (ctx.posSize != null && Number.isFinite(ctx.posSize)) {
    return `${formatQuoteNumber(Math.abs(ctx.posSize))} ${base}`;
  }
  return `≈ $${Math.round(ctx.positionUsd).toLocaleString('en-US')} notional`;
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
