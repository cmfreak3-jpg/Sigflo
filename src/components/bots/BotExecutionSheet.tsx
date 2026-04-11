import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { deriveTradeMetrics } from '@/lib/tradeRisk';
import type { TradeViewModel } from '@/types/trade';
import type { TradeSide } from '@/types/trade';

const THUMB_W = 44;
const COMMIT_THRESHOLD = 0.88;
const EXEC_DELAY_MS = 200;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function roundUsd(n: number): number {
  return Math.round(n * 100) / 100;
}

function TradeSummary({
  pairLabel,
  side,
  entry,
  stop,
  target,
}: {
  pairLabel: string;
  side: TradeSide;
  entry: number;
  stop: number;
  target: number;
}) {
  const isLong = side === 'long';
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/25 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-landing-muted">Pair</p>
          <p className="mt-0.5 text-base font-bold tracking-tight text-landing-text">{pairLabel}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
            isLong
              ? 'border-landing-accent/40 bg-landing-accent-dim text-landing-accent-hi'
              : 'border-rose-400/35 bg-rose-500/12 text-rose-100'
          }`}
        >
          {isLong ? 'Long' : 'Short'}
        </span>
      </div>
      <div className="mt-4 flex gap-3">
        <div className="flex w-8 flex-col items-center pt-1">
          <span className="h-2 w-2 rounded-full bg-emerald-400/90 shadow-[0_0_10px_rgba(52,211,153,0.45)]" />
          <span className="my-1 w-px flex-1 min-h-[14px] bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full border-2 border-landing-accent bg-landing-accent/20 shadow-landing-glow-sm" />
          <span className="my-1 w-px flex-1 min-h-[14px] bg-white/10" />
          <span className="h-2 w-2 rounded-full bg-rose-400/90 shadow-[0_0_10px_rgba(248,113,113,0.35)]" />
        </div>
        <div className="min-w-0 flex-1 space-y-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-landing-muted">Target</span>
            <span className="font-mono font-semibold text-emerald-200/95">{target.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-landing-muted">Entry</span>
            <span className="font-mono font-semibold text-landing-text">{entry.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-landing-muted">Stop</span>
            <span className="font-mono font-semibold text-rose-200/90">{stop.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PositionSizeControl({
  balanceUsd,
  amountUsd,
  onAmountUsd,
  sizeMode,
  onSizeMode,
  minOrderUsd,
  disabled,
}: {
  balanceUsd: number;
  amountUsd: number;
  onAmountUsd: (n: number) => void;
  sizeMode: 'usd' | 'pct';
  onSizeMode: (m: 'usd' | 'pct') => void;
  minOrderUsd: number;
  disabled: boolean;
}) {
  const pct = balanceUsd > 0 ? Math.round((amountUsd / balanceUsd) * 1000) / 10 : 0;
  const quick = [10, 25, 50, 100] as const;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-landing-muted">Position size</p>
        <div className="flex rounded-lg border border-white/[0.08] bg-black/20 p-0.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSizeMode('usd')}
            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition ${
              sizeMode === 'usd' ? 'bg-landing-accent-dim text-landing-accent-hi' : 'text-landing-muted'
            }`}
          >
            USD
          </button>
          <button
            type="button"
            disabled={disabled || balanceUsd <= 0}
            onClick={() => onSizeMode('pct')}
            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition ${
              sizeMode === 'pct' ? 'bg-landing-accent-dim text-landing-accent-hi' : 'text-landing-muted'
            }`}
          >
            %
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          disabled={disabled}
          min={0}
          step={sizeMode === 'usd' ? 1 : 0.1}
          value={sizeMode === 'usd' ? (Number.isFinite(amountUsd) ? amountUsd : '') : pct}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isFinite(v) || v < 0) return;
            if (sizeMode === 'usd') onAmountUsd(roundUsd(v));
            else onAmountUsd(roundUsd((v / 100) * balanceUsd));
          }}
          className="min-w-0 flex-1 rounded-xl border border-white/[0.1] bg-landing-bg px-3 py-2.5 font-mono text-sm text-landing-text outline-none ring-landing-accent/30 focus:ring-2 disabled:opacity-45"
        />
        <span className="shrink-0 text-[11px] text-landing-muted">{sizeMode === 'usd' ? 'USDT margin' : '% wallet'}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {quick.map((p) => (
          <button
            key={p}
            type="button"
            disabled={disabled || balanceUsd <= 0}
            onClick={() => onAmountUsd(roundUsd(Math.max(minOrderUsd, (balanceUsd * p) / 100)))}
            className="rounded-lg border border-white/[0.08] bg-black/25 px-2.5 py-1.5 text-[10px] font-bold text-landing-text transition hover:border-landing-accent/35 active:scale-[0.97] disabled:opacity-40"
          >
            {p}%
          </button>
        ))}
      </div>
      <p className="text-[10px] text-landing-muted">
        Available ≈ <span className="font-mono text-landing-text/90">{balanceUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span> USDT
      </p>
    </div>
  );
}

function RiskSnapshot({
  riskUsd,
  lossPct,
  profitUsd,
  rr,
}: {
  riskUsd: number;
  lossPct: number;
  profitUsd: number;
  rr: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-landing-accent/15 bg-landing-accent-dim/40 px-3 py-2.5">
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-landing-muted">Risk</p>
        <p className="mt-0.5 font-mono text-sm font-bold text-rose-200/95">
          {riskUsd >= 0 ? '' : '−'}
          {Math.abs(riskUsd).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}
        </p>
      </div>
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-landing-muted">Max loss %</p>
        <p className="mt-0.5 font-mono text-sm font-bold text-landing-text">{lossPct.toFixed(2)}%</p>
      </div>
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-landing-muted">Profit target</p>
        <p className="mt-0.5 font-mono text-sm font-bold text-emerald-200/95">
          +{profitUsd.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}
        </p>
      </div>
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-landing-muted">R:R</p>
        <p className="mt-0.5 font-mono text-sm font-bold text-landing-accent-hi">{Number.isFinite(rr) && rr > 0 ? `${rr.toFixed(2)} : 1` : '—'}</p>
      </div>
    </div>
  );
}

function ExecutionSlider({
  disabled,
  busy,
  onCommit,
}: {
  disabled: boolean;
  busy: boolean;
  onCommit: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackW, setTrackW] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startDragX = useRef(0);
  const commitScheduledRef = useRef(false);

  const maxX = Math.max(0, trackW - THUMB_W);
  const rawProgress = maxX > 0 ? dragX / maxX : 0;
  const fillProgress = maxX > 0 ? Math.pow(rawProgress, 1.12) : 0;

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTrackW(el.clientWidth));
    ro.observe(el);
    setTrackW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!disabled && !busy && !dragging) {
      setDragX(0);
      commitScheduledRef.current = false;
    }
  }, [disabled, busy, dragging]);

  const snapBack = useCallback(() => {
    setDragX(0);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || busy || maxX <= 0) return;
    e.preventDefault();
    commitScheduledRef.current = false;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    startX.current = e.clientX;
    startDragX.current = dragX;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || disabled || busy) return;
    const dx = e.clientX - startX.current;
    const next = clamp(startDragX.current + dx, 0, maxX);
    setDragX(next);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const x = clamp(startDragX.current + (e.clientX - startX.current), 0, maxX);
    if (maxX > 0 && x >= maxX * COMMIT_THRESHOLD && !commitScheduledRef.current) {
      commitScheduledRef.current = true;
      window.setTimeout(() => {
        onCommit();
      }, EXEC_DELAY_MS);
    } else {
      snapBack();
    }
  };

  return (
    <div className="select-none">
      <div
        ref={trackRef}
        className={`relative h-[52px] overflow-hidden rounded-2xl border border-landing-accent/25 bg-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_24px_-8px_rgba(0,200,120,0.25)] ${
          disabled || busy ? 'opacity-45' : ''
        }`}
      >
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-landing-accent/35 to-landing-accent/10 transition-[width] duration-75 ease-out"
          style={{ width: `${fillProgress * 100}%` }}
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center pr-10">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-landing-muted">
            {busy ? 'Submitting…' : 'Slide to execute →'}
          </span>
        </div>
        <button
          type="button"
          disabled={disabled || busy}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="absolute top-1 bottom-1 flex w-11 items-center justify-center rounded-xl border border-landing-accent/40 bg-landing-surface text-landing-accent-hi shadow-landing-glow-sm transition-[transform] duration-150 ease-out hover:brightness-110 disabled:cursor-not-allowed"
          style={{
            transform: `translateX(${dragX}px)`,
            transition: dragging ? 'none' : 'transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            left: 4,
          }}
          aria-label="Slide to execute trade"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <p className="mt-1.5 text-center text-[9px] text-landing-muted">Full slide required — no tap-to-send</p>
    </div>
  );
}

export type BotExecutionSheetProps = {
  open: boolean;
  onClose: () => void;
  pairLabel: string;
  chartModel: TradeViewModel;
  side: TradeSide;
  setupScore: number;
  balanceUsd: number;
  minOrderUsd: number;
  maxLeverage: number;
  /** Called after the 200ms slide commit delay. */
  onExecute: (args: { amountUsd: number; leverage: number }) => Promise<{ ok: true } | { ok: false; message: string }>;
  onViewPosition: () => void;
  tabBarInsetPx?: number;
};

export function BotExecutionSheet({
  open,
  onClose,
  pairLabel,
  chartModel,
  side,
  setupScore,
  balanceUsd,
  minOrderUsd,
  maxLeverage,
  onExecute,
  onViewPosition,
  tabBarInsetPx = 74,
}: BotExecutionSheetProps) {
  const [sizeMode, setSizeMode] = useState<'usd' | 'pct'>('usd');
  const [amountUsd, setAmountUsd] = useState(0);
  const [leverage, setLeverage] = useState(10);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'form' | 'success' | 'error'>('form');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const riskModel = useMemo(
    () => ({
      ...chartModel,
      balanceUsd: Math.max(0, balanceUsd),
    }),
    [chartModel, balanceUsd],
  );

  const cappedLev = clamp(leverage, 1, maxLeverage);
  const cappedAmount = clamp(amountUsd, 0, Math.max(0, balanceUsd));

  const metrics = useMemo(
    () =>
      deriveTradeMetrics(riskModel, {
        amountUsd: cappedAmount,
        leverage: cappedLev,
        side,
        market: 'futures',
        setupScore,
      }),
    [riskModel, cappedAmount, cappedLev, side, setupScore],
  );

  const lossPct =
    cappedAmount > 0 ? (Math.abs(metrics.stopLossUsd) / cappedAmount) * 100 : 0;
  const rr =
    metrics.stopLossUsd !== 0 ? Math.abs(metrics.targetProfitUsd / metrics.stopLossUsd) : chartModel.riskReward;

  useEffect(() => {
    if (!open) return;
    setPhase('form');
    setErrorMessage(null);
    setBusy(false);
    const seed = roundUsd(Math.max(minOrderUsd, balanceUsd > 0 ? (balanceUsd * 10) / 100 : minOrderUsd));
    setAmountUsd(clamp(seed, minOrderUsd, Math.max(minOrderUsd, balanceUsd)));
    setLeverage(clamp(10, 1, maxLeverage));
  }, [open, balanceUsd, minOrderUsd, maxLeverage]);

  const canSlide =
    balanceUsd >= minOrderUsd &&
    cappedAmount >= minOrderUsd &&
    Number.isFinite(chartModel.entry) &&
    chartModel.entry > 0 &&
    !busy &&
    phase === 'form';

  const runExecute = async () => {
    if (!canSlide) return;
    setBusy(true);
    setErrorMessage(null);
    try {
      const res = await onExecute({ amountUsd: cappedAmount, leverage: cappedLev });
      if (res.ok) {
        try {
          navigator.vibrate?.(12);
        } catch {
          /* ignore */
        }
        setPhase('success');
      } else {
        setPhase('error');
        setErrorMessage(res.message);
      }
    } catch {
      setPhase('error');
      setErrorMessage('Something went wrong — try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const bottomOffset = `calc(${tabBarInsetPx}px + env(safe-area-inset-bottom, 0px))`;

  return (
    <>
      <button
        type="button"
        aria-label="Close execution panel"
        className="fixed z-[43] bg-black/45 backdrop-blur-[2px] transition-opacity"
        style={{ left: 0, right: 0, top: 'min(36vh, 320px)', bottom: 0 }}
        onClick={onClose}
      />
      <div
        className="fixed left-0 right-0 z-[44] flex max-h-[min(58vh,520px)] flex-col rounded-t-3xl border border-landing-border/80 bg-landing-surface shadow-[0_-12px_48px_rgba(0,0,0,0.55),0_0_0_1px_rgba(0,200,120,0.12)]"
        style={{
          bottom: bottomOffset,
          boxShadow: '0 -12px 48px rgba(0,0,0,0.55), 0 0 40px -12px rgba(0,200,120,0.18), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bot-exec-title"
      >
        <div className="flex justify-center pt-2 pb-1">
          <span className="h-1 w-10 rounded-full bg-white/15" />
        </div>
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 pb-2">
          <h2 id="bot-exec-title" className="text-sm font-bold text-landing-text">
            Execute trade
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-landing-muted transition hover:text-landing-text"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-3">
          {phase === 'success' ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-landing-accent/40 bg-landing-accent-dim shadow-landing-glow animate-pulse">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-landing-accent-hi" aria-hidden>
                  <path
                    d="M6 12.5l4 4 8-9"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="mt-4 text-lg font-bold text-landing-text">Trade executed</p>
              <p className="mt-1 text-xs text-landing-muted">Position is live — chart overlays updated.</p>
              <button
                type="button"
                onClick={() => {
                  onViewPosition();
                  onClose();
                }}
                className="mt-6 w-full rounded-xl bg-landing-accent py-3 text-sm font-bold text-landing-bg shadow-landing-glow-sm transition active:scale-[0.98]"
              >
                View position
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 text-xs font-semibold text-landing-muted hover:text-landing-text"
              >
                Stay on focus
              </button>
            </div>
          ) : (
            <>
              <TradeSummary
                pairLabel={pairLabel}
                side={side}
                entry={chartModel.entry}
                stop={chartModel.stop}
                target={chartModel.target}
              />
              <div className="mt-4">
                <PositionSizeControl
                  balanceUsd={balanceUsd}
                  amountUsd={cappedAmount}
                  onAmountUsd={(n) => setAmountUsd(clamp(roundUsd(n), 0, Math.max(0, balanceUsd)))}
                  sizeMode={sizeMode}
                  onSizeMode={setSizeMode}
                  minOrderUsd={minOrderUsd}
                  disabled={busy}
                />
              </div>
              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-landing-muted">Leverage</p>
                <div className="mt-1.5 flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={maxLeverage}
                    step={1}
                    value={cappedLev}
                    disabled={busy}
                    onChange={(e) => setLeverage(Number(e.target.value))}
                    className="h-1.5 flex-1 accent-landing-accent"
                  />
                  <span className="w-10 text-right font-mono text-xs font-bold text-landing-accent-hi">{cappedLev}×</span>
                </div>
              </div>
              <div className="mt-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-landing-muted">Risk snapshot</p>
                <RiskSnapshot
                  riskUsd={metrics.stopLossUsd}
                  lossPct={lossPct}
                  profitUsd={metrics.targetProfitUsd}
                  rr={rr}
                />
              </div>
              {phase === 'error' && errorMessage ? (
                <div className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-center text-xs font-medium text-rose-100">
                  {errorMessage}
                  <button
                    type="button"
                    className="mt-2 block w-full rounded-lg border border-rose-400/35 py-2 text-[11px] font-bold uppercase tracking-wide text-rose-100 transition hover:bg-rose-500/15"
                    onClick={() => {
                      setPhase('form');
                      setErrorMessage(null);
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : null}
              <div className="mt-5">
                <ExecutionSlider disabled={!canSlide} busy={busy} onCommit={runExecute} />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
