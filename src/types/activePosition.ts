import type { MarketMode, TradeSide } from '@/types/trade';

/**
 * Shape used for open-position UI (chart overlays, active card): either synthesized from Bybit snapshots
 * or derived for display. Exchange-backed rows come from account sync; sizing for new orders is separate.
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
