/** Keep in sync with `src/lib/marketRegime.ts` (tone strings + classification). */

export const REGIME_TONE_GUIDE = {
  trending:
    'Tone: confident, continuation-focused desk trader. Stress trend alignment and what would extend vs stall the move. Prefer decisive phrasing when subscores support it — never fabricate catalysts or levels.',
  range:
    'Tone: cautious and two-sided. Emphasize range edges, chop risk, and what would confirm a breakout either way. Avoid false certainty; balance bull/bear mechanics from the package only.',
  risk_off:
    'Tone: defensive and alert. Lead with risk flags (scanner status, risk tag, riskConditions). Short, clear warnings; prioritize what invalidates or stretches the setup. No fear-mongering beyond the data.',
  transition:
    'Tone: observational; wait for confirmation. Call out mixed or evolving structure, developing status, and concrete triggers that would clarify direction. No strong directional hype the scores do not support.',
};

const REGIMES = new Set(['trending', 'range', 'risk_off', 'transition']);

export function normalizeMarketRegime(v) {
  return typeof v === 'string' && REGIMES.has(v) ? v : 'transition';
}

export function deriveMarketRegimeMinimalFromRequest(req) {
  const b = req.signal?.scoreBreakdown || {};
  const ta = b.trendAlignment ?? 0;
  const sq = b.structureQuality ?? 0;
  const mq = b.momentumQuality ?? 0;
  const rc = b.riskConditions ?? 0;
  const status = req.status;
  const riskTag = req.signal?.riskTag;
  const setupType = req.signal?.setupType;
  const highRisk = riskTag === 'High Risk';

  if (rc >= 11 || (highRisk && rc >= 8) || (status === 'overextended' && (highRisk || rc >= 9))) {
    return 'risk_off';
  }
  if (ta >= 17 && sq >= 12 && (mq >= 9 || status === 'triggered' || setupType === 'breakout')) {
    return 'trending';
  }
  if ((ta <= 13 && sq <= 14 && mq <= 15) || (setupType === 'pullback' && ta <= 15 && sq <= 16)) {
    return 'range';
  }
  if (status === 'developing' || (ta >= 13 && ta <= 17 && sq >= 10 && sq <= 16)) {
    return 'transition';
  }
  return 'transition';
}

function volProxyFromCandles(candles) {
  if (!Array.isArray(candles) || candles.length < 6) return 0;
  const slice = candles.slice(-8);
  let sum = 0;
  let n = 0;
  for (const c of slice) {
    const cc = c?.c ?? c?.close;
    const h = c?.h ?? c?.high;
    const l = c?.l ?? c?.low;
    if (typeof cc === 'number' && cc > 0 && typeof h === 'number' && typeof l === 'number' && h >= l) {
      sum += (h - l) / cc;
      n += 1;
    }
  }
  return n > 0 ? sum / n : 0;
}

/** Full ctx shape like client `GroundedMarketContext`. */
export function deriveMarketRegimeFromContextLike(ctx) {
  if (!ctx || !ctx.signal?.scoreBreakdown) return 'transition';
  const b = ctx.signal.scoreBreakdown;
  const ta = b.trendAlignment ?? 0;
  const sq = b.structureQuality ?? 0;
  const mq = b.momentumQuality ?? 0;
  const rc = b.riskConditions ?? 0;
  const status = ctx.scannerStatus;
  const riskTag = ctx.signal.riskTag;
  const setupType = ctx.signal.setupType;
  const highRisk = riskTag === 'High Risk';
  const volProxy = volProxyFromCandles(ctx.recentCandles);

  const riskOff =
    rc >= 11 ||
    (highRisk && rc >= 8) ||
    (status === 'overextended' && (highRisk || rc >= 9)) ||
    (volProxy >= 0.038 && rc >= 8);

  if (riskOff) return 'risk_off';
  if (ta >= 17 && sq >= 12 && (mq >= 9 || status === 'triggered' || setupType === 'breakout')) return 'trending';
  if ((ta <= 13 && sq <= 14 && mq <= 15) || (setupType === 'pullback' && ta <= 15 && sq <= 16)) return 'range';
  if (status === 'developing' || (ta >= 13 && ta <= 17 && sq >= 10 && sq <= 16)) return 'transition';
  return 'transition';
}
