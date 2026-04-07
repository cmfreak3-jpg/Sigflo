import type { GroundedMarketContext, MarketRegime } from '@/types/aiGrounded';

/** Human-readable tone instructions for the model (grounding rules still apply). */
export const REGIME_TONE_GUIDE: Record<MarketRegime, string> = {
  trending:
    'Tone: confident, continuation-focused desk trader. Stress trend alignment and what would extend vs stall the move. Prefer decisive phrasing when subscores support it — never fabricate catalysts or levels.',
  range:
    'Tone: cautious and two-sided. Emphasize range edges, chop risk, and what would confirm a breakout either way. Avoid false certainty; balance bull/bear mechanics from the package only.',
  risk_off:
    'Tone: defensive and alert. Lead with risk flags (scanner status, risk tag, riskConditions). Short, clear warnings; prioritize what invalidates or stretches the setup. No fear-mongering beyond the data.',
  transition:
    'Tone: observational; wait for confirmation. Call out mixed or evolving structure, developing status, and concrete triggers that would clarify direction. No strong directional hype the scores do not support.',
};

export function regimeToneGuideFor(regime: MarketRegime): string {
  return REGIME_TONE_GUIDE[regime];
}

/**
 * Classify regime from Sigflo score breakdown, scanner status, risk tag, setup type,
 * and optional recent OHLC (volatility proxy).
 */
export function deriveMarketRegimeFromContext(ctx: GroundedMarketContext): MarketRegime {
  const b = ctx.signal.scoreBreakdown;
  const ta = b.trendAlignment;
  const sq = b.structureQuality;
  const mq = b.momentumQuality;
  const rc = b.riskConditions;
  const { scannerStatus: status } = ctx;
  const { riskTag, setupType } = ctx.signal;
  const highRisk = riskTag === 'High Risk';

  let volProxy = 0;
  const candles = ctx.recentCandles;
  if (candles && candles.length >= 6) {
    const slice = candles.slice(-8);
    let sum = 0;
    let n = 0;
    for (const c of slice) {
      if (c.c > 0 && c.h >= c.l) {
        sum += (c.h - c.l) / c.c;
        n += 1;
      }
    }
    if (n > 0) volProxy = sum / n;
  }

  const riskOff =
    rc >= 11 ||
    (highRisk && rc >= 8) ||
    (status === 'overextended' && (highRisk || rc >= 9)) ||
    (volProxy >= 0.038 && rc >= 8);

  if (riskOff) return 'risk_off';

  const trending =
    ta >= 17 &&
    sq >= 12 &&
    (mq >= 9 || status === 'triggered' || setupType === 'breakout');

  if (trending) return 'trending';

  const rangeLike =
    (ta <= 13 && sq <= 14 && mq <= 15) ||
    (setupType === 'pullback' && ta <= 15 && sq <= 16);

  if (rangeLike) return 'range';

  if (status === 'developing' || (ta >= 13 && ta <= 17 && sq >= 10 && sq <= 16)) {
    return 'transition';
  }

  return 'transition';
}
