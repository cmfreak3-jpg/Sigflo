import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react';
import type { SimulatedActivePosition } from '@/types/activePosition';
import { LIVE_MARKET_UI_THROTTLE_MS } from '@/lib/liveMarketTickConstants';

export type LiveUnrealizedBundle = {
  pnlUsd: number;
  movePct: number;
  /** Mark used for the last committed PnL (aligned with throttled tick ref). */
  mark: number;
};

function computeFromMark(pos: SimulatedActivePosition, mark: number): LiveUnrealizedBundle {
  const entry = Math.max(1e-9, pos.entryPrice);
  const dir = pos.side === 'long' ? 1 : -1;
  const movePct = ((mark - entry) / entry) * 100 * dir;
  const pnlUsd = pos.positionNotionalUsd * (movePct / 100);
  return { pnlUsd, movePct, mark };
}

/**
 * Reads `lastPriceRef` on a RAF loop and commits PnL to React at {@link LIVE_MARKET_UI_THROTTLE_MS}.
 * Keeps high-frequency ticks out of the render path while staying visually real-time.
 */
export function useThrottledLiveUnrealized(
  lastPriceRef: MutableRefObject<number | undefined>,
  position: SimulatedActivePosition | null,
  enabled: boolean,
): LiveUnrealizedBundle {
  const posRef = useRef(position);
  useLayoutEffect(() => {
    posRef.current = position;
  }, [position]);

  const [bundle, setBundle] = useState<LiveUnrealizedBundle>({ pnlUsd: 0, movePct: 0, mark: 0 });

  useEffect(() => {
    if (!enabled || !position) {
      setBundle({ pnlUsd: 0, movePct: 0, mark: 0 });
      return;
    }

    const mark0 = lastPriceRef.current;
    if (mark0 != null && Number.isFinite(mark0) && mark0 > 0) {
      setBundle(computeFromMark(position, mark0));
    }

    let raf = 0;
    let lastCommit = 0;

    const loop = () => {
      raf = window.requestAnimationFrame(loop);
      const pos = posRef.current;
      if (!pos) return;
      const now = performance.now();
      if (now - lastCommit < LIVE_MARKET_UI_THROTTLE_MS) return;
      const mark = lastPriceRef.current;
      if (mark == null || !Number.isFinite(mark) || mark <= 0) return;
      const next = computeFromMark(pos, mark);
      lastCommit = now;
      setBundle((prev) =>
        Math.abs(prev.pnlUsd - next.pnlUsd) < 1e-8 &&
        Math.abs(prev.movePct - next.movePct) < 1e-5 &&
        prev.mark === next.mark
          ? prev
          : next,
      );
    };

    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, [enabled, position?.id, lastPriceRef]);

  return bundle;
}
