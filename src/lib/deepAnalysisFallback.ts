import type { GroundedMarketContext } from '@/types/aiGrounded';
import type { MarketRowStatus } from '@/types/markets';
import type { CryptoSignal } from '@/types/signal';

function trendCue(signal: CryptoSignal): string {
  const t = signal.scoreBreakdown.trendAlignment;
  if (t >= 17) return 'Trend holding';
  if (t <= 10) return 'Weak trend';
  return 'Trend mixed';
}

function momentumCue(signal: CryptoSignal): string {
  const m = signal.scoreBreakdown.momentumQuality;
  if (m >= 14) return 'Momentum building';
  if (m <= 8) return 'Momentum fading';
  return 'Momentum steady';
}

function levelHint(signal: CryptoSignal): string {
  const facts = signal.facts;
  if (typeof facts?.distanceToBreakoutAtr === 'number') {
    if (facts.distanceToBreakoutAtr <= 0.2) return 'near trigger';
    if (facts.distanceToBreakoutAtr >= 0.8) return 'far from trigger';
  }
  if (typeof facts?.pullbackDepthAtr === 'number') {
    if (facts.pullbackDepthAtr >= 1.2) return 'deep pullback';
    if (facts.pullbackDepthAtr <= 0.5) return 'shallow pullback';
  }
  if (typeof facts?.extensionAtr === 'number' && facts.extensionAtr >= 1.4) return 'extended from base';
  return 'at a key level';
}

function entryState(
  status: MarketRowStatus,
  tradeScore: number,
): 'Too early' | 'Ready' | 'Too late' | 'Weak timing' {
  if (status === 'overextended' || tradeScore < 45) return 'Weak timing';
  if (status === 'triggered' && tradeScore >= 65) return 'Ready';
  if (status === 'triggered' && tradeScore < 55) return 'Too late';
  if (status === 'idle') return 'Too early';
  return 'Too early';
}

function formatLevelList(levels: number[]): string {
  return levels.map((n) => n.toLocaleString('en-US', { maximumFractionDigits: 8 })).join(', ');
}

/** Local long-form markdown when the deep-analysis API is unavailable (matches server fallback intent). */
export function buildDeepAnalysisFallback(
  signal: CryptoSignal,
  status: MarketRowStatus,
  tradeScore: number,
  ctx?: GroundedMarketContext,
): { headline: string; body: string } {
  const bias = signal.side === 'long' ? 'Long' : 'Short';
  const timing = entryState(status, tradeScore);
  const b = signal.scoreBreakdown;
  const excerpt = (signal.aiExplanation ?? '').slice(0, 320).trim();
  const why = (signal.whyThisMatters ?? '').slice(0, 220).trim();
  const tf = ctx?.timeframe ? `Chart timeframe in package: **${ctx.timeframe}**. ` : '';
  const mkt = ctx?.market ? `Market mode: **${ctx.market}**. ` : '';
  const regime =
    ctx?.marketRegime != null
      ? `Regime (engine tone context): **${ctx.marketRegime.replace(/_/g, ' ')}**. `
      : '';
  const gaps =
    ctx?.dataGaps?.length ? `Insufficient data in package for: ${ctx.dataGaps.join(', ')}. ` : '';
  const keyLevelsBlock =
    ctx && ctx.allowedPriceLevels.length > 0
      ? `Only these numeric plan prices are in the data package — cite no others: ${formatLevelList(ctx.allowedPriceLevels)}.`
      : 'No discrete plan prices were included in the data package; use the live chart and Sigflo overlays for levels.';

  const body = `## Overview
${tf}${mkt}${regime}${gaps}${bias} ${signal.setupType} on **${signal.pair}**: setup score ${signal.setupScore}/100, scanner status **${status}**, trade readiness ~${Math.round(tradeScore)}. ${excerpt ? `Scanner context: ${excerpt}` : 'Use the live chart and plan levels as primary context.'}

## Market structure
Internal score mix — trend ${b.trendAlignment}/25, structure ${b.structureQuality}/25, momentum ${b.momentumQuality}/20, volume ${b.volumeConfirmation}/15, risk ${b.riskConditions}/15. Price is ${levelHint(signal)} relative to the active setup type.

## Bullish case
A constructive resolution favors continuation: ${signal.setupType === 'breakout' ? 'acceptance beyond the trigger zone with follow-through' : signal.setupType === 'pullback' ? 'defense of the pullback structure and resumption toward trend' : 'orderly digestion without breaking major swing support'}. ${signal.side === 'long' ? 'Long-bias signals need sustained bids and higher lows on relevant timeframes.' : 'Short-bias signals need supply to remain in control after tests.'}

## Bearish case
The trade thesis weakens if the market rejects the key structure: ${signal.setupType === 'breakout' ? 'false breakout / immediate reclaim into the range' : 'failed reclaim — rotation the other way'}. Choppy two-way trade inside the setup zone argues for standing aside.

## Key levels
${keyLevelsBlock}

## Momentum and trend
${trendCue(signal)}; ${momentumCue(signal)}. If momentum is fading into a trigger, require cleaner confirmation before sizing.

## Invalidation
Invalidate when price proves the setup wrong: break and hold beyond the structural level that defines this ${signal.setupType}. Timing label **${timing}** — if you are early or late relative to the trigger, reduce size or wait for a fresh structure.

## Risk factors
Setup risk: **${signal.riskTag}**. ${status === 'overextended' ? 'Status is overextended — chasing hurts expectancy.' : ''} ${why ? `Framing: ${why}` : 'Keep risk per trade modest versus account.'}

## Trade approach
Work the plan in stages: define trigger, size for invalidation distance, add only if follow-through confirms. ${timing === 'Ready' ? 'Readiness is elevated; execution discipline still matters.' : 'Patience: let the scenario prove itself before full commitment.'}`;

  return {
    headline: `${signal.pair} — ${bias} ${signal.setupType} (setup ${signal.setupScore})`,
    body,
  };
}
