import { ScannerInsightCard } from '@/components/trade/ScannerInsightCard';
import { OrderInputsCard } from '@/components/trade/OrderInputsCard';
import { PreTradeWarningCard } from '@/components/trade/PreTradeWarningCard';
import { formatQuoteNumber } from '@/lib/formatQuote';
import type { ManageTradePositionContext } from '@/lib/manageTradeContext';
import type { MarketRowStatus } from '@/types/markets';
import type { CryptoSignal } from '@/types/signal';
import type { DerivedTradeMetrics } from '@/lib/tradeRisk';
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
};

export function TradeControls(props: TradeControlsProps) {
  const {
    manageDataInvalid,
    ticketIntent,
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
  } = props;

  return (
    <div className="mx-auto max-w-lg space-y-1 px-4 pb-4 pt-0">
      {manageDataInvalid ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2.5 text-center text-[11px] leading-snug text-amber-100/90">
          Position data unavailable — showing new trade layout.
        </p>
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

      <OrderInputsCard
        market={market}
        balanceUsd={metrics.balanceUsd}
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
        <ScannerInsightCard signal={selectedSignal} status={scannerStatus} tradeScore={metrics.riskSummary.tradeScore} />
      ) : null}

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
