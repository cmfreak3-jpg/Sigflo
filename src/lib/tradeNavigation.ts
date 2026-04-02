import type { CryptoSignal } from '@/types/signal';
import type { MarketRowStatus } from '@/types/markets';
import { symbolToPair } from '@/lib/marketScannerRows';
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
  qp.set('mode', 'entry');
  return qp.toString();
}

export type PortfolioPositionTradeExtras = {
  /** USDT notional (size × entry) — pre-fills margin slider on Trade. */
  positionUsd?: number;
  /** Live entry from the exchange — anchors chart / PnL context. */
  entryPrice?: number;
  /** Contract / coin size for manage-mode summary. */
  posSize?: number;
  /** Mark / last for manage-mode PnL display. */
  markPrice?: number;
  /** From swipe actions on portfolio cards. */
  ticketIntent?: 'close' | 'add';
};

/**
 * Minimal `/trade` query from an exchange position (portfolio → chart / ticket shell).
 * Satisfies `buildSignalContextFromQuery` so the Trade screen loads without feed signals.
 */
export function buildPortfolioPositionTradeQuery(
  symbol: string,
  side: 'long' | 'short',
  extras?: PortfolioPositionTradeExtras,
): string {
  const pair = symbolToPair(symbol);
  const qp = new URLSearchParams({
    pair,
    side,
    signal: `pf-${pair}`,
    setupScore: '58',
    trend: '14',
    momentum: '14',
    structure: '14',
    volume: '10',
    risk: '10',
    setupScoreLabel: 'Developing',
    setupType: 'breakout',
    tags: 'Breakout',
    riskTag: 'Medium Risk',
    explanation: 'Chart context opened from your portfolio position.',
    marketStatus: 'developing',
    biasLabel: side === 'long' ? 'Position long' : 'Position short',
  });
  const hasUsd = extras?.positionUsd != null && Number.isFinite(extras.positionUsd) && extras.positionUsd > 0;
  const hasEntry = extras?.entryPrice != null && Number.isFinite(extras.entryPrice) && extras.entryPrice > 0;
  if (hasUsd) {
    qp.set('positionUsd', String(Math.round(extras.positionUsd!)));
  }
  if (hasEntry) {
    qp.set('portfolioEntry', String(extras.entryPrice));
  }
  if (extras?.ticketIntent === 'close' || extras?.ticketIntent === 'add') {
    qp.set('ticketIntent', extras.ticketIntent);
  }

  /** Manage mode only when leg data is complete; otherwise Trade falls back to entry-style shell. */
  if (hasUsd && hasEntry && extras) {
    qp.set('mode', 'manage');
    if (extras.posSize != null && Number.isFinite(extras.posSize)) {
      qp.set('posSize', String(extras.posSize));
    }
    if (extras.markPrice != null && Number.isFinite(extras.markPrice) && extras.markPrice > 0) {
      qp.set('markPrice', String(extras.markPrice));
    }
  }

  return qp.toString();
}
