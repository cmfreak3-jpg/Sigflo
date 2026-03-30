import type { SetupScoreBreakdown, SignalSetupTag, SignalSide } from '@/types/signal';

export const SCANNER_UNIVERSE = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'AVAXUSDT',
  'LINKUSDT',
  'XRPUSDT',
  'DOGEUSDT',
] as const;

export type ScannerSymbol = (typeof SCANNER_UNIVERSE)[number];
export type CandleInterval = '1m' | '5m' | '15m';
export type SetupType = 'breakout' | 'pullback' | 'overextended';

export interface Candle {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed?: boolean;
}

export interface CandleSeriesByInterval {
  '1m': Candle[];
  '5m': Candle[];
  '15m': Candle[];
}

export interface IndicatorSnapshot {
  ema20: number;
  ema50: number;
  ema20Slope: number;
  ema50Slope: number;
  rsi14: number;
  rsi14Slope: number;
  atr14: number;
  avgVolume20: number;
  localSwingHigh: number;
  localSwingLow: number;
  breakoutDistanceAtr: number;
  pullbackDepthAtr: number;
}

export interface ExplanationFacts {
  emaTrend: 'bullish' | 'bearish' | 'neutral';
  rsi: number;
  rsiSlope: number;
  volumeRatio: number;
  breakoutDistanceAtr: number;
  pullbackDepthAtr: number;
  extensionAtr: number;
}

export interface SignalCandidate {
  symbol: string;
  setupType: SetupType;
  directionBias: SignalSide;
  biasLabel: string;
  tags: SignalSetupTag[];
  scoreBreakdown: SetupScoreBreakdown;
  setupScore: number;
  explanationFacts: ExplanationFacts;
  confirmedOnClosedCandle: boolean;
  timestamp: number;
}

export interface DetectorInput {
  symbol: string;
  candles: Candle[];
  indicators: IndicatorSnapshot;
  lastCandleClosed: boolean;
}

export interface ScannerFilterConfig {
  minSetupScore: number;
  cooldownMs: number;
  minScoreImprovement: number;
}

export interface EmittedSignalState {
  lastEmittedAt: number;
  lastSetupScore: number;
}

export type EmittedSignalStateMap = Record<string, EmittedSignalState>;
