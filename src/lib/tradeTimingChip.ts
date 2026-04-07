import type { MarketRowStatus } from '@/types/markets';

export type TradeTimingChipState = 'early' | 'developing' | 'ready' | 'invalid';

/** Alpha and line emphasis for chart trade overlays (entry / stop / target) from timing state. */
/** Chart overlay line opacity from `tradeTimingOverlayVisual` — floored so entry/target stay readable when timing is “invalid”. */
export function tradeTimingLineAlpha(
  level: 'entry' | 'stop' | 'target' | 'liquidation',
  timingAlphaScale: number,
): number {
  let a = timingAlphaScale;
  if (level === 'stop' || level === 'liquidation') {
    return Math.max(0.42, a);
  }
  return Math.max(0.35, a);
}

export function tradeTimingOverlayVisual(state: TradeTimingChipState): {
  alphaScale: number;
  /** Extra width on entry line when “ready” (subtle emphasis vs glow). */
  entryLineExtraWidth: number;
} {
  switch (state) {
    case 'early':
      return { alphaScale: 0.4, entryLineExtraWidth: 0 };
    case 'developing':
      return { alphaScale: 0.7, entryLineExtraWidth: 0 };
    case 'ready':
      return { alphaScale: 1, entryLineExtraWidth: 1 };
    case 'invalid':
      return { alphaScale: 0.14, entryLineExtraWidth: 0 };
    default:
      return { alphaScale: 1, entryLineExtraWidth: 0 };
  }
}

export function tradeTimingChipProps(
  status: MarketRowStatus,
  tradeScore: number,
): { state: TradeTimingChipState; label: string } {
  if (status === 'overextended' || tradeScore < 45) {
    return {
      state: 'invalid',
      label: tradeScore < 45 ? 'Too risky' : 'Stretched',
    };
  }
  if (status === 'triggered' && tradeScore >= 65) return { state: 'ready', label: 'Ready' };
  if (status === 'triggered' && tradeScore < 55) return { state: 'invalid', label: 'Too late' };
  if (status === 'developing') return { state: 'developing', label: 'Developing' };
  return { state: 'early', label: 'Too early' };
}
