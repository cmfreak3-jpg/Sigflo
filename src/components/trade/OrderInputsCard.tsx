import { useEffect, useMemo, useRef, useState } from 'react';
import { useHoldStepper } from '@/hooks/useHoldStepper';
import { RiskSegmentMeter } from '@/components/ui/RiskSegmentMeter';
import type { MarketMode, RiskLevel, TradeSide } from '@/types/trade';
import { formatQuoteNumber } from '@/lib/formatQuote';
import { formatFundingBalance } from '@/lib/formatFundingBalance';
import {
  BYBIT_APP_ASSETS_HOME_HREF,
  BYBIT_TRANSFER_HELP_HREF,
  BYBIT_USER_ASSETS_EXCHANGE_HREF,
} from '@/lib/exchangeTransferUrls';

function fmtUsd2(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function money(n: number) {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function moneyTight(n: number) {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1000) return `$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${abs.toFixed(2)}`;
}

function roundUsd(n: number): number {
  return Math.round(n * 100) / 100;
}

const AMOUNT_INPUT_STEP_USD = 0.01;

/** Hard cap on native range `max` so the control stays responsive (avoid millions of DOM steps). */
const AMOUNT_SLIDER_INDEX_CAP = 500_000;

/**
 * How many discrete positions the amount slider uses: high enough for ~cent-level deltas on
 * typical balances; capped so a linear 0…`amountMax` slider is not limited by screen pixels.
 */
function computeAmountSliderIndexMax(amountMax: number): number {
  if (!Number.isFinite(amountMax) || amountMax <= 0) return 1;
  const idealCents = Math.ceil(amountMax / 0.01);
  return Math.min(AMOUNT_SLIDER_INDEX_CAP, Math.max(200, idealCents));
}

function amountUsdToSliderIndex(amountUsd: number, amountMax: number, indexMax: number): number {
  if (!(amountMax > 0) || indexMax <= 0) return 0;
  const a = Math.max(0, Math.min(amountMax, Number.isFinite(amountUsd) ? amountUsd : 0));
  const idx = Math.round((a / amountMax) * indexMax);
  return Math.min(indexMax, Math.max(0, idx));
}

function sliderIndexToAmountUsd(idx: number, amountMax: number, indexMax: number): number {
  if (!(amountMax > 0) || indexMax <= 0 || !Number.isFinite(idx)) return 0;
  const i = Math.min(indexMax, Math.max(0, Math.round(idx)));
  const raw = (i / indexMax) * amountMax;
  if (!Number.isFinite(raw)) return 0;
  return roundUsd(Math.min(amountMax, Math.max(0, raw)));
}

/** Stop loss: adverse move from entry as % of price (0–100). */
const STOP_LOSS_DISTANCE_PCT_CHIPS = [0, 5, 10, 15, 25, 50, 75, 100] as const;

/** Take profit: favorable move from entry (percent → internal bps: 1 bp = 0.01%). */
const TAKE_PROFIT_DISTANCE_PCT_CHIPS = [50, 100, 150, 300] as const;

function distancePctToBps(pct: number): number {
  return Math.round(pct * 100);
}

/** Wider match band for large %-from-entry distances (manual price rarely lands on exact bps). */
function bpsChipToleranceForTarget(targetBps: number): number {
  return Math.max(100, Math.round(targetBps * 0.02));
}

function takeProfitPriceFromBps(entry: number, tradeSide: TradeSide, bps: number): number {
  const m = bps / 10000;
  return tradeSide === 'long' ? entry * (1 + m) : entry * (1 - m);
}

function stopPriceFromBps(entry: number, tradeSide: TradeSide, bps: number): number {
  const m = bps / 10000;
  return tradeSide === 'long' ? entry * (1 - m) : entry * (1 + m);
}

function impliedTakeProfitBps(entry: number, tradeSide: TradeSide, tp: number): number | null {
  if (!(entry > 0) || !Number.isFinite(tp)) return null;
  const raw =
    tradeSide === 'long' ? ((tp - entry) / entry) * 10000 : ((entry - tp) / entry) * 10000;
  if (!Number.isFinite(raw)) return null;
  return Math.round(raw);
}

function impliedStopBps(entry: number, tradeSide: TradeSide, stop: number): number | null {
  if (!(entry > 0) || !Number.isFinite(stop)) return null;
  const raw =
    tradeSide === 'long' ? ((entry - stop) / entry) * 10000 : ((stop - entry) / entry) * 10000;
  if (!Number.isFinite(raw)) return null;
  return Math.round(raw);
}

function bpsChipActive(implied: number | null, targetBps: number, tolerance = 12): boolean {
  if (implied == null) return false;
  return Math.abs(implied - targetBps) <= tolerance;
}

export function OrderInputsCard(props: {
  market: MarketMode;
  balanceUsd: number;
  /**
   * Live exchange line for the balance *display* (e.g. UTA available). When omitted, `balanceUsd` is shown.
   * Sizing / slider max still use `balanceUsd` so demo floors can apply when the exchange reports $0 available.
   */
  displayBalanceUsd?: number | null;
  amountUsd: number;
  leverage: number;
  side: TradeSide;
  positionSizeUsd: number;
  walletUsedPct: number;
  liquidationRisk: RiskLevel;
  onAmountChange: (v: number) => void;
  onLeverageChange: (v: number) => void;
  onSideChange: (s: TradeSide) => void;
  /** When true, Long/Short toggles are hidden (manage open leg or external execution buttons). */
  lockSide?: boolean;
  /** When false, the in-card Long/Short toggle is omitted (default false). */
  showSideToggle?: boolean;
  panelTitle?: string;
  hideLiquidationFooter?: boolean;
  /** Optional stop / take-profit price fields (USD quote). */
  stopInput?: string;
  takeProfitInput?: string;
  onStopInputChange?: (v: string) => void;
  onTakeProfitInputChange?: (v: string) => void;
  /** For ≈ base size line and SL/TP % hints. */
  quoteLastPrice?: number;
  quotePair?: string;
  referenceEntryPrice?: number;
  /** Explicit account label (e.g. "Available to Trade"). */
  balanceLabel?: string;
  /** Optional helper under balance label. */
  balanceHelper?: string;
  /** Funding account primary line — informational, not used for sizing. */
  fundingBalanceUsd?: number | null;
  /** Asset for `fundingBalanceUsd` (e.g. AUD, USDT). */
  fundingBalanceAsset?: string | null;
  /** Minimum order notional for selected market/symbol (USD). */
  minOrderUsd?: number | null;
  /** Selected execution symbol (e.g. BTCUSDT) for validation messaging. */
  orderSymbol?: string | null;
  /** Futures: max leverage for this contract (from exchange instruments); defaults to 200 until known. */
  maxLeverage?: number | null;
  /** Unified trading account: margin / collateral in use (USD), from exchange overview. */
  utaMarginInUseUsd?: number | null;
  /** UTA equity from Bybit (includes unrealized PnL on real positions). */
  utaEquityUsd?: number | null;
  /** Aggregate unrealized PnL on exchange (UTA / perps); not related to practice positions in Sigflo. */
  utaUnrealizedPnlUsd?: number | null;
  /** UTA wallet balance from Bybit (distinct from equity when positions are open). */
  utaWalletBalanceUsd?: number | null;
  /**
   * When set, shows a Transfer control that opens the exchange transfer UI in a new tab
   * (e.g. Bybit Funding ↔ Unified Trading Account). Sigflo does not submit orders from the app yet (any key type).
   */
  assetTransferHref?: string | null;
  /** Inline summary: margin, fee, liq, risk — shown above the footer row when provided. */
  compactStats?: {
    marginUsd: number;
    estFeeUsd: number;
    liquidationPrice: number | null;
    riskLevel?: RiskLevel;
    riskMeterPct?: number;
  };
}) {
  const {
    market,
    balanceUsd,
    displayBalanceUsd,
    amountUsd,
    leverage,
    side,
    positionSizeUsd,
    walletUsedPct,
    liquidationRisk,
    onAmountChange,
    onLeverageChange,
    onSideChange,
    lockSide = false,
    showSideToggle = false,
    panelTitle = 'Position',
    hideLiquidationFooter = false,
    stopInput,
    takeProfitInput,
    onStopInputChange,
    onTakeProfitInputChange,
    compactStats,
    quoteLastPrice,
    quotePair,
    referenceEntryPrice,
    balanceLabel = 'Wallet Balance',
    balanceHelper,
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
  } = props;
  const balanceShown =
    displayBalanceUsd != null && Number.isFinite(displayBalanceUsd) ? displayBalanceUsd : balanceUsd;
  const amountMax = Math.max(0, Number.isFinite(balanceUsd) ? balanceUsd : 0);
  const amountInputStep = AMOUNT_INPUT_STEP_USD;
  const amountSliderIndexMax = computeAmountSliderIndexMax(amountMax);
  const amountSliderUiIndexRaw = amountUsdToSliderIndex(amountUsd, amountMax, amountSliderIndexMax);
  const amountSliderUiIndex = Number.isFinite(amountSliderUiIndexRaw)
    ? Math.min(amountSliderIndexMax, Math.max(0, Math.round(amountSliderUiIndexRaw)))
    : 0;
  const clampAmount = (n: number) => roundUsd(Math.max(0, Math.min(amountMax, Number.isFinite(n) ? n : 0)));

  const amountUsdRef = useRef(amountUsd);
  amountUsdRef.current = amountUsd;
  const holdAmountUp = useHoldStepper(() => {
    onAmountChange(clampAmount(amountUsdRef.current + amountInputStep));
  });
  const holdAmountDown = useHoldStepper(() => {
    onAmountChange(clampAmount(amountUsdRef.current - amountInputStep));
  });

  const [slEnabled, setSlEnabled] = useState(false);
  const [tpEnabled, setTpEnabled] = useState(false);
  const [marginMode, setMarginMode] = useState<'cross' | 'isolated'>('cross');

  const riskColor = liquidationRisk === 'High' ? 'text-rose-400' : liquidationRisk === 'Medium' ? 'text-amber-300' : 'text-emerald-400';

  const showLevels = Boolean(onStopInputChange && onTakeProfitInputChange && stopInput !== undefined && takeProfitInput !== undefined);

  const baseSymbol =
    quotePair?.includes('/') === true
      ? quotePair.split('/')[0]?.trim() || '—'
      : quotePair?.replace(/USDT$/i, '').trim() || '—';
  const baseApprox =
    quoteLastPrice != null && quoteLastPrice > 0 && Number.isFinite(positionSizeUsd)
      ? positionSizeUsd / quoteLastPrice
      : null;

  const feePctOfNotional =
    positionSizeUsd > 0 && compactStats ? (compactStats.estFeeUsd / positionSizeUsd) * 100 : 0;

  const entry = referenceEntryPrice;
  const stopN = stopInput != null ? parseFloat(String(stopInput).replace(/,/g, '')) : NaN;
  const tpN = takeProfitInput != null ? parseFloat(String(takeProfitInput).replace(/,/g, '')) : NaN;
  const stopPctHint =
    entry != null && entry > 0 && Number.isFinite(stopN) && stopN > 0
      ? ((stopN - entry) / entry) * 100 * (side === 'long' ? 1 : -1)
      : null;
  const tpPctHint =
    entry != null && entry > 0 && Number.isFinite(tpN) && tpN > 0
      ? ((tpN - entry) / entry) * 100 * (side === 'long' ? 1 : -1)
      : null;

  const entryNum = entry != null && entry > 0 ? entry : null;
  const slBpsImplied = entryNum != null ? impliedStopBps(entryNum, side, stopN) : null;
  const tpBpsImplied = entryNum != null ? impliedTakeProfitBps(entryNum, side, tpN) : null;

  const levMax =
    market === 'futures'
      ? Math.max(
          1,
          Math.min(
            200,
            Math.floor(
              maxLeverage != null && Number.isFinite(maxLeverage) && maxLeverage > 0 ? maxLeverage : 200,
            ),
          ),
        )
      : 1;
  const leverageChipLevels = useMemo(() => {
    const preset = [2, 5, 10, 25, 50, 100, 200].filter((x) => x <= levMax);
    if (levMax > 1 && !preset.includes(levMax)) {
      return [...preset, levMax].sort((a, b) => a - b);
    }
    return preset;
  }, [levMax]);
  const symbolLabel = (orderSymbol ?? quotePair ?? 'selected market').toUpperCase();
  const minOrderOk = minOrderUsd != null && Number.isFinite(minOrderUsd) && minOrderUsd > 0;
  const enteredAmountValid = Number.isFinite(amountUsd) && amountUsd > 0;
  const amountTooSmall = minOrderOk && enteredAmountValid && amountUsd < (minOrderUsd as number);
  /** Cent compare: 100% chip can land on rounded cap while float `amountMax` differs slightly. */
  const amountTooLarge =
    enteredAmountValid &&
    amountMax > 0 &&
    Math.round(amountUsd * 100) > Math.round(amountMax * 100);
  const balanceTooLowForMinimum = minOrderOk && amountMax > 0 && amountMax < (minOrderUsd as number);
  const sizeValidationMessage =
    amountMax <= 0
      ? 'Insufficient available balance'
      : balanceTooLowForMinimum
        ? 'Insufficient available balance'
        : amountTooLarge
          ? 'Insufficient available balance'
          : amountTooSmall
            ? `Minimum order for ${symbolLabel} is ${fmtUsd2(minOrderUsd as number)}`
            : null;

  const showUtaBreakdown = Boolean(balanceHelper);
  const showFundingWallet =
    fundingBalanceUsd != null && Number.isFinite(fundingBalanceUsd) && fundingBalanceUsd >= 0;

  const transferBtnClassName =
    'shrink-0 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] text-sigflo-muted/85 transition hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-sigflo-text/75';

  const [transferModalOpen, setTransferModalOpen] = useState(false);

  useEffect(() => {
    if (!transferModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTransferModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [transferModalOpen]);

  return (
    <div className="rounded-2xl border border-white/[0.1] bg-gradient-to-b from-white/[0.04] to-sigflo-surface/95 p-3 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.85)] backdrop-blur-sm space-y-3">
      <div className="flex items-start justify-between gap-2 text-xs text-sigflo-muted">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-sm font-bold text-white">{panelTitle}</span>
          {assetTransferHref && !showFundingWallet ? (
            <button
              type="button"
              title="Move funds on Bybit (Funding ↔ Unified)"
              onClick={() => setTransferModalOpen(true)}
              className={transferBtnClassName}
            >
              Transfer
            </button>
          ) : null}
        </div>
        <span className="shrink-0 max-w-[min(100%,18rem)] text-right">
          {showUtaBreakdown ? (
            <>
              <div
                className={`grid w-full max-w-md justify-end gap-1.5 sm:ml-auto ${utaEquityUsd != null && Number.isFinite(utaEquityUsd) ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} grid-cols-1`}
              >
                <div
                  className="min-w-0 rounded-lg border border-white/[0.1] bg-black/25 px-2 py-1.5 text-left"
                  title="Collateral available for new orders in your Bybit unified trading account"
                >
                  <span className="block text-[8px] font-semibold uppercase tracking-[0.12em] text-sigflo-muted">
                    Available (UTA)
                  </span>
                  <span className="block tabular-nums text-[11px] text-sigflo-text">{fmtUsd2(balanceShown)}</span>
                  <span className="block text-[8px] leading-tight text-sigflo-muted/80">For new orders</span>
                </div>
                <div
                  className="min-w-0 rounded-lg border border-white/[0.1] bg-black/25 px-2 py-1.5 text-left"
                  title="Margin and collateral reserved for open exchange positions and working orders"
                >
                  <span className="block text-[8px] font-semibold uppercase tracking-[0.12em] text-sigflo-muted">Margin in use</span>
                  <span className="block tabular-nums text-[11px] text-white/90">
                    {utaMarginInUseUsd != null && Number.isFinite(utaMarginInUseUsd) ? fmtUsd2(utaMarginInUseUsd) : '—'}
                  </span>
                  <span className="block text-[8px] leading-tight text-sigflo-muted/80">Exchange positions</span>
                </div>
                {utaEquityUsd != null && Number.isFinite(utaEquityUsd) ? (
                  <div
                    className="min-w-0 rounded-lg border border-white/[0.1] bg-black/25 px-2 py-1.5 text-left"
                    title="Total UTA equity per Bybit (includes unrealized PnL on real positions)"
                  >
                    <span className="block text-[8px] font-semibold uppercase tracking-[0.12em] text-sigflo-muted">Equity (UTA)</span>
                    <span className="block tabular-nums text-[11px] text-cyan-200/95">{fmtUsd2(utaEquityUsd)}</span>
                    <span className="block text-[8px] leading-tight text-sigflo-muted/80">Incl. unrealized (Bybit)</span>
                  </div>
                ) : null}
              </div>
              {utaUnrealizedPnlUsd != null && Number.isFinite(utaUnrealizedPnlUsd) ? (
                <span className="mt-1 block text-right text-[9px] tabular-nums text-sigflo-muted/85">
                  Unrealized PnL on exchange:{' '}
                  <span className={utaUnrealizedPnlUsd >= 0 ? 'text-emerald-200/90' : 'text-rose-200/90'}>
                    {utaUnrealizedPnlUsd >= 0 ? '+' : '−'}
                    {fmtUsd2(Math.abs(utaUnrealizedPnlUsd))}
                  </span>
                </span>
              ) : null}
              {utaWalletBalanceUsd != null &&
              Number.isFinite(utaWalletBalanceUsd) &&
              (utaEquityUsd == null ||
                !Number.isFinite(utaEquityUsd) ||
                Math.abs(utaWalletBalanceUsd - utaEquityUsd) > 0.02) ? (
                <span className="mt-0.5 block text-right text-[9px] tabular-nums text-sigflo-muted/75">
                  Wallet balance (UTA, Bybit): {fmtUsd2(utaWalletBalanceUsd)}
                </span>
              ) : null}
              <span className="mt-1 block text-[9px] text-sigflo-muted/80">{balanceHelper}</span>
            </>
          ) : (
            <>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-sigflo-muted/90">{balanceLabel}</span>
              <span className="block tabular-nums text-[11px] text-sigflo-text">{money(balanceShown)}</span>
              {balanceHelper ? <span className="block text-[9px] text-sigflo-muted/80">{balanceHelper}</span> : null}
            </>
          )}
          {showFundingWallet ? (
            <div className="mt-2 border-t border-white/[0.06] pt-2">
              <div className="flex w-full min-w-0 items-center justify-end gap-2">
                {assetTransferHref ? (
                  <button
                    type="button"
                    title="Move funds on Bybit (Funding ↔ Unified)"
                    onClick={() => setTransferModalOpen(true)}
                    className={`relative z-[1] -translate-x-6 ${transferBtnClassName}`}
                  >
                    Transfer
                  </button>
                ) : null}
                <span className="text-right text-[9px] font-semibold uppercase tracking-[0.08em] text-sigflo-muted/90">
                  Funding wallet
                </span>
              </div>
              <span className="mt-0.5 block tabular-nums text-[10px] text-sigflo-muted">
                {formatFundingBalance(fundingBalanceUsd, fundingBalanceAsset)}
              </span>
              <span
                className="mt-0.5 block max-w-[11rem] text-[8px] leading-tight text-sigflo-muted/75 sm:max-w-none"
                title="Separate deposit wallet — not included in Available / In use above until you transfer to UTA"
              >
                Not in unified trading — use Transfer to move funds to UTA for orders
              </span>
            </div>
          ) : null}
        </span>
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sigflo-muted">Amount (USD)</span>
        <div className="group relative">
          <input
            type="number"
            min={0}
            max={amountMax}
            step={amountInputStep}
            value={amountUsd || ''}
            onChange={(e) => {
              const n = Number(e.target.value || 0);
              onAmountChange(clampAmount(n));
            }}
            className="sigflo-number-input w-full rounded-xl border border-white/[0.08] bg-black/35 px-3 py-2.5 pr-11 text-sm text-white outline-none ring-sigflo-accent/30 placeholder:text-sigflo-muted focus:ring"
            placeholder="0"
          />
          <div className="absolute inset-y-1.5 right-1 flex w-7 flex-col gap-1">
            <button
              type="button"
              className="flex h-1/2 select-none items-center justify-center rounded border border-white/[0.08] bg-white/[0.06] text-[9px] leading-none text-sigflo-text transition hover:bg-white/[0.12]"
              aria-label="Increase amount"
              {...holdAmountUp}
            >
              +
            </button>
            <button
              type="button"
              className="flex h-1/2 select-none items-center justify-center rounded border border-white/[0.08] bg-white/[0.06] text-[9px] leading-none text-sigflo-text transition hover:bg-white/[0.12]"
              aria-label="Decrease amount"
              {...holdAmountDown}
            >
              −
            </button>
          </div>
        </div>
        {baseApprox != null ? (
          <p className="text-[11px] tabular-nums text-sigflo-muted">
            ≈ {formatQuoteNumber(baseApprox)} {baseSymbol}
          </p>
        ) : null}
        {sizeValidationMessage ? (
          <p className="text-[10px] font-medium text-amber-200/90">{sizeValidationMessage}</p>
        ) : minOrderOk ? (
          <p className="text-[10px] text-sigflo-muted/85">
            Minimum order for {symbolLabel}: {fmtUsd2(minOrderUsd as number)}
          </p>
        ) : null}
      </label>

      <div className="space-y-1.5">
        <input
          type="range"
          min={0}
          max={amountSliderIndexMax}
          step={1}
          value={amountSliderUiIndex}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isFinite(v)) return;
            onAmountChange(
              clampAmount(sliderIndexToAmountUsd(v, amountMax, amountSliderIndexMax)),
            );
          }}
          className="w-full accent-[#00ffc8]"
          aria-label="Amount slider"
        />
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {[
            { id: '10', label: '10%', v: 0.1 },
            { id: '25', label: '25%', v: 0.25 },
            { id: '50', label: '50%', v: 0.5 },
            { id: '100', label: '100%', v: 1 },
          ].map((chip) => {
            const target = roundUsd(amountMax * chip.v);
            const active =
              amountMax > 0 &&
              Math.abs(amountUsd - target) < Math.max(0.01, Math.min(1, amountMax * 0.02));
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => onAmountChange(target)}
                className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold transition ${
                  active
                    ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/25'
                    : 'border-white/[0.08] bg-white/[0.04] text-sigflo-muted hover:border-sigflo-accent/25 hover:bg-sigflo-accent/10 hover:text-sigflo-text'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {market === 'futures' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-sigflo-muted">Leverage</span>
            <span className="text-sm font-bold tabular-nums text-white">{Math.min(leverage, levMax)}x</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-black/20 px-2 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-sigflo-muted">Margin</span>
            <div className="flex rounded-lg bg-black/40 p-0.5">
              {(['cross', 'isolated'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMarginMode(m)}
                  className={`rounded-md px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide transition ${
                    marginMode === m ? 'bg-[#00ffc8]/20 text-[#00ffc8] ring-1 ring-[#00ffc8]/30' : 'text-sigflo-muted'
                  }`}
                >
                  {m === 'cross' ? 'Cross' : 'Isolated'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-between text-[9px] tabular-nums text-sigflo-muted">
            <span>1x</span>
            <span>{levMax}x</span>
          </div>
          <input
            type="range"
            min={1}
            max={levMax}
            step={1}
            value={Math.min(leverage, levMax)}
            onChange={(e) => onLeverageChange(Number(e.target.value))}
            className="w-full accent-[#00ffc8]"
          />
          <div className="flex flex-wrap gap-1">
            {leverageChipLevels.map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => onLeverageChange(Math.min(x, levMax))}
                className={`rounded-lg border px-2 py-0.5 text-[9px] font-bold tabular-nums transition ${
                  leverage === x
                    ? 'border-[#00ffc8]/50 bg-[#00ffc8]/15 text-[#00ffc8]'
                    : 'border-white/[0.08] bg-white/[0.04] text-sigflo-muted hover:border-[#00ffc8]/25 hover:text-sigflo-text'
                }`}
              >
                {x}x
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-1.5 text-center text-[10px] font-semibold text-sigflo-muted">Spot · no leverage</p>
      )}

      {showLevels ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sigflo-muted">Stop loss</span>
              <button
                type="button"
                role="switch"
                aria-checked={slEnabled}
                onClick={() => setSlEnabled((v) => !v)}
                className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
                  slEnabled ? 'bg-rose-500/35 ring-1 ring-rose-400/35' : 'bg-white/[0.08]'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    slEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={stopInput}
              disabled={!slEnabled}
              onChange={(e) => onStopInputChange?.(e.target.value)}
              className="w-full rounded-xl border border-white/[0.08] bg-black/35 px-2.5 py-2 text-xs text-white outline-none ring-rose-400/20 focus:ring disabled:cursor-not-allowed disabled:opacity-45"
              placeholder="USDT"
              aria-label="Stop loss price"
            />
            {((stopPctHint != null && Number.isFinite(stopPctHint)) ||
              (entryNum != null && onStopInputChange)) ? (
              <div className="flex min-h-0 w-full min-w-0 items-center gap-x-1 gap-y-0.5">
                {stopPctHint != null && Number.isFinite(stopPctHint) ? (
                  <p
                    className={`shrink-0 text-[9px] font-semibold tabular-nums leading-none ${stopPctHint <= 0 ? 'text-rose-300' : 'text-sigflo-muted'}`}
                  >
                    {stopPctHint >= 0 ? '+' : ''}
                    {stopPctHint.toFixed(2)}%
                  </p>
                ) : null}
                {entryNum != null && onStopInputChange ? (
                  <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain py-px [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-0.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20">
                    <div className="flex w-max flex-nowrap gap-0.5 pr-0.5">
                      {STOP_LOSS_DISTANCE_PCT_CHIPS.map((pct) => {
                        const bps = distancePctToBps(pct);
                        const active =
                          slEnabled && bpsChipActive(slBpsImplied, bps, bpsChipToleranceForTarget(bps));
                        return (
                          <button
                            key={`sl-pct-${pct}`}
                            type="button"
                            title={
                              pct === 0
                                ? 'Stop at entry (0% offset)'
                                : `Stop ${pct}% from entry (adverse side)`
                            }
                            onClick={() => {
                              setSlEnabled(true);
                              onStopInputChange(formatQuoteNumber(stopPriceFromBps(entryNum, side, bps)));
                            }}
                            className={`shrink-0 rounded border px-[3px] py-px text-[7px] font-bold tabular-nums leading-none transition sm:text-[8px] ${
                              active
                                ? 'border-rose-400/50 bg-rose-500/12 text-rose-200 ring-1 ring-rose-400/15'
                                : 'border-white/[0.06] bg-white/[0.03] text-sigflo-muted hover:border-rose-400/25 hover:bg-rose-500/10 hover:text-rose-100'
                            }`}
                          >
                            {pct === 0 ? '0%' : `−${pct}%`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sigflo-muted">Take profit</span>
              <button
                type="button"
                role="switch"
                aria-checked={tpEnabled}
                onClick={() => setTpEnabled((v) => !v)}
                className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
                  tpEnabled ? 'bg-emerald-500/35 ring-1 ring-emerald-400/35' : 'bg-white/[0.08]'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    tpEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={takeProfitInput}
              disabled={!tpEnabled}
              onChange={(e) => onTakeProfitInputChange?.(e.target.value)}
              className="w-full rounded-xl border border-white/[0.08] bg-black/35 px-2.5 py-2 text-xs text-white outline-none ring-emerald-400/20 focus:ring disabled:cursor-not-allowed disabled:opacity-45"
              placeholder="USDT"
              aria-label="Take profit price"
            />
            {((tpPctHint != null && Number.isFinite(tpPctHint)) ||
              (entryNum != null && onTakeProfitInputChange)) ? (
              <div className="flex min-h-0 w-full min-w-0 items-center gap-x-1 gap-y-0.5">
                {tpPctHint != null && Number.isFinite(tpPctHint) ? (
                  <p
                    className={`shrink-0 text-[9px] font-semibold tabular-nums leading-none ${tpPctHint >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}
                  >
                    {tpPctHint >= 0 ? '+' : ''}
                    {tpPctHint.toFixed(2)}%
                  </p>
                ) : null}
                {entryNum != null && onTakeProfitInputChange ? (
                  <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain py-px [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-0.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20">
                    <div className="flex w-max flex-nowrap gap-0.5 pr-0.5">
                      {TAKE_PROFIT_DISTANCE_PCT_CHIPS.map((pct) => {
                        const bps = distancePctToBps(pct);
                        const active =
                          tpEnabled && bpsChipActive(tpBpsImplied, bps, bpsChipToleranceForTarget(bps));
                        return (
                          <button
                            key={`tp-pct-${pct}`}
                            type="button"
                            title={`Take profit ${pct}% from entry`}
                            onClick={() => {
                              setTpEnabled(true);
                              onTakeProfitInputChange(formatQuoteNumber(takeProfitPriceFromBps(entryNum, side, bps)));
                            }}
                            className={`shrink-0 rounded border px-[3px] py-px text-[7px] font-bold tabular-nums leading-none transition sm:text-[8px] ${
                              active
                                ? 'border-emerald-400/50 bg-emerald-500/12 text-emerald-200 ring-1 ring-emerald-400/15'
                                : 'border-white/[0.06] bg-white/[0.03] text-sigflo-muted hover:border-emerald-400/25 hover:bg-emerald-500/10 hover:text-emerald-100'
                            }`}
                          >
                            +{pct}%
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {compactStats ? (
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/[0.08] bg-black/30 p-2 sm:grid-cols-4">
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-wider text-sigflo-muted">Margin</p>
            <p className="mt-0.5 text-[11px] font-bold tabular-nums text-white">{moneyTight(compactStats.marginUsd)}</p>
          </div>
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-wider text-sigflo-muted">Est. fee</p>
            <p className="mt-0.5 text-[11px] font-bold tabular-nums text-white">
              {moneyTight(compactStats.estFeeUsd)}
              {feePctOfNotional > 0 ? (
                <span className="block text-[9px] font-normal text-sigflo-muted">({feePctOfNotional.toFixed(2)}%)</span>
              ) : null}
            </p>
          </div>
          <div
            className={
              compactStats.liquidationPrice != null
                ? 'rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-1.5 py-1 ring-1 ring-amber-400/10'
                : ''
            }
          >
            <p className="text-[8px] font-semibold uppercase tracking-wider text-sigflo-muted">Liquidation</p>
            <p className="mt-0.5 text-[11px] font-bold tabular-nums text-amber-200">
              {compactStats.liquidationPrice != null ? `$${formatQuoteNumber(compactStats.liquidationPrice)}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-wider text-sigflo-muted">Risk level</p>
            {compactStats.riskLevel != null && compactStats.riskMeterPct != null ? (
              <>
                <p className={`mt-0.5 text-[11px] font-bold ${riskColor}`}>{compactStats.riskLevel}</p>
                <RiskSegmentMeter pct={compactStats.riskMeterPct} level={compactStats.riskLevel} />
              </>
            ) : (
              <p className={`mt-0.5 text-[11px] font-bold ${riskColor}`}>{liquidationRisk}</p>
            )}
          </div>
        </div>
      ) : null}

      {lockSide ? (
        <div className="flex justify-center pt-0.5">
          <span
            className={`rounded-xl px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider ${
              side === 'long' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
            }`}
          >
            {side === 'long' ? 'LONG' : 'SHORT'} · open leg
          </span>
        </div>
      ) : showSideToggle ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onSideChange('long')}
            className={`rounded-xl py-2.5 text-sm font-bold transition ${
              side === 'long' ? 'bg-sigflo-accent text-sigflo-bg' : 'border border-white/[0.08] text-sigflo-text'
            }`}
          >
            {market === 'spot' ? 'Buy' : 'Open Long'}
          </button>
          <button
            type="button"
            onClick={() => onSideChange('short')}
            className={`rounded-xl py-2.5 text-sm font-bold transition ${
              side === 'short' ? 'bg-rose-500 text-white' : 'border border-white/[0.08] text-sigflo-text'
            }`}
          >
            {market === 'spot' ? 'Sell' : 'Open Short'}
          </button>
        </div>
      ) : null}

      <div className="flex items-center justify-between border-t border-white/[0.06] pt-2 text-[10px]">
        <span className="text-sigflo-muted">
          {money(positionSizeUsd)} · {walletUsedPct.toFixed(1)}% of wallet
        </span>
        {hideLiquidationFooter || compactStats?.riskMeterPct != null ? null : (
          <span className={`font-semibold ${riskColor}`}>Liq risk: {liquidationRisk}</span>
        )}
      </div>

      {assetTransferHref && transferModalOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default border-0 bg-black/75 p-0 backdrop-blur-[1px]"
            aria-label="Close"
            onClick={() => setTransferModalOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="transfer-dialog-title"
            className="relative z-[1] w-full max-w-sm rounded-xl border border-white/[0.12] bg-[#0a0a0c] p-4 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.95)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="transfer-dialog-title" className="text-sm font-bold text-white">
              Transfer on Bybit
            </p>
            <p className="mt-2 text-[11px] leading-snug text-sigflo-muted">
              Sigflo cannot move funds for you. On Bybit, use <span className="font-semibold text-sigflo-text/90">Transfer</span>{' '}
              between <span className="text-sigflo-text/90">Funding</span> and your{' '}
              <span className="text-sigflo-text/90">Unified Trading Account</span>.
            </p>
            <p className="mt-2 text-[10px] leading-snug text-sigflo-muted/90">
              If Bybit opens the chart instead, use the menu → <span className="text-white/85">Assets</span> →{' '}
              <span className="text-white/85">Transfer</span>.
            </p>
            <p className="mt-2 text-[9px] leading-snug text-sigflo-muted/80">
              Links go straight to Bybit’s site — Sigflo can’t pass your login through (and never sees your Bybit
              password). You’ll only skip sign-in if{' '}
              <span className="text-sigflo-muted">this same browser</span> already has an active Bybit web session.
              In-app or embedded browsers often use a separate cookie store; open the link in Chrome/Edge/Safari if
              Bybit asks you to log in again.
            </p>
            <p className="mt-1.5 text-[9px] leading-snug text-sigflo-muted/75">
              Bybit changes routes often; if one link 404s, try the other. Help always loads.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <a
                href={BYBIT_APP_ASSETS_HOME_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[44px] items-center justify-center rounded-lg bg-[#00ffc8]/15 text-center text-[12px] font-bold text-[#00ffc8] ring-1 ring-[#00ffc8]/35 transition hover:bg-[#00ffc8]/22"
              >
                Open Assets (Bybit app)
              </a>
              <a
                href={BYBIT_USER_ASSETS_EXCHANGE_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[40px] items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] text-center text-[11px] font-semibold text-sigflo-text transition hover:bg-white/[0.07]"
              >
                Alternate assets page
              </a>
              <a
                href={BYBIT_TRANSFER_HELP_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="text-center text-[11px] font-semibold text-sigflo-muted underline decoration-white/20 underline-offset-2 hover:text-white/85"
              >
                How to transfer (Bybit Help — always works)
              </a>
            </div>
            <button
              type="button"
              onClick={() => setTransferModalOpen(false)}
              className="mt-4 w-full rounded-lg border border-white/[0.08] py-2 text-[11px] font-semibold text-sigflo-muted transition hover:bg-white/[0.04] hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
