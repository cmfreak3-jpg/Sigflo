import type { TradeViewModel } from '@/types/trade';

/** Mock trade view aligned with BTC long signal for demo */
export const mockTradeBtcLong: TradeViewModel = {
  pair: 'BTC / USDT',
  side: 'long',
  lastPrice: 67185.2,
  change24hPct: 2.34,
  high24h: 67840.0,
  low24h: 65120.5,
  volume24h: '$1.42B',
  entry: 67240.5,
  stop: 65890.0,
  target: 68920.0,
  liquidation: 62104.0,
  balanceUsd: 12480.5,
  amountUsedUsd: 2500.0,
  leverage: 12,
  positionSizeUsd: 30000.0,
  targetProfitUsd: 752.4,
  stopLossUsd: -506.25,
  riskReward: 1.49,
  aiInsight: {
    trend: 'Bullish',
    momentum: 'Building',
    risk: 'Medium',
    summary: 'Momentum is strong, but price is extended - chasing here increases pullback risk.',
  },
  priceSeries: [
    0.42, 0.45, 0.44, 0.48, 0.47, 0.52, 0.51, 0.55, 0.54, 0.58, 0.56, 0.6, 0.59, 0.62, 0.64, 0.63, 0.66, 0.65,
    0.68, 0.7, 0.69, 0.72, 0.71, 0.74, 0.73, 0.76, 0.75, 0.78, 0.77, 0.8, 0.79, 0.82, 0.81, 0.84, 0.83, 0.86,
    0.85, 0.88, 0.87, 0.9, 0.89, 0.92, 0.91, 0.94, 0.93, 0.96, 0.95, 0.98,
  ],
};

export const mockTradeSolLong: TradeViewModel = {
  pair: 'SOL / USDT',
  side: 'long',
  lastPrice: 142.5,
  change24hPct: 3.1,
  high24h: 148.2,
  low24h: 136.8,
  volume24h: '$412M',
  entry: 143.1,
  stop: 138.4,
  target: 152.0,
  liquidation: 118.0,
  balanceUsd: 10000.0,
  amountUsedUsd: 1500.0,
  leverage: 10,
  positionSizeUsd: 15000.0,
  targetProfitUsd: 445.0,
  stopLossUsd: -285.0,
  riskReward: 1.56,
  aiInsight: {
    trend: 'Bullish',
    momentum: 'Building',
    risk: 'Medium',
    summary: 'Trend holds; watch for volume confirmation on the next impulse.',
  },
  priceSeries: [
    0.5, 0.52, 0.51, 0.54, 0.53, 0.56, 0.55, 0.58, 0.57, 0.6, 0.59, 0.62, 0.61, 0.64, 0.63, 0.66, 0.65, 0.68,
    0.67, 0.7, 0.69, 0.72, 0.71, 0.74, 0.73, 0.76, 0.75, 0.78, 0.77, 0.8, 0.79, 0.82, 0.81, 0.84, 0.83, 0.86,
    0.85, 0.88, 0.87, 0.9, 0.89, 0.92, 0.91, 0.94, 0.93, 0.96, 0.95, 0.98,
  ],
};

export const mockTradeEthShort: TradeViewModel = {
  pair: 'ETH / USDT',
  side: 'short',
  lastPrice: 3518.9,
  change24hPct: -1.12,
  high24h: 3588.0,
  low24h: 3482.1,
  volume24h: '$892M',
  entry: 3522.4,
  stop: 3610.8,
  target: 3410.0,
  liquidation: 3820.5,
  balanceUsd: 8420.0,
  amountUsedUsd: 1200.0,
  leverage: 8,
  positionSizeUsd: 9600.0,
  targetProfitUsd: 306.5,
  stopLossUsd: -241.0,
  riskReward: 1.27,
  aiInsight: {
    trend: 'Bearish',
    momentum: 'Strong',
    risk: 'Medium',
    summary: 'Breakdown structure is clean, but shorting into support can trap late entries.',
  },
  priceSeries: [
    0.88, 0.86, 0.87, 0.84, 0.85, 0.82, 0.83, 0.8, 0.81, 0.78, 0.79, 0.76, 0.77, 0.74, 0.75, 0.72, 0.73, 0.7,
    0.71, 0.68, 0.69, 0.66, 0.67, 0.64, 0.65, 0.62, 0.63, 0.6, 0.61, 0.58, 0.59, 0.56, 0.57, 0.54, 0.55, 0.52,
    0.53, 0.5, 0.51, 0.48, 0.49, 0.46, 0.47, 0.44, 0.45, 0.42,
  ],
};

export function getMockTradeForSignalId(signalId: string): TradeViewModel {
  if (signalId === 'sig-2') return mockTradeEthShort;
  if (signalId === 'sig-3') return mockTradeSolLong;
  return mockTradeBtcLong;
}

/** Mock shell for Trade UI — prefer this when `pair` is in the URL (Markets / deep links). */
export function getMockTradeForPair(pair: string): TradeViewModel {
  const p = pair.trim().toUpperCase();
  if (p === 'BTC') return mockTradeBtcLong;
  if (p === 'ETH') return mockTradeEthShort;
  if (p === 'SOL') return mockTradeSolLong;
  return {
    ...mockTradeSolLong,
    pair: `${p} / USDT`,
    lastPrice: 1,
    change24hPct: 0,
    high24h: 1.05,
    low24h: 0.95,
    volume24h: '$—',
    entry: 1.01,
    stop: 0.92,
    target: 1.12,
    liquidation: 0.85,
    balanceUsd: 10000,
    amountUsedUsd: 1500,
    leverage: 10,
    positionSizeUsd: 15000,
    targetProfitUsd: 400,
    stopLossUsd: -250,
    riskReward: 1.5,
    aiInsight: {
      trend: 'Neutral',
      momentum: 'Building',
      risk: 'Medium',
      summary: 'Live prices load from the feed — sizing is still preview-only.',
    },
  };
}
