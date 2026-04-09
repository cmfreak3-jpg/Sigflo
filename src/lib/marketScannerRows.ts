import { calculateSetupScore, getSetupScoreLabel } from '@/lib/setupScore';
import type { MarketScannerRow, MarketRowStatus, MarketScoreTrend } from '@/types/markets';
import type { CryptoSignal, SetupScoreBreakdown, SignalSetupType } from '@/types/signal';
import type { SymbolTicker } from '@/types/market';

/** Core watchlist symbols (scanner / signal engine focus). Order is preserved in UI. */
export const TRACKED_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'AVAXUSDT', 'LINKUSDT'] as const;
export type TrackedSymbol = (typeof TRACKED_SYMBOLS)[number];

/** How many symbols to show (top 24h % gainers among USDT linear perpetuals). */
export const GAINERS_LIMIT = 15;
/** Top 24h % losers (negative movers) merged into the Movers tab for short-bias tape. */
export const LOSERS_LIMIT = 10;
/** @deprecated Use GAINERS_LIMIT */
export const TRENDING_LIMIT = GAINERS_LIMIT;

/** Base asset for display / engine match (e.g. BTCUSDT → BTC). */
export function symbolToPair(symbol: string): string {
  return symbol.endsWith('USDT') ? symbol.slice(0, -4) : symbol;
}

/**
 * Top gainers = highest positive 24h % change among linear USDT perpetuals.
 */
export function rankTopGainers(tickers: SymbolTicker[], limit: number): SymbolTicker[] {
  return [...tickers]
    .filter((t) => t.symbol.endsWith('USDT') && t.price24hPcnt > 0)
    .sort((a, b) => b.price24hPcnt - a.price24hPcnt)
    .slice(0, limit);
}

/** Deepest 24h % drops among USDT linear perpetuals (excludes flat / positive). */
export function rankTopLosers(tickers: SymbolTicker[], limit: number): SymbolTicker[] {
  return [...tickers]
    .filter((t) => t.symbol.endsWith('USDT') && t.price24hPcnt < 0)
    .sort((a, b) => a.price24hPcnt - b.price24hPcnt)
    .slice(0, limit);
}

/** Gainers first, then worst losers not already listed (for Movers grid + WS extras). */
export function rankMoversUniverse(tickers: SymbolTicker[]): SymbolTicker[] {
  const gainers = rankTopGainers(tickers, GAINERS_LIMIT);
  const sym = new Set(gainers.map((t) => t.symbol));
  const losers = rankTopLosers(tickers, LOSERS_LIMIT).filter((t) => !sym.has(t.symbol));
  return [...gainers, ...losers];
}

/** Above this 24h move %, synthetic Movers treat the tape as overextended (rare among “only green” lists). */
const MOVER_OVEREXTENDED_PCT = 18;
const MOVER_PULLBACK_PCT = 4;

