import { useMemo } from 'react';
import { ScannerInsightCard } from '@/components/trade/ScannerInsightCard';
import { OrderInputsCard } from '@/components/trade/OrderInputsCard';
import { PreTradeWarningCard } from '@/components/trade/PreTradeWarningCard';
import { formatQuoteNumber } from '@/lib/formatQuote';
import type { ManageTradePositionContext } from '@/lib/manageTradeContext';
import type { MarketRowStatus } from '@/types/markets';
import type { CryptoSignal } from '@/types/signal';
import type { DerivedTradeMetrics } from '@/lib/tradeRisk';
import { buildGroundedMarketContext } from '@/lib/buildGroundedMarketContext';
import type { MarketMode, TradeSide, TradeViewModel } from '@/types/trade';

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
  return `≈ $${Math.round(ctx.positionUsd).toLocaleString('en-US')} position size`;
}

export type TradeControlsProps = {
  manageDataInvalid: boolean;
  ticketIntent: string | null;
  /** Acknowledge close / size change — execution stays on the exchange. */
  onClosePosition?: () => void;
  onAddToPosition?: () => void;
  market: MarketMode;
  mergedModel: TradeViewModel;
  isManageMode: boolean;
  manageCtx: ManageTradePositionContext | null;
  managePnlDisplay: { pnlUsd: number; pnlPct: number } | null;
  markForManage: number;
  manageInsightLine: string | null;
  selectedSignal: CryptoSignal;
  scannerStatus: MarketRowStatus;
  amountUsd: number;
  leverage: number;
  side: TradeSide;
  stopStr: string;
  targetStr: string;
  onAmountChange: (n: number) => void;
  onLeverageChange: (n: number) => void;
  onStopStrChange: (s: string) => void;
  onTargetStrChange: (s: string) => void;
  metrics: DerivedTradeMetrics;
  estFeeUsd: number;
  balanceLabel?: string;
  balanceHelper?: string;
  /** Live UTA / wallet line for the balance readout; sizing still uses `metrics.balanceUsd`. */
  displayBalanceUsd?: number | null;
  fundingBalanceUsd?: number | null;
  fundingBalanceAsset?: string | null;
  minOrderUsd?: number | null;
  orderSymbol?: string | null;
  /** Futures: exchange max leverage for the symbol (slider + chips cap). */
  maxLeverage?: number | null;
  /** UTA margin locked (from exchange overview). */
  utaMarginInUseUsd?: number | null;
  /** Bybit UTA total equity (includes unrealized on exchange positions). */
  utaEquityUsd?: number | null;
  /** Bybit UTA unrealized PnL aggregate (exchange positions only). */
  utaUnrealizedPnlUsd?: number | null;
  /** Bybit UTA wallet balance (Bybit-reported; may differ from equity). */
  utaWalletBalanceUsd?: number | null;
  /** When set, Position size panel shows Transfer → exchange asset UI (Funding ↔ UTA). */
  assetTransferHref?: string | null;
  /** Active chart interval label for grounded AI context (e.g. 15m, 1H). */
  chartInterval: string;
};

