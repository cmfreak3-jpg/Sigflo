import { useState } from 'react';
import { RiskSegmentMeter } from '@/components/ui/RiskSegmentMeter';
import type { MarketMode, RiskLevel, TradeSide } from '@/types/trade';
import { formatQuoteNumber } from '@/lib/formatQuote';

function money(n: number) {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function moneyTight(n: number) {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1000) return `$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${abs.toFixed(2)}`;
}

export function OrderInputsCard(props: {
  market: MarketMode;
  balanceUsd: number;
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
  } = props;
  const amountMax = Math.max(0, Math.round(balanceUsd));
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

  const levMax = 50;

  return (
    <div className="rounded-2xl border border-white/[0.1] bg-gradient-to-b from-white/[0.04] to-sigflo-surface/95 p-3 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.85)] backdrop-blur-sm space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs text-sigflo-muted">
        <span className="text-sm font-bold text-white">{panelTitle}</span>
        <span className="shrink-0 tabular-nums text-[11px]">Bal {money(balanceUsd)}</span>
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sigflo-muted">Notional (USD)</span>
        <div className="group relative">
          <input
            type="number"
            min={0}
            max={amountMax}
            step={50}
            value={amountUsd || ''}
            onChange={(e) => onAmountChange(Number(e.target.value || 0))}
            className="sigflo-number-input w-full rounded-xl border border-white/[0.08] bg-black/35 px-3 py-2.5 pr-11 text-sm text-white outline-none ring-sigflo-accent/30 placeholder:text-sigflo-muted focus:ring"
            placeholder="0"
          />
          <div className="pointer-events-none absolute inset-y-1.5 right-1 flex w-7 flex-col gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
            <button
              type="button"
              onClick={() => onAmountChange(Math.min(amountMax, Math.max(0, amountUsd + 50)))}
              className="flex h-1/2 items-center justify-center rounded border border-white/[0.08] bg-white/[0.06] text-[9px] leading-none text-sigflo-text transition hover:bg-white/[0.12]"
              aria-label="Increase amount"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => onAmountChange(Math.max(0, amountUsd - 50))}
              className="flex h-1/2 items-center justify-center rounded border border-white/[0.08] bg-white/[0.06] text-[9px] leading-none text-sigflo-text transition hover:bg-white/[0.12]"
              aria-label="Decrease amount"
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
      </label>

      <div className="space-y-1.5">
        <input
          type="range"
          min={0}
          max={amountMax}
          step={25}
          value={Math.min(Math.max(0, amountUsd), amountMax)}
          onChange={(e) => onAmountChange(Number(e.target.value))}
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
            const target = Math.round(amountMax * chip.v);
            const active = amountMax > 0 && Math.abs(amountUsd - target) < Math.max(1, amountMax * 0.02);
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
            {[2, 5, 10, 15, 20, 30, 50].map((x) => (
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
        <p className="rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-1.5 text-center text-[10px] font-semibold text-sigflo-muted">Spot · 1× notional</p>
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
            {stopPctHint != null && Number.isFinite(stopPctHint) ? (
              <p className={`text-[10px] font-semibold tabular-nums ${stopPctHint <= 0 ? 'text-rose-300' : 'text-sigflo-muted'}`}>
                {stopPctHint >= 0 ? '+' : ''}
                {stopPctHint.toFixed(2)}%
              </p>
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
            {tpPctHint != null && Number.isFinite(tpPctHint) ? (
              <p className={`text-[10px] font-semibold tabular-nums ${tpPctHint >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {tpPctHint >= 0 ? '+' : ''}
                {tpPctHint.toFixed(2)}%
              </p>
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
          {money(positionSizeUsd)} notional · {walletUsedPct.toFixed(1)}% wallet
        </span>
        {hideLiquidationFooter || compactStats?.riskMeterPct != null ? null : (
          <span className={`font-semibold ${riskColor}`}>Liq risk: {liquidationRisk}</span>
        )}
      </div>
    </div>
  );
}
