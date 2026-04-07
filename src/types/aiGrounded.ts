import type { MarketRowStatus } from '@/types/markets';

export type AiQuickAction = 'explain' | 'watch' | 'entry';

/** Derived from trend/structure/volatility/scanner — steers AI tone only; does not change facts. */
export type MarketRegime = 'trending' | 'range' | 'risk_off' | 'transition';

/**
 * Serializable package of real inputs for Sigflo AI — omit fields the UI does not have.
 * The model must not be given fabricated placeholders; use `dataGaps` instead.
 */
export type GroundedMarketContext = {
  symbol: string;
  market: 'futures' | 'spot';
  timeframe: string;
  lastPrice?: number;
  entry?: number;
  stop?: number;
  target?: number;
  liquidation?: number;
  change24hPct?: number;
  high24h?: number;
  low24h?: number;
  /** Every price the model is allowed to reference numerically */
  allowedPriceLevels: number[];
  scannerStatus: MarketRowStatus;
  tradeReadinessScore: number;
  signal: {
    id: string;
    side: 'long' | 'short';
    setupType: string;
    setupScore: number;
    setupScoreLabel: string;
    riskTag: string;
    setupTags: string[];
    biasLabel: string;
    scoreBreakdown: {
      trendAlignment: number;
      momentumQuality: number;
      structureQuality: number;
      volumeConfirmation: number;
      riskConditions: number;
    };
    /** Only keys that exist on the signal */
    facts?: Record<string, number | string>;
    watchCue?: string;
    watchNext?: string;
    plannedEntry?: number;
    plannedStop?: number;
    plannedTarget?: number;
  };
  signalNarrative: {
    aiExplanation: string;
    whyThisMatters: string;
  };
  recentCandles?: Array<{ o: number; h: number; l: number; c: number }>;
  /** Explicit missing inputs (model should say insufficient data for these) */
  dataGaps: string[];
  /** Indicator / method names the model may mention (derived from `facts` only) */
  allowedIndicatorTerms: string[];
  /** Classified from engine scores + structure (+ optional candles). */
  marketRegime: MarketRegime;
  /** Prompt-only tone instructions aligned with `marketRegime`. */
  regimeToneGuide: string;
};

/** Strict model output — narrative headline/body is always derived locally from this. */
export type AiStructuredAnalysis = {
  bias: 'long' | 'short' | 'neutral';
  confidence: number;
  reasoning: string;
  levels_used: number[];
  trade_valid: boolean;
  notes: string;
};

export type AssistantResponseGrounded = {
  structured: AiStructuredAnalysis;
  headline: string;
  body: string;
  source: 'local' | 'remote';
};
