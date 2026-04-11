export type PositionHealthStatus = 'healthy' | 'at_risk' | 'losing_momentum' | 'near_invalidation';

export type PositionHealthResult = {
  status: PositionHealthStatus;
  label: string;
};

/**
 * Lightweight book health read for manage mode — distance to stop, PnL, and score hints.
 */
export function computePositionHealth(args: {
  side: 'long' | 'short';
  mark: number;
  stop: number;
  pnlPct: number;
  momentumQuality: number;
  structureQuality: number;
}): PositionHealthResult {
  const { side, mark, stop, pnlPct, momentumQuality, structureQuality } = args;
  if (!Number.isFinite(mark) || mark <= 0 || !Number.isFinite(stop) || stop <= 0) {
    return { status: 'healthy', label: 'Healthy' };
  }

  const distStopPct =
    side === 'long' ? ((mark - stop) / mark) * 100 : ((stop - mark) / mark) * 100;

  if (distStopPct < 0.28 || (pnlPct < -0.8 && distStopPct < 0.55)) {
    return { status: 'near_invalidation', label: 'Near invalidation' };
  }

  if (pnlPct < -1 && (momentumQuality < 11 || structureQuality < 11)) {
    return { status: 'losing_momentum', label: 'Losing momentum' };
  }

  if (distStopPct < 0.65 || pnlPct < -0.55) {
    return { status: 'at_risk', label: 'At risk' };
  }

  return { status: 'healthy', label: 'Healthy' };
}
