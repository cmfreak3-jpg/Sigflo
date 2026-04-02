import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ScannerInsightCard } from '@/components/trade/ScannerInsightCard';
import { getMockTradeForPair, getMockTradeForSignalId } from '@/data/mockTrade';
import { mockSignals } from '@/data/mockSignals';
import { MarketStatsRow } from '@/components/trade/MarketStatsRow';
import { MarketToggle } from '@/components/trade/MarketToggle';
import { OrderInputsCard } from '@/components/trade/OrderInputsCard';
import { PriceChartCard } from '@/components/trade/PriceChartCard';
import { PreTradeWarningCard } from '@/components/trade/PreTradeWarningCard';
import { TradeSummaryCard } from '@/components/trade/TradeSummaryCard';
import { useLiveTradeMarket, type TradeChartInterval } from '@/hooks/useLiveTradeMarket';
import { formatQuoteNumber } from '@/lib/formatQuote';
import { managePnlFromPrices, parseManageTradeContext, type ManageTradePositionContext } from '@/lib/manageTradeContext';
import { positionMicroInsight } from '@/lib/positionMicroInsight';
import { deriveMarketStatus, parseMarketStatusQuery } from '@/lib/marketScannerRows';
import { formatElapsedAgo, postedAgoToSeconds, uiSignalStateClasses, uiSignalStateFromMarketStatus, uiSignalStateLabel } from '@/lib/signalState';
import { deriveTradeMetrics } from '@/lib/tradeRisk';
import type { SymbolTicker } from '@/types/market';
import type { CryptoSignal, SetupScoreLabel, SignalRiskTag, SignalSetupTag } from '@/types/signal';
import type { MarketMode, TradeSide } from '@/types/trade';