function buildSyntheticTrendingSignal(symbol: string, pair: string, ticker: SymbolTicker): CryptoSignal {
  const movePct = Math.abs(ticker.price24hPcnt * 100);
  const liq = Math.log10(Math.max(1, ticker.turnover24h));
  let breakdown: SetupScoreBreakdown = {
    trendAlignment: Math.min(25, Math.round(8 + movePct * 0.85)),
    momentumQuality: Math.min(20, Math.round(6 + movePct * 0.95)),
    structureQuality: Math.min(25, Math.round(10 + liq * 1.8)),
    volumeConfirmation: Math.min(15, Math.round(5 + liq * 1.2)),
    riskConditions: Math.min(15, Math.round(6 + (movePct > 8 ? 4 : 0))),
  };
  const up = ticker.price24hPcnt >= 0;
  let setupType: SignalSetupType = 'breakout';
  let tag: 'Breakout' | 'Pullback' | 'Overextended' = 'Breakout';
  if (movePct > MOVER_OVEREXTENDED_PCT) {
    setupType = 'overextended';
    tag = 'Overextended';
    // Pull back trend/momentum; keep structure/volume tied to liquidity so scores still spread across names.
    breakdown = {
      trendAlignment: Math.min(17, Math.round(breakdown.trendAlignment * 0.78)),
      momentumQuality: Math.min(14, Math.round(breakdown.momentumQuality * 0.72)),
      structureQuality: Math.min(22, Math.round(breakdown.structureQuality * 0.88)),
      volumeConfirmation: Math.min(13, breakdown.volumeConfirmation),
      riskConditions: Math.min(14, breakdown.riskConditions + 2),
    };
  } else if (movePct > MOVER_PULLBACK_PCT) {
    setupType = 'pullback';
    tag = 'Pullback';
  }
  let setupScore = calculateSetupScore(breakdown);
  // Never label synthetic overextended movers as Elite (85+); do not flatten everyone to one number.
  if (setupType === 'overextended') {
    setupScore = Math.min(setupScore, 82);
  }
  const setupScoreLabel = getSetupScoreLabel(setupScore);
  const aiExplanation =
    setupType === 'overextended'
      ? up
        ? `Extended 24h move (+${movePct.toFixed(1)}%): participation is hot — mean-reversion risk rises with the extension.`
        : `Heavy 24h selloff (−${movePct.toFixed(1)}%): selling is stretched — sharp bounces can rip if shorts pile in late.`
      : setupType === 'pullback'
        ? up
          ? `Strong 24h bid (+${movePct.toFixed(1)}%) with tape still constructive — watch whether dips find buyers.`
          : `Weak 24h tape (−${movePct.toFixed(1)}%) — bounces stay fragile until flow improves.`
        : up
          ? `Gaining tape (+${movePct.toFixed(1)}%): trend and flow are improving; next leg depends on hold vs fade.`
          : `Soft 24h tape (−${movePct.toFixed(1)}%): flow is soft; next leg depends on support vs continuation.`;
  const watchCue =
    setupType === 'overextended'
      ? up
        ? 'rejection or continuation'
        : 'capitulation or dead-cat bounce'
      : setupType === 'pullback'
        ? up
          ? 'buyers holding dip bids vs rollover'
          : 'sellers capping rallies vs breakdown'
        : up
          ? 'hold vs fade — next candle confirms bias'
          : 'pressure vs bounce — next candle confirms bias';
  return {
    id: `trend-${symbol}`,
    pair,
    side: up ? 'long' : 'short',
    biasLabel: up ? 'Potential Long' : 'Potential Short',
    setupType,
    setupScore,
    setupScoreLabel,
    scoreBreakdown: breakdown,
    riskTag: movePct > 10 ? 'High Risk' : movePct > 4 ? 'Medium Risk' : 'Low Risk',
    setupTags: [tag],
    exchange: 'Bybit',
    postedAgo: 'Live',
    aiExplanation,
    whyThisMatters: 'Fast leaders attract attention; size and stops matter more than chasing the move.',
    watchCue,
  };
}

function pickSignalForMarket(
  symbol: string,
  pair: string,
  engineSignals: CryptoSignal[],
  ticker: SymbolTicker,
): CryptoSignal {
  const byEngine = engineSignals.find((s) => s.pair === pair);
  if (byEngine) return byEngine;
  return buildSyntheticTrendingSignal(symbol, pair, ticker);
}

/** When the engine has not emitted for a tracked pair yet — live ticker still drives row prices. */
export function buildTrackedFallbackSignal(pair: string, symbol: string): CryptoSignal {
  /** Sum under 45 → scanner `idle` / Feed "Setup forming" until detectors qualify a live row. */
  const breakdown: SetupScoreBreakdown = {
    trendAlignment: 10,
    momentumQuality: 8,
    structureQuality: 9,
    volumeConfirmation: 6,
    riskConditions: 6,
  };
  const setupScore = calculateSetupScore(breakdown);
  return {
    id: `tracked-${symbol}`,
    pair,
    side: 'long',
    biasLabel: 'Forming',
    setupType: 'breakout',
    setupScore,
    setupScoreLabel: getSetupScoreLabel(setupScore),
    scoreBreakdown: breakdown,
    riskTag: 'Medium Risk',
    setupTags: ['Breakout'],
    exchange: 'Bybit',
    postedAgo: 'Live',
    aiExplanation: 'Core watchlist — waiting for a clearer structural edge from the engine.',
    whyThisMatters: 'Liquidity and attention are high; confirmation still matters before sizing.',
    watchCue: 'next impulse — does volume confirm the break?',
  };
}

/**
 * Fixed watchlist rows: engine signal by pair, else a neutral shell until the detector fires.
 */
export function buildTrackedScannerRows(
  engineSignals: CryptoSignal[],
  tickersBySymbol: Record<string, SymbolTicker>,
): MarketScannerRow[] {
  return TRACKED_SYMBOLS.map((symbol) => {
    const pair = symbolToPair(symbol);
    const ticker = tickersBySymbol[symbol];
    const fromEngine = engineSignals.find((s) => s.pair === pair);
    const signal = fromEngine ?? buildTrackedFallbackSignal(pair, symbol);

    const lastPrice = ticker != null ? ticker.lastPrice : Number.NaN;
    const change24hPct = ticker != null ? ticker.price24hPcnt * 100 : Number.NaN;
    const status = deriveMarketStatus(signal);
    const setupTag = signal.setupTags[0];

    return {
      symbol,
      pair,
      signal,
      lastPrice,
      change24hPct,
      setupScore: signal.setupScore,
      setupScoreLabel: signal.setupScoreLabel,
      insight: signal.aiExplanation,
      setupTag,
      status,
    };
  });
}

