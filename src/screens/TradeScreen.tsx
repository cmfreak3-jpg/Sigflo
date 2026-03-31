import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LiveBadge } from '@/components/ui/LiveBadge';
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
import { deriveMarketStatus, parseMarketStatusQuery } from '@/lib/marketScannerRows';
import { deriveTradeMetrics } from '@/lib/tradeRisk';
import type { CryptoSignal, SetupScoreLabel, SignalRiskTag, SignalSetupTag } from '@/types/signal';
import type { MarketMode, TradeSide } from '@/types/trade';

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

  const pairFromQuery = params.get('pair');
  const model = useMemo(() => {
    if (pairFromQuery && pairFromQuery.trim().length > 0) return getMockTradeForPair(pairFromQuery);
    return getMockTradeForSignalId(signalId);
  }, [pairFromQuery, signalId]);

  const selectedSignal = useMemo(() => {
    const fromQuery = buildSignalContextFromQuery(params, signalId);
    if (fromQuery) return fromQuery;
    return mockSignals.find((s) => s.id === signalId) ?? mockSignals[0];
  }, [params, signalId]);

  const scannerStatus = useMemo(
    () => parseMarketStatusQuery(params.get('marketStatus')) ?? deriveMarketStatus(selectedSignal),
    [params, selectedSignal],
  );
  const isTriggered = scannerStatus === 'triggered';

  const liveSymbol = useMemo(() => pairBaseToLinearSymbol(selectedSignal.pair), [selectedSignal.pair]);
  const live = useLiveTradeMarket(liveSymbol, chartInterval);

  const mergedModel = useMemo(() => {
    const next = { ...model };
    if (live.lastPrice != null) next.lastPrice = live.lastPrice;
    if (live.change24hPct != null) next.change24hPct = live.change24hPct;
    if (live.high24h != null) next.high24h = live.high24h;
    if (live.low24h != null) next.low24h = live.low24h;
    if (live.volume24h != null) next.volume24h = live.volume24h;
    if (live.priceSeries && live.priceSeries.length > 20) next.priceSeries = live.priceSeries;
    if (live.chartCandles && live.chartCandles.length > 20) next.chartCandles = live.chartCandles;
    return next;
  }, [live, model]);

  const metrics = useMemo(
    () => deriveTradeMetrics(mergedModel, { amountUsd, leverage, side, market, setupScore: selectedSignal.setupScore }),
    [amountUsd, leverage, market, mergedModel, selectedSignal.setupScore, side],
  );

  const ctaLabel = market === 'spot' ? (side === 'long' ? 'Buy' : 'Sell') : side === 'long' ? 'Enter Long' : 'Enter Short';
  const ctaSub = `${side === 'long' ? '-' : '-'}$${Math.round(Math.abs(metrics.stopLossUsd)).toLocaleString()} / +$${Math.round(Math.abs(metrics.targetProfitUsd)).toLocaleString()}`;
  const ctaClass =
    market === 'spot' && side === 'short'
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
          <div className="flex flex-1 items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">{mergedModel.pair}</h1>
              <div className="mt-0.5 flex items-center gap-2 text-xs">
                <span className="font-bold tabular-nums text-white">${formatQuoteNumber(mergedModel.lastPrice)}</span>
                <span className={mergedModel.change24hPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {mergedModel.change24hPct >= 0 ? '+' : ''}{mergedModel.change24hPct.toFixed(2)}%
                </span>
              </div>
            </div>
            {isTriggered ? <LiveBadge /> : (
              <span className="text-[11px] text-sigflo-muted">{live.mode} · {live.connection}</span>
            )}
          </div>
        </header>

        <div className="space-y-3">
          <MarketToggle value={market} onChange={setMarket} />
          <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max items-center gap-3 pr-1">
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

          <ScannerInsightCard signal={selectedSignal} status={scannerStatus} tradeScore={metrics.riskSummary.tradeScore} />

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
          />

          <TradeSummaryCard
            market={market}
            model={{
              balanceUsd: metrics.balanceUsd,
              amountUsedUsd: metrics.amountUsedUsd,
              leverage: metrics.leverage,
              positionSizeUsd: metrics.positionSizeUsd,
              targetProfitUsd: metrics.targetProfitUsd,
              stopLossUsd: metrics.stopLossUsd,
              liquidation: metrics.liquidation,
              riskReward: mergedModel.riskReward,
            }}
          />

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

          {/* CTA */}
          <button
            type="button"
            className={`w-full rounded-2xl py-4 text-base font-bold shadow-glow transition active:scale-[0.98] ${ctaClass}`}
          >
            <span className="block">{ctaLabel}</span>
            <span className="block text-sm font-semibold text-sigflo-bg/80">{ctaSub}</span>
          </button>
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
