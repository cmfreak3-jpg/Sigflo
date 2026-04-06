import { useState } from 'react';

const PARTIAL_MIN_PCT = 5;
const PARTIAL_MAX_PCT = 95;
const PARTIAL_STEP = 5;
const PARTIAL_DEFAULT_PCT = 25;

export type PositionActionsBarProps = {
  variant?: 'dock' | 'sheet';
  /** Primary: close active / focused position */
  onClosePosition: () => void;
  onCloseAll: () => void;
  /** Fraction of position to scale out (e.g. 0.25 = 25%). Called on slider release or Enter. */
  onPartialClose: (fraction: number) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Live trade mode actions — replaces Short/Long when a position is open.
 */
export function PositionActionsBar({
  variant = 'dock',
  onClosePosition,
  onCloseAll,
  onPartialClose,
  disabled = false,
  className = '',
}: PositionActionsBarProps) {
  const isDock = variant === 'dock';
  const pad = isDock ? 'px-2 py-1' : 'px-3 py-3';
  const [partialPct, setPartialPct] = useState(PARTIAL_DEFAULT_PCT);
  const [partialOpen, setPartialOpen] = useState(true);
  const partialHintId = 'sigflo-partial-slider-hint';
  const partialPanelId = 'sigflo-partial-panel';

  const commitPartialFromInput = (el: HTMLInputElement) => {
    if (disabled) return;
    const v = Number(el.value);
    if (!Number.isFinite(v)) return;
    onPartialClose(v / 100);
  };

  return (
    <div
      className={`flex flex-col ${isDock ? 'gap-0.5' : 'gap-1.5'} ${pad} ${className}`}
      role="group"
      aria-label="Position actions"
    >
      <div className={`grid gap-1 ${isDock ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <button
          type="button"
          disabled={disabled}
          onClick={onClosePosition}
          className="flex min-h-[34px] items-center justify-center rounded-lg bg-gradient-to-b from-rose-500/95 to-rose-600/95 text-[11px] font-bold text-white shadow-[0_0_14px_-6px_rgba(248,113,113,0.45)] ring-1 ring-rose-300/20 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[36px] sm:text-xs"
        >
          Close position
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onCloseAll}
          className="flex min-h-[34px] items-center justify-center rounded-lg border border-rose-500/40 bg-rose-950/40 text-[10px] font-bold uppercase tracking-wide text-rose-100/90 transition hover:bg-rose-950/55 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[36px] sm:text-[11px]"
        >
          Close all
        </button>
      </div>

      <div className="rounded border border-white/[0.06] bg-black/35 px-1 py-0.5 ring-1 ring-white/[0.02]">
        <button
          type="button"
          disabled={disabled}
          id="sigflo-partial-toggle"
          aria-expanded={partialOpen}
          aria-controls={partialPanelId}
          onClick={() => setPartialOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-1 rounded py-0.5 pl-0 pr-0.5 text-left leading-none transition hover:bg-white/[0.04] active:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
        >
          <span className="text-[6px] font-extrabold uppercase tracking-[0.12em] text-sigflo-muted">Partial</span>
          <span className="flex shrink-0 items-center gap-0.5">
            <span className="font-mono text-[9px] font-bold tabular-nums text-cyan-200/95">{partialPct}%</span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              className={`text-sigflo-muted transition-transform duration-200 ${partialOpen ? 'rotate-180' : ''}`}
              aria-hidden
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
        <div
          id={partialPanelId}
          role="region"
          aria-labelledby="sigflo-partial-toggle"
          {...(partialOpen ? {} : { hidden: true })}
        >
          {partialOpen ? (
            <>
              <p id={partialHintId} className="sr-only">
                Drag to choose how much to scale out, then release. Or adjust with arrow keys and press Enter to apply.
              </p>
              <label className="mt-0.5 flex h-4 cursor-pointer items-center py-0">
                <span className="sr-only">Percent of position to scale out</span>
                <input
                  type="range"
                  min={PARTIAL_MIN_PCT}
                  max={PARTIAL_MAX_PCT}
                  step={PARTIAL_STEP}
                  value={partialPct}
                  disabled={disabled}
                  onChange={(e) => setPartialPct(Number(e.target.value))}
                  onPointerUp={(e) => commitPartialFromInput(e.currentTarget)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitPartialFromInput(e.currentTarget);
                    }
                  }}
                  className="sigflo-partial-slider sigflo-partial-slider--compact h-4 w-full min-w-0 cursor-pointer touch-manipulation disabled:cursor-not-allowed disabled:opacity-40"
                  aria-valuemin={PARTIAL_MIN_PCT}
                  aria-valuemax={PARTIAL_MAX_PCT}
                  aria-valuenow={partialPct}
                  aria-valuetext={`${partialPct} percent`}
                  aria-describedby={partialHintId}
                />
              </label>
              <p className="mt-0 text-center text-[5px] font-medium leading-none text-sigflo-muted/70" aria-hidden>
                Release to scale out
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