/** Synthetic Movers cards use ids `trend-{SYMBOL}` — status should not mirror engine “trigger” semantics. */
function isSyntheticMoverSignal(signal: CryptoSignal): boolean {
  return signal.id.startsWith('trend-');
}

export function deriveMarketStatus(signal: CryptoSignal): MarketRowStatus {
  if (signal.setupType === 'overextended') return 'overextended';
  // List gainers with heuristic “pullback” are constructive tape, not a fired setup.
  if (isSyntheticMoverSignal(signal) && signal.setupType === 'pullback') {
    if (signal.setupScore >= 45) return 'developing';
    return 'idle';
  }
  // Synthetic breakout on the movers list: still cap at developing unless clearly extreme.
  if (isSyntheticMoverSignal(signal) && signal.setupType === 'breakout') {
    if (signal.setupScore >= 85) return 'triggered';
    if (signal.setupScore >= 45) return 'developing';
    return 'idle';
  }
  if (signal.setupScore >= 70) return 'triggered';
  if (signal.setupScore >= 45) return 'developing';
  return 'idle';
}

/** Same rules as Feed → “Actionable” filter (triggered/developing, score ≥ 65, not overextended). */
export function isFeedActionableOpportunity(signal: CryptoSignal): boolean {
  const status = deriveMarketStatus(signal);
  if (status === 'overextended') return false;
  if (status !== 'triggered' && status !== 'developing') return false;
  return signal.setupScore >= 65;
}

export function buildMarketScannerRows(
  engineSignals: CryptoSignal[],
  tickersBySymbol: Record<string, SymbolTicker>,
): MarketScannerRow[] {
  const all = Object.values(tickersBySymbol);
  const ranked = rankMoversUniverse(all);

  return ranked.map((t) => {
    const symbol = t.symbol;
    const pair = symbolToPair(symbol);
    const signal = pickSignalForMarket(symbol, pair, engineSignals, t);
    const lastPrice = t.lastPrice;
    const change24hPct = t.price24hPcnt * 100;
    const status = deriveMarketStatus(signal);
    const setupTag = signal.setupTags[0];

    return {
      symbol,
      pair,
      signal,
      lastPrice,
      change24hPct,
      setupScore: signal.setupScore,
      setupScoreLabel: signal.setupScoreLabel,
      insight: signal.aiExplanation,
      setupTag,
      status,
    };
  });
}

export function countActiveSetups(rows: MarketScannerRow[], minScore = 70): number {
  return rows.filter((r) => r.setupScore >= minScore).length;
}

export function countMarketRowStatuses(rows: MarketScannerRow[]): Record<MarketRowStatus, number> {
  const out: Record<MarketRowStatus, number> = { idle: 0, developing: 0, triggered: 0, overextended: 0 };
  for (const r of rows) out[r.status]++;
  return out;
}

export function parseMarketStatusQuery(v: string | null): MarketRowStatus | null {
  if (v === 'idle' || v === 'developing' || v === 'triggered' || v === 'overextended') return v;
  return null;
}

export function scannerStatusTitle(status: MarketRowStatus): string {
  switch (status) {
    case 'triggered':
      return 'In play';
    case 'developing':
      return 'Developing';
    case 'overextended':
      return 'Overextended';
    default:
      return 'Idle';
  }
}

/** e.g. "In play Pullback" for Trade continuity strip. */
export function formatTradeScannerStateLine(status: MarketRowStatus, setupType: SignalSetupType): string {
  const statusLabel = scannerStatusTitle(status);
  const setupLabel = setupType.charAt(0).toUpperCase() + setupType.slice(1);
  if (statusLabel === setupLabel) return statusLabel;
  return `${statusLabel} ${setupLabel}`;
}

/** One-line pull under insight when setup is in play (scanner / trade / feed). */
export function inPlayMicroHeadline(setupType: SignalSetupType): string {
  if (setupType === 'breakout') return 'Breakout attempt in progress';
  return 'Setup is active — watching for continuation';
}

/** Micro structural confidence for in-play rows (analytical, not hype). */
export function inPlayStructureConfidence(signal: Pick<CryptoSignal, 'setupType'>): string {
  if (signal.setupType === 'pullback') return 'Clean pullback structure';
  return 'Structure holding';
}

