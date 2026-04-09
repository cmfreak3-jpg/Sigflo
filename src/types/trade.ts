export type MarketMode = 'futures' | 'spot';
export type TradeSide = 'long' | 'short';
export type TradeTrend = 'Bullish' | 'Bearish' | 'Neutral';
export type TradeMomentum = 'Strong' | 'Building' | 'Weak';
export type RiskLevel = 'Low' | 'Medium' | 'High';

export interface TradeChartCandle {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface AiInsight {
  trend: TradeTrend;
  momentum: TradeMomentum;
  risk: RiskLevel;
  summary: string;
}

export interface RiskSummary {
  setupScore: number;
  positionSizeUsd: number;
  walletUsedPct: number;
  recommendedUsagePct: number;
  oversizingRelativeToSetup: boolean;
  liquidationBufferPct: number;
  liquidationRisk: RiskLevel;
  riskMeterPct: number;
  tradeScore: number;
  setupTradeConflictMessage?: string;
  walletImpactLabel: string;
  primaryMessage: string;
  warnings: string[];
}

export interface TradeViewModel {
  pair: string;
  side: TradeSide;
  lastPrice: number;
  change24hPct: number;
  high24h: number;
  low24h: number;
  volume24h: string;
  entry: number;
  stop: number;
  target: number;
  liquidation: number;
  balanceUsd: number;
  amountUsedUsd: number;
  leverage: number;
  positionSizeUsd: number;
  targetProfitUsd: number;
  stopLossUsd: number;
  riskReward: number;
  aiInsight: AiInsight;
  /** Normalized 0–1 sparkline series for chart mini-plot (oldest → newest). */
  priceSeries: number[];
  /** Optional OHLC series for real candlestick rendering (oldest -> newest). */
  chartCandles?: TradeChartCandle[];
}
