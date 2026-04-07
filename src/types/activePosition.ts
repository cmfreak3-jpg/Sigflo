import type { MarketMode, TradeSide } from '@/types/trade';

/**
 * Browser-only practice position for the trade UI. Long/Short does not call the exchange;
 * balances and equity on Bybit are unchanged. For real positions, use Portfolio (read from Bybit).
 */
export type SimulatedActivePosition = {
  id: string;
  symbol: string;
  side: TradeSide;
  market: MarketMode;
  leverage: number;
  entryPrice: number;
  /** Position notional (USD). */
  positionNotionalUsd: number;
  marginUsd: number;
  liquidationPrice: number | null;
  takeProfitPrice: number | null;
  stopLossPrice: number | null;
  openedAtMs: number;
};