export function TradeControls(props: TradeControlsProps) {
  const {
    manageDataInvalid,
    ticketIntent,
    onClosePosition,
    onAddToPosition,
    market,
    mergedModel,
    isManageMode,
    manageCtx,
    managePnlDisplay,
    markForManage,
    manageInsightLine,
    selectedSignal,
    scannerStatus,
    amountUsd,
    leverage,
    side,
    stopStr,
    targetStr,
    onAmountChange,
    onLeverageChange,
    onStopStrChange,
    onTargetStrChange,
    metrics,
    estFeeUsd,
    balanceLabel,
    balanceHelper,
    displayBalanceUsd,
    fundingBalanceUsd,
    fundingBalanceAsset,
    minOrderUsd,
    orderSymbol,
    maxLeverage,
    utaMarginInUseUsd,
    utaEquityUsd,
    utaUnrealizedPnlUsd,
    utaWalletBalanceUsd,
    assetTransferHref,
    chartInterval,
  } = props;

  const groundedAiContext = useMemo(
    () =>
      buildGroundedMarketContext({
        signal: selectedSignal,
        status: scannerStatus,
        tradeScore: metrics.riskSummary.tradeScore,
        market,
        chartInterval,
        model: mergedModel,
        recentCandles: mergedModel.chartCandles,
      }),
    [
      chartInterval,
      market,
      mergedModel,
      metrics.riskSummary.tradeScore,
      scannerStatus,
      selectedSignal,
    ],
  );

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col space-y-1 px-3 pb-4 pt-0">
      {manageDataInvalid ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2.5 text-center text-[11px] leading-snug text-amber-100/90">
          Could not load this position from the URL (missing pair, size, or side). Open the position from Portfolio
          again, or switch back to the trade scanner.
        </p>
      ) : null}
      {ticketIntent === 'close' ? (
        <div className="space-y-2 rounded-xl border border-rose-500/20 bg-rose-500/[0.07] px-3 py-2.5">
          <p className="text-center text-[11px] leading-snug text-rose-100/90">
            Plan your exit on the chart — closing still happens on the exchange.
          </p>
          {onClosePosition ? (
            <button
              type="button"
              onClick={onClosePosition}
              className="w-full rounded-xl border border-rose-400/40 bg-rose-500/[0.18] py-3 text-sm font-bold text-rose-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] transition hover:bg-rose-500/25 active:scale-[0.99]"
            >
              Close position
            </button>
          ) : null}
        </div>
      ) : null}
      {ticketIntent === 'add' ? (
        <div className="space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-2.5">
          <p className="text-center text-[11px] leading-snug text-emerald-100/90">
            Size up below to mirror how much more you want on this book.
          </p>
          {onAddToPosition ? (
            <button
              type="button"
              onClick={onAddToPosition}
              className="w-full rounded-xl bg-sigflo-accent py-3 text-sm font-bold text-sigflo-bg shadow-glow transition hover:brightness-110 active:scale-[0.99]"
            >
              Add to position
            </button>
          ) : null}
        </div>
      ) : null}

      {isManageMode && managePnlDisplay && manageCtx ? (
        <>
          <div
            className={`rounded-2xl border px-3 py-2.5 ${
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
                <dt className="text-sigflo-muted">Unrealized PnL (plan)</dt>
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

      {!isManageMode ? (
        <ScannerInsightCard
          signal={selectedSignal}
          status={scannerStatus}
          tradeScore={metrics.riskSummary.tradeScore}
          groundedContext={groundedAiContext}
        />
      ) : null}

      <OrderInputsCard
        market={market}
        balanceUsd={metrics.balanceUsd}
        displayBalanceUsd={displayBalanceUsd}
        amountUsd={amountUsd}
        leverage={leverage}
        side={side}
        positionSizeUsd={metrics.positionSizeUsd}
        walletUsedPct={metrics.walletUsedPct}
        liquidationRisk={metrics.liquidationRisk}
        onAmountChange={onAmountChange}
        onLeverageChange={onLeverageChange}
        onSideChange={() => {}}
        lockSide={isManageMode}
        showSideToggle={false}
        panelTitle={isManageMode ? 'Margin (add / reduce)' : 'Position size'}
        hideLiquidationFooter={isManageMode}
        quoteLastPrice={mergedModel.lastPrice}
        quotePair={mergedModel.pair}
        referenceEntryPrice={mergedModel.entry}
        balanceLabel={balanceLabel}
        balanceHelper={balanceHelper}
        fundingBalanceUsd={fundingBalanceUsd}
        fundingBalanceAsset={fundingBalanceAsset}
        minOrderUsd={minOrderUsd}
        orderSymbol={orderSymbol}
        maxLeverage={maxLeverage}
        utaMarginInUseUsd={utaMarginInUseUsd}
        utaEquityUsd={utaEquityUsd}
        utaUnrealizedPnlUsd={utaUnrealizedPnlUsd}
        utaWalletBalanceUsd={utaWalletBalanceUsd}
        assetTransferHref={assetTransferHref}
        stopInput={!isManageMode ? stopStr : undefined}
        takeProfitInput={!isManageMode ? targetStr : undefined}
        onStopInputChange={!isManageMode ? onStopStrChange : undefined}
        onTakeProfitInputChange={!isManageMode ? onTargetStrChange : undefined}
        compactStats={
          !isManageMode
            ? {
                marginUsd: metrics.amountUsedUsd,
                estFeeUsd,
                liquidationPrice: market === 'futures' ? metrics.liquidation : null,
                riskLevel: metrics.liquidationRisk,
                riskMeterPct: metrics.riskSummary.riskMeterPct,
              }
            : undefined
        }
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
    </div>
  );
}
