import { setupBandDockEmphasisClass } from '@/lib/setupBandUi';
import type { TradeTimingChipState } from '@/lib/tradeTimingChip';
import { StatusChip } from '@/components/trade/StatusChip';
import type { MarketMode } from '@/types/trade';

/**
 * Chart-inline SHORT/LONG (`ChartInlineTradeButtons`) with optional bias emphasis + `dockMeta`.
 * Primary ticket actions also flow through `TradeControls` on `TradeScreen`.
 *
 * Props below: compact Short/Long (or Sell/Buy) embedded in the chart timeframe row or assistant strip.
 */
export type ChartTradeQuickActions = {
  market: MarketMode;
  canExecute: boolean;
  onOpenShort: () => void;
  onOpenLong: () => void;
  flashSide?: 'long' | 'short' | null;
};

export type ChartDockDecisionMeta = {
  confidenceLabel: string;
  setupQualityLabel: string;
  timing: { label: string; state: TradeTimingChipState };
};

type ChartInlineTradeButtonsProps = ChartTradeQuickActions & {
  /** Tighter pills for the sticky price-chart dock row. */
  variant?: 'default' | 'dock';
  /** Signal bias: emphasized side gets a subtle glow; the other is slightly dimmed. */
  signalBias?: 'long' | 'short' | null;
  /** Micro copy under dock buttons (confidence, setup quality, timing chip). */
  dockMeta?: ChartDockDecisionMeta | null;
};

/** Compact Short/Long (or Sell/Buy) — e.g. price-chart dock or assistant row. */
export function ChartInlineTradeButtons({
  market,
  canExecute,
  onOpenShort,
  onOpenLong,
  flashSide,
  variant = 'default',
  signalBias = null,
  dockMeta = null,
}: ChartInlineTradeButtonsProps) {
  const isSpot = market === 'spot';
  const shortLabel = isSpot ? 'Sell' : 'Short';
  const longLabel = isSpot ? 'Buy' : 'Long';
  const disabledHint = !canExecute ? 'Set a position size and ensure balance is available' : undefined;
  const btnBase =
    variant === 'dock'
      ? 'inline-flex h-[31px] min-w-[3.42rem] items-center justify-center rounded-[7px] px-[10px] py-0 text-[12px] font-bold leading-none sm:h-[34px] sm:min-w-[3.72rem] sm:px-[11px] sm:text-[13px]'
      : 'px-2 py-1 text-[10px] rounded-md';

  const shortDim =
    variant === 'dock' && signalBias === 'long' ? 'opacity-[0.72] brightness-[0.92] saturate-[0.92]' : '';
  const longDim =
    variant === 'dock' && signalBias === 'short' ? 'opacity-[0.72] brightness-[0.92] saturate-[0.92]' : '';
  const shortGlow =
    variant === 'dock' && signalBias === 'short'
      ? 'shadow-[0_0_22px_-4px_rgba(248,113,113,0.55)] ring-1 ring-rose-200/45'
      : flashSide === 'short'
        ? 'ring-1 ring-red-200/80'
        : 'ring-1 ring-rose-400/25';
  const longGlow =
    variant === 'dock' && signalBias === 'long'
      ? 'shadow-[0_0_22px_-4px_rgba(52,211,153,0.5)] ring-1 ring-emerald-200/50'
      : flashSide === 'long'
        ? 'ring-1 ring-emerald-200/80'
        : 'ring-1 ring-emerald-400/25';

  const buttons = (
    <div
      className={`flex shrink-0 items-center ${variant === 'dock' ? 'gap-[5px]' : 'gap-px sm:gap-0.5'}`}
      role="group"
      aria-label="Open trade"
    >
      <button
        type="button"
        disabled={!canExecute}
        title={disabledHint}
        onClick={onOpenShort}
        className={`bg-gradient-to-b from-rose-500/95 to-rose-600 font-bold uppercase leading-tight tracking-wide text-white shadow-[0_0_14px_-5px_rgba(239,68,68,0.45)] transition duration-200 ease-out enabled:active:scale-[0.98] enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 ${variant === 'dock' ? '' : 'shrink-0'} ${btnBase} ${shortDim} ${shortGlow}`}
      >
        {shortLabel}
      </button>
      <button
        type="button"
        disabled={!canExecute}
        title={disabledHint}
        onClick={onOpenLong}
        className={`bg-gradient-to-b from-emerald-500/95 to-emerald-600 font-bold uppercase leading-tight tracking-wide text-white shadow-[0_0_14px_-5px_rgba(34,197,94,0.4)] transition duration-200 ease-out enabled:active:scale-[0.98] enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 ${variant === 'dock' ? '' : 'shrink-0'} ${btnBase} ${longDim} ${longGlow}`}
      >
        {longLabel}
      </button>
    </div>
  );

  if (variant === 'dock' && dockMeta) {
    const dockTealGlow =
      'font-semibold text-cyan-200/95 [text-shadow:0_0_6px_rgba(0,255,200,0.55),0_0_14px_rgba(0,255,200,0.3)]';
    return (
      <div className="flex max-w-[min(100%,24rem)] flex-wrap items-center justify-center gap-x-[6px] gap-y-1">
        <div className="-translate-x-1 sm:-translate-x-1.5">{buttons}</div>
        <div className="flex min-w-0 max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <div
            className="grid grid-cols-2 grid-rows-2 overflow-hidden rounded-md border border-white/[0.14] text-[8px] font-medium tabular-nums text-sigflo-muted/90 sm:text-[10px]"
            title={`Trade score ${dockMeta.confidenceLabel} (readiness). Setup tier ${dockMeta.setupQualityLabel} (signal structure).`}
          >
            <span className="flex min-h-[1.4rem] items-center justify-center border-r border-b border-white/[0.1] px-1 py-0.5 leading-none text-sigflo-muted/90">
              Trade
            </span>
            <span className="flex min-h-[1.4rem] items-center justify-center border-b border-white/[0.1] px-1 py-0.5 leading-none text-sigflo-muted/90">
              Setup
            </span>
            <span
              className={`flex min-h-[1.4rem] min-w-0 items-center justify-center border-r border-white/[0.1] px-1 py-0.5 text-center leading-none tabular-nums ${setupBandDockEmphasisClass(dockMeta.setupQualityLabel)}`}
            >
              <span className="min-w-0 truncate">
                {dockMeta.setupQualityLabel === 'Developing' ? 'Building' : dockMeta.setupQualityLabel}
              </span>
            </span>
            <span className={`flex min-h-[1.4rem] items-center justify-center px-1 py-0.5 leading-none tabular-nums ${dockTealGlow}`}>
              {dockMeta.confidenceLabel}
            </span>
          </div>
          {dockMeta.timing.state !== 'developing' ? (
            <StatusChip label={dockMeta.timing.label} state={dockMeta.timing.state} compact />
          ) : null}
        </div>
      </div>
    );
  }

  return buttons;
}

