import type { MarketMode, TradeSide } from '@/types/trade';

/**
 * Simulated “live” position for the trade UI (Sigflo does not route orders).
 * Structured as a list so multiple cards can be shown later.
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
