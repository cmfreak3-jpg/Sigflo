import type { CryptoSignal } from '@/types/signal';
import type { MarketRowStatus } from '@/types/markets';
import type { PositionItem } from '@/types/integrations';
import { deriveMarketStatus, symbolToPair } from '@/lib/marketScannerRows';
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

/**
 * Bots screen → full Trade chart: use the bot’s linked signal when present, otherwise first watched pair.
 */
export function buildBotViewChartTradeQuery(
  bot: { id: string; watchedPairs: string[] },
  signal: CryptoSignal | null,
): string {
  if (signal) {
    return buildTradeQueryString(signal, { marketStatus: deriveMarketStatus(signal) });
  }
  const raw = bot.watchedPairs[0]?.trim() || 'BTC';
  const linear = raw.toUpperCase().endsWith('USDT') ? raw.toUpperCase() : `${raw.toUpperCase()}USDT`;
  const pair = symbolToPair(linear);
  const qp = new URLSearchParams({
    pair,
    side: 'long',
    signal: `bot-chart-${bot.id}`,
    setupScore: '55',
    trend: '12',
    momentum: '12',
    structure: '12',
    volume: '8',
    risk: '8',
    setupScoreLabel: 'Developing',
    setupType: 'breakout',
    tags: 'Breakout',
    riskTag: 'Medium Risk',
    explanation: 'Chart opened from your bot — watching this market.',
    marketStatus: 'developing',
    biasLabel: 'Bot watch',
    mode: 'entry',
  });
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
  /** Exchange-reported leverage for manage-mode display. */
  leverage?: number;
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
    if (extras.leverage != null && Number.isFinite(extras.leverage) && extras.leverage > 0) {
      qp.set('leverage', String(Math.round(extras.leverage)));
    }
  }

  return qp.toString();
}

/**
 * `/trade` query for `mode=manage` from a live linear leg (same shape as Portfolio → Trade).
 * Notional uses `|size| × entry` like portfolio cards, not mark × size.
 */
export function buildManageTradeQueryFromLinearPosition(
  pos: PositionItem,
  options?: { markPrice?: number; leverageFallback?: number },
): string {
  const notional = Math.abs(pos.size * pos.entryPrice);
  const mark =
    options?.markPrice ??
    (pos.markPrice != null && pos.markPrice > 0 ? pos.markPrice : pos.entryPrice);
  const tradeExtras: PortfolioPositionTradeExtras = {
    positionUsd: Math.max(1, Math.round(notional)),
    entryPrice: pos.entryPrice,
    posSize: pos.size,
    markPrice: Number.isFinite(mark) && mark > 0 ? mark : undefined,
    leverage:
      pos.leverage != null && pos.leverage > 0
        ? pos.leverage
        : options?.leverageFallback != null && options.leverageFallback > 0
          ? Math.round(options.leverageFallback)
          : undefined,
  };
  return buildPortfolioPositionTradeQuery(pos.symbol, pos.side, tradeExtras);
}