export function TradeActionBar(props: {
  market: MarketMode;
  canExecute: boolean;
  onOpenShort: () => void;
  onOpenLong: () => void;
  /** Brief glow after tap (instant execution feedback). */
  flashSide?: 'long' | 'short' | null;
  className?: string;
  /** Card-style block inside scroll content (vs full-width dock chrome). */
  embedded?: boolean;
}) {
  const { market, canExecute, onOpenShort, onOpenLong, flashSide, className = '', embedded = false } = props;

  const isSpot = market === 'spot';
  const primaryShort = isSpot ? 'Sell' : 'Open Short';
  const primaryLong = isSpot ? 'Buy' : 'Open Long';
  const disabledHint = !canExecute ? 'Set a position size and ensure balance is available' : undefined;

  return (
    <div
      className={`pointer-events-auto px-3 ${
        embedded
          ? 'rounded-2xl border border-white/[0.1] bg-black/35 py-3 shadow-[0_12px_40px_-28px_rgba(0,0,0,0.85)] backdrop-blur-sm'
          : 'bg-black/75 pt-3 backdrop-blur-xl'
      } ${className}`}
    >
      <div className="mx-auto max-w-lg space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!canExecute}
            title={disabledHint}
            onClick={onOpenShort}
            className={`flex min-h-[3.5rem] flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-rose-500 to-rose-600 px-2 py-2 text-[15px] font-bold text-white shadow-[0_10px_32px_-10px_rgba(239,68,68,0.55)] transition enabled:active:scale-[0.98] enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 ${
              flashSide === 'short' ? 'ring-2 ring-red-200/90 shadow-[0_0_28px_-4px_rgba(248,113,113,0.55)]' : ''
            }`}
          >
            <span className="inline-flex items-center gap-1">
              <span aria-hidden>↓</span>
              {primaryShort}
            </span>
            <span className="mt-0.5 text-[10px] font-semibold text-white/85">Market · Instant</span>
          </button>
          <button
            type="button"
            disabled={!canExecute}
            title={disabledHint}
            onClick={onOpenLong}
            className={`flex min-h-[3.5rem] flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-2 py-2 text-[15px] font-bold text-white shadow-[0_10px_32px_-10px_rgba(34,197,94,0.5)] transition enabled:active:scale-[0.98] enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 ${
              flashSide === 'long' ? 'ring-2 ring-emerald-200/90 shadow-[0_0_28px_-4px_rgba(0,255,200,0.45)]' : ''
            }`}
          >
            <span className="inline-flex items-center gap-1">
              <span aria-hidden>↑</span>
              {primaryLong}
            </span>
            <span className="mt-0.5 text-[10px] font-semibold text-white/85">Market · Instant</span>
          </button>
        </div>
      </div>
      <p
        className={`mx-auto mt-2 flex max-w-lg items-center justify-center gap-1.5 text-[10px] text-sigflo-muted ${
          embedded ? 'pb-0' : 'pb-[max(0.5rem,env(safe-area-inset-bottom))]'
        }`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0 text-emerald-400/80" aria-hidden>
          <path
            d="M12 3l7 4v5c0 5-3 9-7 10-4-1-7-5-7-10V7l7-4z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        Trades execute instantly — plan size and risk before you tap.
      </p>
    </div>
  );
}
