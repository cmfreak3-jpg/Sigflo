import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const THUMB_W = 44;
const COMMIT_THRESHOLD = 0.88;
const EXEC_DELAY_MS = 200;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function SlideToExecute({
  disabled,
  busy,
  label,
  onCommit,
}: {
  disabled: boolean;
  busy: boolean;
  label: string;
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

  const snapBack = useCallback(() => setDragX(0), []);

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
    setDragX(clamp(startDragX.current + dx, 0, maxX));
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
      window.setTimeout(() => onCommit(), EXEC_DELAY_MS);
    } else {
      snapBack();
    }
  };

  return (
    <div className="relative h-[48px] overflow-hidden rounded-2xl border border-landing-accent/25 bg-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div
        className="absolute inset-y-0 left-0 bg-gradient-to-r from-landing-accent/30 to-landing-accent/10 transition-[width] duration-75 ease-out"
        style={{ width: `${fillProgress * 100}%` }}
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center pr-10">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-landing-muted">
          {busy ? 'Submitting…' : label}
        </span>
      </div>
      <button
        type="button"
        disabled={disabled || busy}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="absolute top-1 bottom-1 flex w-10 items-center justify-center rounded-xl border border-landing-accent/40 bg-landing-surface text-landing-accent-hi shadow-landing-glow-sm transition-[transform] duration-150 ease-out disabled:cursor-not-allowed"
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? 'none' : 'transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          left: 4,
        }}
        aria-label="Slide to confirm partial close"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

export type ManagePartialCloseSheetProps = {
  open: boolean;
  onClose: () => void;
  fraction: number;
  onFractionChange: (f: number) => void;
  onConfirm: (fraction: number) => void;
  disabled?: boolean;
  busy?: boolean;
};

export function ManagePartialCloseSheet({
  open,
  onClose,
  fraction,
  onFractionChange,
  onConfirm,
  disabled = false,
  busy = false,
}: ManagePartialCloseSheetProps) {
  const [localBusy, setLocalBusy] = useState(false);
  const presets = [25, 50, 75, 100] as const;

  useEffect(() => {
    if (!open) setLocalBusy(false);
  }, [open]);

  const run = useCallback(() => {
    if (disabled || busy || localBusy) return;
    setLocalBusy(true);
    try {
      onConfirm(fraction);
    } finally {
      window.setTimeout(() => setLocalBusy(false), 400);
    }
  }, [disabled, busy, localBusy, onConfirm, fraction]);

  if (!open) return null;

  const bottom = `max(0.75rem, env(safe-area-inset-bottom, 0px))`;

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-[52] bg-black/50 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        className="fixed left-0 right-0 z-[53] mx-auto max-w-lg rounded-t-3xl border border-landing-border bg-landing-surface px-4 pb-4 pt-2 shadow-[0_-16px_48px_rgba(0,0,0,0.55),0_0_40px_-12px_rgba(0,200,120,0.2)]"
        style={{ bottom: bottom }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex justify-center pb-2">
          <span className="h-1 w-9 rounded-full bg-white/20" />
        </div>
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
          <h2 className="text-sm font-bold text-landing-text">Partial close</h2>
          <button type="button" onClick={onClose} className="text-xs font-semibold text-landing-muted">
            Cancel
          </button>
        </div>
        <p className="mt-2 text-[11px] text-landing-muted">
          Choose how much of the open leg to scale out. Slide to confirm — same safety as entry execution.
        </p>
        <div className="mt-3 flex gap-2">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              disabled={disabled || busy}
              onClick={() => onFractionChange(p / 100)}
              className={`flex-1 rounded-xl border py-2 text-[11px] font-bold transition active:scale-[0.98] ${
                Math.abs(fraction * 100 - p) < 1
                  ? 'border-landing-accent/45 bg-landing-accent-dim text-landing-accent-hi'
                  : 'border-white/[0.08] bg-black/25 text-landing-text'
              }`}
            >
              {p}%
            </button>
          ))}
        </div>
        <div className="mt-4">
          <SlideToExecute
            disabled={disabled || busy}
            busy={busy || localBusy}
            label="Slide to close slice →"
            onCommit={run}
          />
        </div>
      </div>
    </>
  );
}