function fmtManageSignedUsd(n: number): string {
  const sign = n >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtManageSignedPct(n: number): string {
  const sign = n >= 0 ? '+' : '-';
  return `${sign}${Math.abs(n).toFixed(1)}%`;
}

function manageSizeSummary(ctx: ManageTradePositionContext): string {
  const base = ctx.pair.includes('/') ? ctx.pair.split('/')[0].trim() : ctx.pair;
  if (ctx.posSize != null && Number.isFinite(ctx.posSize)) {
    return `${formatQuoteNumber(Math.abs(ctx.posSize))} ${base}`;
  }
  return `≈ $${Math.round(ctx.positionUsd).toLocaleString('en-US')} notional`;
}

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

  const metrics = useMemo(
    () => deriveTradeMetrics(mergedModel, { amountUsd, leverage, side, market, setupScore: selectedSignal.setupScore }),
    [amountUsd, leverage, market, mergedModel, selectedSignal.setupScore, side],
  );
  const liveUnrealized = useMemo(() => {
    const entry = Math.max(0.000001, mergedModel.entry);
    const dir = side === 'long' ? 1 : -1;
    const movePct = ((mergedModel.lastPrice - entry) / entry) * 100 * dir;
    const pnlUsd = metrics.positionSizeUsd * (movePct / 100);
    return { pnlUsd, movePct };
  }, [mergedModel.entry, mergedModel.lastPrice, metrics.positionSizeUsd, side]);

  const ctaLabel = market === 'spot' ? (side === 'long' ? 'Buy' : 'Sell') : side === 'long' ? 'Open Long' : 'Open Short';
  const ctaSub = `${side === 'long' ? '-' : '-'}$${Math.round(Math.abs(metrics.stopLossUsd)).toLocaleString()} / +$${Math.round(Math.abs(metrics.targetProfitUsd)).toLocaleString()}`;
  const ctaClass =
    side === 'short'
      ? 'bg-rose-500 text-white hover:bg-rose-400'
      : 'bg-sigflo-accent text-sigflo-bg hover:brightness-110';

  return (
    <div className="min-h-[100dvh] bg-sigflo-bg pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-lg px-4">
        {/* Header */}
        <header className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] text-sigflo-muted transition hover:text-white"
            aria-label="Back"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
            <div className="min-w-0">
              {isManageMode ? (
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200/90">Managing Position</p>
              ) : null}
              <h1 className="text-xl font-bold tracking-tight text-white">{mergedModel.pair}</h1>
              {!isManageMode ? (
                <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-sigflo-muted">New trade</p>
              ) : null}
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold tabular-nums text-white">${formatQuoteNumber(mergedModel.lastPrice)}</span>
                <span className={mergedModel.change24hPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {mergedModel.change24hPct >= 0 ? '+' : ''}{mergedModel.change24hPct.toFixed(2)}%
                </span>
              </div>
            </div>
            {isManageMode ? (
              <div className="shrink-0 pt-0.5 text-right text-[10px] font-semibold uppercase tracking-wider text-sigflo-muted">
                {market === 'futures' ? 'Perp' : 'Spot'}
              </div>
            ) : (
              <div className={`shrink-0 text-[11px] font-semibold ${uiStateStyle.text}`}>
                <span className="inline-flex items-center gap-1.5">
                  <span className={`relative flex ${uiState === 'triggered' ? 'h-2 w-2' : 'h-1.5 w-1.5'}`}>
                    {uiStateStyle.pulse ? (
                      <>
                        <span className="absolute inset-[-4px] rounded-full bg-[#00ffc8]/22 blur-[2px]" />
                        <span className={`absolute inline-flex h-full w-full animate-pulse-dot rounded-full ${uiStateStyle.dot} [animation-duration:2.8s]`} />
                      </>
                    ) : null}
                    <span className={`relative inline-flex h-full w-full rounded-full ${uiStateStyle.dot}`} />
                  </span>
                  <span className={uiState === 'triggered' ? 'uppercase tracking-[0.11em] text-[#b2ffef] drop-shadow-[0_0_8px_rgba(0,255,200,0.45)]' : ''}>
                    {uiSignalStateLabel(uiState)}
                  </span>
                  {isTriggered ? <span className="text-sigflo-muted">· {stateAgeLabel}</span> : null}
                </span>
                {!isTriggered ? <p className="mt-0.5 text-right text-[10px] text-sigflo-muted">{live.mode} · {live.connection}</p> : null}
              </div>
            )}
          </div>
        </header>

        <div className="space-y-3">
          {manageDataInvalid ? (
            <p className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2.5 text-center text-[11px] leading-snug text-amber-100/90">
              Position data unavailable — showing new trade layout.
            </p>
          ) : null}
          {isManageMode && managePnlDisplay && manageCtx ? (
            <>
              <div
                className={`rounded-2xl border px-4 py-3.5 ${
                  managePnlDisplay.pnlUsd >= 0
                    ? 'border-emerald-400/20 bg-emerald-500/[0.06] shadow-[0_0_36px_-14px_rgba(52,211,153,0.28)]'
                    : 'border-rose-400/15 bg-rose-950/[0.22] shadow-[inset_0_1px_0_0_rgba(248,113,113,0.08)]'
                }`}
              >
                <p
                  className={`font-mono text-2xl font-bold tabular-nums tracking-tight ${
                    managePnlDisplay.pnlUsd >= 0 ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {fmtManageSignedUsd(managePnlDisplay.pnlUsd)}
                </p>
                <p
                  className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${
                    managePnlDisplay.pnlUsd >= 0 ? 'text-emerald-200/90' : 'text-rose-200/90'
                  }`}
                >
                  ({fmtManageSignedPct(managePnlDisplay.pnlPct)})
                </p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-sigflo-surface/95 p-3.5">
                <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5">
                  <span className="text-lg font-bold text-white">{manageCtx.pair}</span>
                  <span
                    className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      manageCtx.side === 'long' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {manageCtx.side === 'long' ? 'LONG' : 'SHORT'}
                  </span>
                </div>
                <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                  <div>
                    <dt className="text-sigflo-muted">Entry</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-white">${formatQuoteNumber(manageCtx.entryPrice)}</dd>
                  </div>
                  <div>
                    <dt className="text-sigflo-muted">Current</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-white">${formatQuoteNumber(markForManage)}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-sigflo-muted">Size</dt>
                    <dd className="mt-0.5 font-semibold text-white">{manageSizeSummary(manageCtx)}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-sigflo-muted">Open PnL</dt>
                    <dd
                      className={`mt-0.5 font-mono font-semibold tabular-nums ${
                        managePnlDisplay.pnlUsd >= 0 ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                    >
                      {fmtManageSignedUsd(managePnlDisplay.pnlUsd)} ({fmtManageSignedPct(managePnlDisplay.pnlPct)})
                    </dd>
                  </div>
                </dl>
                {manageInsightLine ? (
                  <p className="mt-3 border-t border-white/[0.06] pt-2.5 text-[11px] font-medium leading-snug text-cyan-200/90">
                    {manageInsightLine}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
          {ticketIntent === 'close' ? (
            <p className="rounded-xl border border-rose-500/20 bg-rose-500/[0.07] px-3 py-2 text-center text-[11px] leading-snug text-rose-100/90">
              Plan your exit on the chart — closing still happens on the exchange.
            </p>
          ) : null}
          {ticketIntent === 'add' ? (
            <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-2 text-center text-[11px] leading-snug text-emerald-100/90">
              Size up below to mirror how much more you want on this book.
            </p>
          ) : null}
          <MarketToggle value={market} onChange={setMarket} />
          <div className="overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max items-center gap-4 pr-2">
              <MarketStatsRow model={mergedModel} />
              <div className="flex shrink-0 items-center gap-1.5">
                {([
                  { value: '5', label: '5m' },
                  { value: '15', label: '15m' },
                  { value: '60', label: '1h' },
                  { value: '240', label: '4h' },
                  { value: 'D', label: '1D' },
                  { value: 'W', label: '1W' },
                ] as const).map((intv) => (
                  <button
                    key={intv.value}
                    type="button"
                    onClick={() => { setChartInterval(intv.value); window.localStorage.setItem('sigflo.trade.chartInterval', intv.value); }}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                      chartInterval === intv.value
                        ? 'bg-sigflo-accent/15 text-sigflo-accent ring-1 ring-sigflo-accent/30'
                        : 'text-sigflo-muted hover:text-sigflo-text'
                    }`}
                  >
                    {intv.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <PriceChartCard
            model={mergedModel}
            market={market}
            intervalLabel={chartInterval === 'D' ? '1D' : chartInterval === 'W' ? '1W' : chartInterval === '60' ? '1h' : chartInterval === '240' ? '4h' : `${chartInterval}m`}
            loadingInterval={live.loadingInterval}
            liveUpdatedAt={live.lastUpdateTs}
          />

          {!isManageMode ? (
            <TradeSummaryCard
              market={market}
              model={{
                balanceUsd: metrics.balanceUsd,
                amountUsedUsd: metrics.amountUsedUsd,
                walletUsedPct: metrics.walletUsedPct,
                leverage: metrics.leverage,
                positionSizeUsd: metrics.positionSizeUsd,
                livePnlUsd: liveUnrealized.pnlUsd,
                livePnlPct: liveUnrealized.movePct,
                targetProfitUsd: metrics.targetProfitUsd,
                stopLossUsd: metrics.stopLossUsd,
                liquidation: metrics.liquidation,
                riskReward: mergedModel.riskReward,
              }}
            />
          ) : null}

          {!isManageMode ? (
            <ScannerInsightCard signal={selectedSignal} status={scannerStatus} tradeScore={metrics.riskSummary.tradeScore} />
          ) : null}

          <OrderInputsCard
            market={market}
            balanceUsd={metrics.balanceUsd}
            amountUsd={amountUsd}
            leverage={leverage}
            side={side}
            positionSizeUsd={metrics.positionSizeUsd}
            walletUsedPct={metrics.walletUsedPct}
            liquidationRisk={metrics.liquidationRisk}
            onAmountChange={setAmountUsd}
            onLeverageChange={setLeverage}
            onSideChange={setSide}
            lockSide={isManageMode}
            panelTitle={isManageMode ? 'Margin (add / reduce)' : 'Order'}
            hideLiquidationFooter={isManageMode}
          />

          {!isManageMode ? (
            <PreTradeWarningCard
              walletUsedPct={metrics.walletUsedPct}
              leverage={metrics.leverage}
              riskLevel={metrics.liquidationRisk}
              riskMeterPct={metrics.riskSummary.riskMeterPct}
              tradeScore={metrics.riskSummary.tradeScore}
              setupTradeConflictMessage={metrics.riskSummary.setupTradeConflictMessage}
              walletImpactLabel={metrics.riskSummary.walletImpactLabel}
              primaryMessage={metrics.riskSummary.primaryMessage}
              warnings={metrics.riskSummary.warnings}
            />
          ) : null}

          {isManageMode ? (
            <div className="space-y-2.5">
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
          ) : (
            <button
              type="button"
              className={`w-full rounded-2xl py-4 text-base font-bold shadow-glow transition active:scale-[0.98] ${ctaClass}`}
            >
              <span className="block">{ctaLabel}</span>
              <span className="block text-sm font-semibold text-sigflo-bg/80">{ctaSub}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
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
