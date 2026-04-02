import type { SymbolTicker } from '@/types/market';

type LegSide = { side: 'long' | 'short' };

/**
 * Sigflo-style read on a position — tape + range + PnL%, not exchange chrome.
 */
export function positionMicroInsight(
  leg: LegSide,
  current: number,
  pnlPct: number,
  ticker: SymbolTicker | undefined,
): string {
  const absPct = Math.abs(pnlPct);
  const tape = ticker?.price24hPcnt ?? 0;
  const hi = ticker?.high24h;
  const lo = ticker?.low24h;
  const rangePos = hi && lo && hi > lo ? (current - lo) / (hi - lo) : null;

  if (absPct < 0.45) {
    return 'Weak move — low conviction';
  }

  if (leg.side === 'long' && rangePos !== null && rangePos >= 0.78 && pnlPct < 2.5 && pnlPct > -1) {
    return 'Stalling near resistance';
  }
  if (leg.side === 'short' && rangePos !== null && rangePos <= 0.24 && pnlPct < 2.5 && pnlPct > -1) {
    return 'Stalling near support — bounce risk';
  }

  if (leg.side === 'long' && tape >= 0.012 && pnlPct >= 1) {
    return 'Momentum strong';
  }
  if (leg.side === 'short' && tape <= -0.012 && pnlPct >= 1) {
    return 'Momentum strong';
  }
  if (pnlPct >= 2.8) {
    return 'Momentum strong';
  }

  if (pnlPct <= -2.5) {
    return 'Tape working against you — cut or define risk';
  }

  if (pnlPct >= 0.5 && pnlPct < 2.8) {
    return 'Trend still intact — don’t over-manage';
  }
  if (pnlPct <= -0.45 && pnlPct > -2.5) {
    return 'Giving back — tighten if structure breaks';
  }

  return 'Flat tape — wait for clarity';
}
