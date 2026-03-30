export type SignalSide = 'long' | 'short';
export type SignalSetupTag = 'Breakout' | 'Pullback' | 'Overextended';
export type SignalRiskTag = 'Low Risk' | 'Medium Risk' | 'High Risk';
export type SetupScoreLabel = 'Elite setup' | 'Strong setup' | 'Developing' | 'Low quality' | 'Avoid';
export type SignalSetupType = 'breakout' | 'pullback' | 'overextended';

export interface SetupScoreBreakdown {
  trendAlignment: number; // 0-25
  momentumQuality: number; // 0-20
  structureQuality: number; // 0-25
  volumeConfirmation: number; // 0-15
  riskConditions: number; // 0-15
}

export interface CryptoSignal {
  id: string;
  pair: string;
  side: SignalSide;
  biasLabel: string;
  setupScore: number; // out of 100
  setupScoreLabel: SetupScoreLabel;
  setupType: SignalSetupType;
  scoreBreakdown: SetupScoreBreakdown;
  facts?: {
    emaTrend?: 'bullish' | 'bearish' | 'neutral';
    volumeRatio?: number;
    rsi?: number;
    distanceToBreakoutAtr?: number;
    pullbackDepthAtr?: number;
    extensionAtr?: number;
  };
  riskTag: SignalRiskTag;
  setupTags: SignalSetupTag[];
  exchange: string;
  postedAgo: string;
  aiExplanation: string;
  whyThisMatters: string;
  /** Optional one-line “what to watch” for UI; otherwise derived in `resolveWatchCue`. */
  watchCue?: string;
  /** Optional forward cue (“what happens next”); otherwise derived in `resolveWatchNextCue`. */
  watchNext?: string;
}
