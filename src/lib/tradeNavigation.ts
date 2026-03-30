import type { CryptoSignal } from '@/types/signal';
import type { MarketRowStatus } from '@/types/markets';
import { resolveWatchCue } from '@/lib/watchCue';

export type TradeDeepLinkOptions = {
  /** Scanner row state (Markets → Trade continuity). */
  marketStatus?: MarketRowStatus;
};

/** Query string for `/trade` — matches `buildSignalContextFromQuery` in TradeScreen. */
export function buildTradeQueryString(signal: CryptoSignal, options?: TradeDeepLinkOptions): string {
  const qp = new URLSearchParams({
    signal: signal.id,
    pair: signal.pair,
    setupScore: String(signal.setupScore),
    setupScoreLabel: signal.setupScoreLabel,
    setupType: signal.setupType,
    trend: String(signal.scoreBreakdown.trendAlignment),
    momentum: String(signal.scoreBreakdown.momentumQuality),
    structure: String(signal.scoreBreakdown.structureQuality),
    volume: String(signal.scoreBreakdown.volumeConfirmation),
    risk: String(signal.scoreBreakdown.riskConditions),
    explanation: signal.aiExplanation,
    tags: signal.setupTags.join(','),
    riskTag: signal.riskTag,
    side: signal.side,
    biasLabel: signal.biasLabel,
    watch: resolveWatchCue(signal),
  });
  if (options?.marketStatus) qp.set('marketStatus', options.marketStatus);
  return qp.toString();
}
