import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SigfloLogo } from '@/components/branding/SigfloLogo';
import { AiInsightCard } from '@/components/trade/AiInsightCard';
import { SetupContextCard } from '@/components/trade/SetupContextCard';
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
import {
  deriveMarketStatus,
  formatTradeScannerStateLine,
  inPlayMicroHeadline,
  inPlayStructureConfidence,
  parseMarketStatusQuery,
} from '@/lib/marketScannerRows';
import { setupScoreBandShort } from '@/lib/setupScore';
import { deriveTradeMetrics } from '@/lib/tradeRisk';
import type { CryptoSignal, SetupScoreLabel, SignalRiskTag, SignalSetupTag } from '@/types/signal';
import type { MarketMode, TradeSide } from '@/types/trade';

function fmtUsd(n: number, opts?: { signed?: boolean }) {
  const body = formatQuoteNumber(Math.abs(n));
  if (opts?.signed && n < 0) return `−$${body}`;
  if (opts?.signed && n > 0) return `+$${body}`;
  return `$${body}`;
}

/** Compact line for primary CTA: `$2,500 • -$506 / +$752` */
function ctaRiskRewardLine(amountUsd: number, stopLossUsd: number, targetProfitUsd: number) {
  const amt = `$${Math.round(amountUsd).toLocaleString('en-US')}`;
  const loss = `-$${Math.round(Math.abs(stopLossUsd)).toLocaleString('en-US')}`;
  const gain = `+$${Math.round(Math.abs(targetProfitUsd)).toLocaleString('en-US')}`;
  return `${amt} • ${loss} / ${gain}`;
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

  const pairFromQuery = params.get('pair');
  const model = useMemo(() => {
    if (pairFromQuery && pairFromQuery.trim().length > 0) {
      return getMockTradeForPair(pairFromQuery);
    }
    return getMockTradeForSignalId(signalId);
  }, [pairFromQuery, signalId]);
  const selectedSignal = useMemo(() => {
    const fromQuery = buildSignalContextFromQuery(params, signalId);
    if (fromQuery) return fromQuery;
    return mockSignals.find((s) => s.id === signalId) ?? mockSignals[0];
  }, [params, signalId]);
  const scannerStatusForHeader = useMemo(() => {
    return parseMarketStatusQuery(params.get('marketStatus')) ?? deriveMarketStatus(selectedSignal);
  }, [params, selectedSignal]);
  const tradeScannerStateLine = useMemo(
    () => formatTradeScannerStateLine(scannerStatusForHeader, selectedSignal.setupType),
    [scannerStatusForHeader, selectedSignal.setupType],
  );
  const insightActiveHeadline = useMemo(
    () =>
      scannerStatusForHeader === 'triggered' ? inPlayMicroHeadline(selectedSignal.setupType) : null,
    [scannerStatusForHeader, selectedSignal.setupType],
  );
  const insightActiveStructure = useMemo(
    () =>
      scannerStatusForHeader === 'triggered' ? inPlayStructureConfidence(selectedSignal) : null,
    [scannerStatusForHeader, selectedSignal],
  );
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
  }, [live.change24hPct, live.chartCandles, live.high24h, live.lastPrice, live.low24h, live.priceSeries, live.volume24h, model]);
  const isSpot = market === 'spot';
  const metrics = useMemo(
    () => deriveTradeMetrics(mergedModel, { amountUsd, leverage, side, market, setupScore: selectedSignal.setupScore }),
    [amountUsd, leverage, market, mergedModel, selectedSignal.setupScore, side],
  );
  const aiSummary = useMemo(() => {
    if (metrics.liquidationRisk === 'High') {
      return 'Risk is elevated due to leverage and wallet exposure. A smaller size would improve flexibility.';
    }
    if (metrics.walletUsedPct > 20) {
      return 'This trade risks more than your average position size. Consider scaling in rather than committing at once.';
    }
    if (mergedModel.change24hPct > 2) {
      return 'Price is moving into resistance - entries here increase pullback risk. Patience may improve your average.';
    }
    return 'Structure is steady and risk remains controlled at this size.';
  }, [metrics.liquidationRisk, metrics.walletUsedPct, mergedModel.change24hPct]);
  const ctaLabel = side === 'long' ? 'Submit Long' : 'Submit Short';

  return (
    <div className="min-h-[100dvh] bg-sigflo-bg pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-lg px-4">
        <header className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sigflo-text transition hover:bg-white/[0.08]"
            aria-label="Back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex flex-1 items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-400/80">Trade</p>
              <h1 className="text-xl font-semibold tracking-tight text-white">{mergedModel.pair}</h1>
              <p className="mt-0.5 text-xs text-sigflo-muted">
                <span className="text-sigflo-text">{fmtUsd(mergedModel.lastPrice)}</span>{' '}
                <span className={mergedModel.change24hPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                  {mergedModel.change24hPct >= 0 ? '+' : ''}
                  {mergedModel.change24hPct.toFixed(2)}%
                </span>
                <span
                  className={`ml-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide ${
                    live.connection === 'connected'
                      ? 'text-emerald-200'
                      : live.connection === 'reconnecting'
                        ? 'text-amber-200'
                        : 'text-sigflo-muted'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      live.connection === 'connected'
                        ? 'animate-pulse bg-emerald-300'
                        : live.connection === 'reconnecting'
                          ? 'animate-pulse bg-amber-300'
                          : 'bg-slate-500'
                    }`}
                  />
                  {live.connection === 'connected'
                    ? 'Live'
                    : live.connection === 'reconnecting'
                      ? 'Reconnecting'
                      : 'REST'}
                </span>
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wide text-sigflo-muted">
                {live.mode} • {live.connection}
              </p>
            </div>
            <SigfloLogo size={30} glowing />
          </div>
        </header>

        <section
          className="mb-4 rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/[0.1] via-sigflo-surface/80 to-cyan-500/[0.08] px-4 py-3.5 shadow-[0_0_28px_-8px_rgba(52,211,153,0.25)] ring-1 ring-emerald-400/15"
          aria-label="Scanner summary"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200/85">Scanner</p>
          <p className="mt-2 text-lg font-semibold tracking-tight text-white">
            Setup Score: {selectedSignal.setupScore}{' '}
            <span className="text-emerald-100/95">({setupScoreBandShort(selectedSignal)})</span>
          </p>
          <p className="mt-1.5 text-sm font-semibold tracking-tight text-cyan-100">{tradeScannerStateLine}</p>
        </section>

        <div className="space-y-4">
          <MarketToggle value={market} onChange={setMarket} />
          {market === 'spot' && (
            <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
              Spot mode is preview-only; sizing below assumes futures-style risk display.
            </p>
          )}
          <MarketStatsRow model={mergedModel} />
          <div className="flex items-center justify-end gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(
              [
                { value: '5', label: '5m' },
                { value: '15', label: '15m' },
                { value: '60', label: '1h' },
                { value: '240', label: '4h' },
                { value: 'D', label: '1D' },
                { value: 'W', label: '1W' },
              ] as const
            ).map((intv) => (
              <button
                key={intv.value}
                type="button"
                onClick={() => {
                  setChartInterval(intv.value);
                  window.localStorage.setItem('sigflo.trade.chartInterval', intv.value);
                }}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                  chartInterval === intv.value
                    ? 'bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/40'
                    : 'border border-white/10 bg-white/[0.03] text-sigflo-muted'
                }`}
              >
                {intv.label}
              </button>
            ))}
          </div>
          <PriceChartCard
            model={mergedModel}
            market={market}
            intervalLabel={
              chartInterval === 'D' ? '1D' : chartInterval === 'W' ? '1W' : chartInterval === '60' ? '1h' : chartInterval === '240' ? '4h' : `${chartInterval}m`
            }
            loadingInterval={live.loadingInterval}
            liveUpdatedAt={live.lastUpdateTs}
          />
          <SetupContextCard signal={selectedSignal} />
          <AiInsightCard
            insight={{ ...model.aiInsight, summary: aiSummary }}
            activeHeadline={insightActiveHeadline}
            activeStructureNote={insightActiveStructure}
          />
          <OrderInputsCard
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
          <button
            type="button"
            className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 py-4 text-base font-bold text-sigflo-bg shadow-glow transition hover:brightness-110 active:scale-[0.995]"
          >
            <span className="block">{isSpot ? (side === 'long' ? 'Buy' : 'Sell') : ctaLabel}</span>
            <span className="mt-1 block text-sm font-semibold tracking-tight text-sigflo-bg/95">
              {ctaRiskRewardLine(metrics.amountUsedUsd, metrics.stopLossUsd, metrics.targetProfitUsd)}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Bybit linear symbol (e.g. BTCUSDT) — never pass display strings like `BTC / USDT`. */
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
  const tags = tagsRaw
    .split(',')
    .map((t) => t.trim())
    .filter((t): t is SignalSetupTag => t === 'Breakout' || t === 'Pullback' || t === 'Overextended');
  const setupScoreLabel = (params.get('setupScoreLabel') ?? 'Developing') as SetupScoreLabel;
  const riskTag = (params.get('riskTag') ?? 'Medium Risk') as SignalRiskTag;
  const side = (params.get('side') ?? 'long') as 'long' | 'short';
  return {
    id: signalId,
    pair,
    side,
    biasLabel: params.get('biasLabel') ?? (side === 'long' ? 'Potential Long' : 'Potential Short'),
    setupScore,
    setupScoreLabel,
    setupType:
      (params.get('setupType') as 'breakout' | 'pullback' | 'overextended' | null) ?? 'breakout',
    scoreBreakdown: {
      trendAlignment: trend,
      momentumQuality: momentum,
      structureQuality: structure,
      volumeConfirmation: volume,
      riskConditions: risk,
    },
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