/** Mutable store for `attachTriggerTimestamps` (hold in a ref in the scanner hook). */
export interface TriggerTimingRefs {
  prevStatusBySymbol: Record<string, MarketRowStatus>;
  triggeredAtBySymbol: Record<string, number>;
}

/**
 * Sets `triggeredAtMs` when a row first enters in-play; clears when it leaves.
 * Mutates `refs` and updates prev status for each symbol in `rows`.
 * `scopeId` separates Tracked vs Movers so the two lists do not clobber each other.
 */
export function attachTriggerTimestamps(
  rows: MarketScannerRow[],
  refs: TriggerTimingRefs,
  scopeId: string,
): MarketScannerRow[] {
  const k = (symbol: string) => `${scopeId}:${symbol}`;
  const out = rows.map((r) => {
    const key = k(r.symbol);
    const was = refs.prevStatusBySymbol[key];
    if (r.status === 'triggered' && was !== 'triggered') {
      refs.triggeredAtBySymbol[key] = Date.now();
    }
    if (r.status !== 'triggered') {
      delete refs.triggeredAtBySymbol[key];
    }
    if (r.status === 'triggered' && refs.triggeredAtBySymbol[key] === undefined) {
      refs.triggeredAtBySymbol[key] = Date.now();
    }
    const triggeredAtMs = r.status === 'triggered' ? refs.triggeredAtBySymbol[key] : undefined;
    return { ...r, triggeredAtMs };
  });
  for (const r of rows) {
    refs.prevStatusBySymbol[k(r.symbol)] = r.status;
  }
  return out;
}

/**
 * Attention routing: `triggered` rows always first, then by newest `triggeredAtMs`,
 * then score. All other statuses keep original list order.
 */
export function sortScannerRowsForTapPriority(rows: MarketScannerRow[]): MarketScannerRow[] {
  const tagged = rows.map((r, i) => ({ r, i }));
  tagged.sort((a, b) => {
    const aPlay = a.r.status === 'triggered' ? 1 : 0;
    const bPlay = b.r.status === 'triggered' ? 1 : 0;
    if (aPlay !== bPlay) return bPlay - aPlay;
    if (aPlay === 1) {
      const ta = a.r.triggeredAtMs ?? -1;
      const tb = b.r.triggeredAtMs ?? -1;
      if (tb !== ta) return tb - ta;
      if (b.r.setupScore !== a.r.setupScore) return b.r.setupScore - a.r.setupScore;
      return a.r.symbol.localeCompare(b.r.symbol);
    }
    return a.i - b.i;
  });
  return tagged.map(({ r }) => r);
}

/** Timing fragment for status line (`Triggered 6m ago` when `compactMinutes`). */
export function formatInPlayTimingCue(
  triggeredAtMs: number | undefined,
  postedAgo: string | undefined,
  nowMs: number = Date.now(),
  compactMinutes = false,
): string {
  if (triggeredAtMs != null && Number.isFinite(triggeredAtMs)) {
    const sec = Math.max(0, Math.floor((nowMs - triggeredAtMs) / 1000));
    if (sec < 50) return 'Just triggered';
    if (sec < 3600) {
      const m = Math.max(1, Math.floor(sec / 60));
      return compactMinutes ? `Triggered ${m}m ago` : `Triggered ${m} min ago`;
    }
    const h = Math.floor(sec / 3600);
    if (compactMinutes) return h === 1 ? 'Triggered 1h ago' : `Triggered ${h}h ago`;
    return h === 1 ? 'Triggered 1 hr ago' : `Triggered ${h} hr ago`;
  }
  const ago = postedAgo?.trim();
  if (ago && ago.toLowerCase() !== 'live') {
    const compactMin = /^(\d+)\s*m\s*ago$/i.exec(ago);
    if (compactMin) {
      return compactMinutes ? `Triggered ${compactMin[1]}m ago` : `Triggered ${compactMin[1]} min ago`;
    }
    return ago;
  }
  return 'Just triggered';
}

export function attachScoreTrends(
  rows: MarketScannerRow[],
  previousScores: Record<string, number>,
): MarketScannerRow[] {
  return rows.map((r) => {
    const prev = previousScores[r.symbol];
    let scoreTrend: MarketScoreTrend = null;
    if (prev !== undefined) {
      if (r.setupScore > prev) scoreTrend = 'up';
      else if (r.setupScore < prev) scoreTrend = 'down';
      else scoreTrend = 'flat';
    }
    return { ...r, scoreTrend };
  });
}
