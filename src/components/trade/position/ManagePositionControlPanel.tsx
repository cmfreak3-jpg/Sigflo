import type { ExitAiMode } from '@/types/aiExitAutomation';
import type { ManageTradePositionContext } from '@/lib/manageTradeContext';
import type { PositionHealthResult } from '@/lib/positionHealth';
import type { ExitAiCoPilotModel } from '@/lib/exitAiCoPilot';
import { ExitAiCoPilotBlock } from '@/components/trade/exit/ExitAiCoPilotBlock';
import { formatQuoteNumber } from '@/lib/formatQuote';

function fmtSignedUsd(n: number): string {
  const sign = n >= 0 ? '+' : '−';
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtSignedPct(n: number): string {
  const sign = n >= 0 ? '+' : '−';
  return `${sign}${Math.abs(n).toFixed(2)}%`;
}

function sizeSummary(ctx: ManageTradePositionContext): string {
  const base = ctx.pair.includes('/') ? ctx.pair.split('/')[0].trim() : ctx.pair;
  if (ctx.posSize != null && Number.isFinite(ctx.posSize)) {
    return `${formatQuoteNumber(Math.abs(ctx.posSize))} ${base}`;
  }
  return `≈ $${Math.round(ctx.positionUsd).toLocaleString('en-US')} notional`;
}

function healthStyles(status: PositionHealthResult['status']): string {
  switch (status) {
    case 'healthy':
      return 'border-landing-accent/25 bg-landing-accent-dim/50 text-landing-accent-hi';
    case 'at_risk':
      return 'border-amber-400/30 bg-amber-500/10 text-amber-100';
    case 'losing_momentum':
      return 'border-orange-400/28 bg-orange-500/10 text-orange-100';
    case 'near_invalidation':
      return 'border-rose-400/35 bg-rose-500/12 text-rose-100';
    default:
      return 'border-white/[0.08] bg-black/25 text-landing-text';
  }
}

export type ManagePositionControlPanelProps = {
  manageCtx: ManageTradePositionContext;
  pnlUsd: number;
  pnlPct: number;
  mark: number;
  leverageLabel: string;
  isFutures: boolean;
  health: PositionHealthResult;
  exitAiModel: ExitAiCoPilotModel;
  exitMode: ExitAiMode;
  onExitModeChange: (mode: ExitAiMode) => void;
  onCloseFull: () => void;
  onPartialOpen: () => void;
  onMoveStopBreakeven: () => void;
  onTightenStop: () => void;
  onAddToPosition: () => void;
  timeline: string[];
  actionsDisabled: boolean;
  canMoveStops: boolean;
};

export function ManagePositionControlPanel({
  manageCtx,
  pnlUsd,
  pnlPct,
  mark,
  leverageLabel,
  isFutures,
  health,
  exitAiModel,
  exitMode,
  onExitModeChange,
  onCloseFull,
  onPartialOpen,
  onMoveStopBreakeven,
  onTightenStop,
  onAddToPosition,
  timeline,
  actionsDisabled,
  canMoveStops,
}: ManagePositionControlPanelProps) {
  const winning = pnlUsd >= 0;
  const staticActive = exitMode === 'manual';
  const aiActive = exitMode !== 'manual';

  return (
    <div
      className={`mx-auto w-full max-w-lg space-y-3 px-3 pt-2 ${
        winning
          ? 'shadow-[0_0_48px_-28px_rgba(0,200,120,0.35)]'
          : 'shadow-[0_0_40px_-24px_rgba(248,113,113,0.22)]'
      }`}
    >
      <section
        className={`rounded-2xl border px-3 py-3 ${
          winning
            ? 'border-landing-accent/20 bg-landing-surface/95'
            : 'border-rose-400/20 bg-rose-950/[0.18]'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-landing-muted">Live PnL</p>
            <p
              className={`mt-0.5 font-mono text-3xl font-bold tabular-nums tracking-tight ${
                winning ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {fmtSignedUsd(pnlUsd)}
            </p>
            <p className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${winning ? 'text-emerald-200/90' : 'text-rose-200/90'}`}>
              {fmtSignedPct(pnlPct)}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
              manageCtx.side === 'long'
                ? 'border-landing-accent/40 bg-landing-accent-dim text-landing-accent-hi'
                : 'border-rose-400/35 bg-rose-500/15 text-rose-100'
            }`}
          >
            {manageCtx.side === 'long' ? 'Long' : 'Short'}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/[0.06] pt-3 text-[11px]">
          <span className="font-semibold text-landing-text">{manageCtx.pair}</span>
          <span className="text-landing-muted">·</span>
          <span className="text-landing-muted">Size</span>
          <span className="font-medium text-landing-text">{sizeSummary(manageCtx)}</span>
          <span className="text-landing-muted">·</span>
          <span className="text-landing-muted">Lev</span>
          <span className="font-mono font-semibold text-landing-text">{leverageLabel}</span>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <dt className="text-landing-muted">Entry</dt>
            <dd className="mt-0.5 font-mono font-semibold text-landing-text">${formatQuoteNumber(manageCtx.entryPrice)}</dd>
          </div>
          <div>
            <dt className="text-landing-muted">Mark</dt>
            <dd className="mt-0.5 font-mono font-semibold text-landing-text">${formatQuoteNumber(mark)}</dd>
          </div>
        </dl>
      </section>

      <section className={`rounded-2xl border px-3 py-2.5 ${healthStyles(health.status)}`}>
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] opacity-80">Position health</p>
        <p className="mt-1 text-sm font-bold">{health.label}</p>
      </section>

      <ExitAiCoPilotBlock
        model={exitAiModel}
        exitMode={exitMode}
        onExitModeChange={onExitModeChange}
        onCloseNow={onCloseFull}
        actionsDisabled={actionsDisabled}
      />

      <section className="rounded-2xl border border-landing-border bg-black/25 px-3 py-2.5">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-landing-muted">Exit mode</p>
        <div className="mt-2 flex rounded-xl border border-white/[0.08] bg-landing-bg/80 p-0.5">
          <button
            type="button"
            disabled={actionsDisabled}
            onClick={() => onExitModeChange('manual')}
            className={`flex-1 rounded-lg py-2 text-[11px] font-bold transition ${
              staticActive ? 'bg-landing-accent-dim text-landing-accent-hi' : 'text-landing-muted'
            }`}
          >
            Static SL/TP
          </button>
          <button
            type="button"
            disabled={actionsDisabled}
            onClick={() => onExitModeChange('assisted')}
            className={`flex-1 rounded-lg py-2 text-[11px] font-bold transition ${
              aiActive ? 'bg-landing-accent-dim text-landing-accent-hi' : 'text-landing-muted'
            }`}
          >
            AI exit
          </button>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-landing-muted">
          {staticActive
            ? 'Chart shows your planned stop and target; updates sync to the exchange when you apply TP/SL.'
            : 'AI exit uses assisted automation — trims and exits follow your safeguards. Target on chart is a reference, not a fixed take-profit.'}
        </p>
      </section>

      <section>
        <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-landing-muted">Quick actions</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={actionsDisabled}
            onClick={onCloseFull}
            className="rounded-xl border border-rose-400/35 bg-rose-500/15 py-2.5 text-[11px] font-bold text-rose-100 transition hover:bg-rose-500/22 active:scale-[0.99] disabled:opacity-45"
          >
            Close position
          </button>
          <button
            type="button"
            disabled={actionsDisabled}
            onClick={onPartialOpen}
            className="rounded-xl border border-white/[0.1] bg-landing-surface py-2.5 text-[11px] font-bold text-landing-text transition hover:border-landing-accent/30 active:scale-[0.99] disabled:opacity-45"
          >
            Partial close
          </button>
          <button
            type="button"
            disabled={actionsDisabled || !canMoveStops || !isFutures}
            onClick={onMoveStopBreakeven}
            className="rounded-xl border border-white/[0.1] bg-landing-surface py-2.5 text-[11px] font-bold text-landing-text transition hover:border-landing-accent/30 active:scale-[0.99] disabled:opacity-45"
          >
            Stop → breakeven
          </button>
          <button
            type="button"
            disabled={actionsDisabled || !canMoveStops || !isFutures}
            onClick={onTightenStop}
            className="rounded-xl border border-white/[0.1] bg-landing-surface py-2.5 text-[11px] font-bold text-landing-text transition hover:border-landing-accent/30 active:scale-[0.99] disabled:opacity-45"
          >
            Tighten stop
          </button>
        </div>
        <button
          type="button"
          disabled={actionsDisabled}
          onClick={onAddToPosition}
          className="mt-2 w-full rounded-xl bg-landing-accent py-3 text-sm font-bold text-landing-bg shadow-landing-glow-sm transition hover:brightness-110 active:scale-[0.99] disabled:opacity-45"
        >
          Add to position
        </button>
      </section>

      {timeline.length > 0 ? (
        <section className="rounded-2xl border border-white/[0.06] bg-black/20 px-3 py-2">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-landing-muted">Exit timeline</p>
          <ul className="mt-2 space-y-1.5">
            {timeline.map((line) => (
              <li key={line} className="text-[11px] leading-snug text-landing-text/90 before:mr-1.5 before:text-landing-accent-hi before:content-['·']">
                {line}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
