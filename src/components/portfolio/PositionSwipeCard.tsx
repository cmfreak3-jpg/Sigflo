import { useCallback, useRef, useState, type ReactNode } from 'react';

const SWIPE_THRESHOLD = 56;
const MAX_DRAG = 96;

type Props = {
  children: ReactNode;
  onOpen: () => void;
  onSwipeClose: () => void;
  onSwipeAdd: () => void;
};

/**
 * Horizontal swipe reveals “Close position” (left) / “Add to position” (right).
 * Tap without a horizontal drag opens the trade screen.
 */
export function PositionSwipeCard({ children, onOpen, onSwipeClose, onSwipeAdd }: Props) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const mode = useRef<'idle' | 'pending' | 'horiz'>('idle');
  const startRef = useRef({ x: 0, y: 0 });
  const offsetRef = useRef(0);

  const resetGesture = useCallback(() => {
    mode.current = 'idle';
    offsetRef.current = 0;
    setOffset(0);
    setDragging(false);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    mode.current = 'pending';
    offsetRef.current = 0;
    setOffset(0);
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (mode.current === 'idle') return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (mode.current === 'pending') {
      if (Math.hypot(dx, dy) < 10) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        mode.current = 'idle';
        setDragging(false);
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* ok */
        }
        return;
      }
      mode.current = 'horiz';
    }
    if (mode.current === 'horiz') {
      const nx = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, dx));
      offsetRef.current = nx;
      setOffset(nx);
    }
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* released */
    }

    if (mode.current === 'pending') {
      onOpen();
      resetGesture();
      return;
    }

    if (mode.current === 'horiz') {
      const x = offsetRef.current;
      if (x <= -SWIPE_THRESHOLD) onSwipeClose();
      else if (x >= SWIPE_THRESHOLD) onSwipeAdd();
    }

    resetGesture();
  };

  return (
    <div className="relative overflow-hidden rounded-[16px] touch-pan-y">
      <div
        className="pointer-events-none absolute inset-0 z-0 flex"
        aria-hidden
      >
        <div className="flex min-w-[45%] flex-1 items-center bg-gradient-to-r from-rose-950/80 to-rose-900/25 pl-3.5">
          <span className="max-w-[5.5rem] text-[9px] font-bold uppercase leading-tight tracking-[0.08em] text-rose-200/85">
            Close position
          </span>
        </div>
        <div className="flex min-w-[45%] flex-1 items-center justify-end bg-gradient-to-l from-emerald-950/70 to-emerald-900/20 pr-3.5">
          <span className="max-w-[5.5rem] text-right text-[9px] font-bold uppercase leading-tight tracking-[0.08em] text-emerald-200/85">
            Add to position
          </span>
        </div>
      </div>

      <div
        className="relative z-[1] bg-sigflo-bg/0"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? 'none' : 'transform 0.22s cubic-bezier(0.25, 0.85, 0.25, 1)',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <div
          role="button"
          tabIndex={0}
          className="w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-sigflo-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-sigflo-bg"
          onKeyDown={(ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') {
              ev.preventDefault();
              onOpen();
            }
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
