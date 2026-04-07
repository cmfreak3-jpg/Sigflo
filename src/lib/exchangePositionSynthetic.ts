import type { PositionItem } from '@/types/integrations';
import type { SimulatedActivePosition } from '@/types/activePosition';
import type { MarketMode, TradeSide } from '@/types/trade';

/**
 * Maps a live Bybit linear position into the trade UI shape used by exit guidance and chart overlays.
 */
export function syntheticFromExchangePosition(
  p: PositionItem,
  displayPair: string,
  market: MarketMode,
  fallbackLeverage: number,
): SimulatedActivePosition {
  const mark = p.markPrice != null && p.markPrice > 0 ? p.markPrice : p.entryPrice;
  const notional = Math.abs(p.size) * mark;
  const lev = p.leverage != null && p.leverage > 0 ? p.leverage : fallbackLeverage;
  const margin =
    p.positionIM != null && p.positionIM > 0 ? p.positionIM : notional / Math.max(1, lev);
  return {
    id: `bybit:${p.symbol}:${p.side}`,
    symbol: displayPair,
    side: p.side as TradeSide,
    market,
    leverage: lev,
    entryPrice: p.entryPrice,
    positionNotionalUsd: notional,
    marginUsd: Math.max(1e-9, margin),
    liquidationPrice: p.liqPrice ?? null,
    takeProfitPrice: p.takeProfitPrice ?? null,
    stopLossPrice: p.stopLossPrice ?? null,
    openedAtMs: p.openedAtMs ?? Date.now(),
  };
}

/**
 * Spot "position" for the trade UI: derived from wallet free balance of the pair base asset.
 */
export function syntheticFromSpotHolding(
  freeBaseQty: number,
  orderSymbol: string,
  displayPair: string,
  markUsd: number,
): SimulatedActivePosition {
  const notional = freeBaseQty * markUsd;
  return {
    id: `bybit-spot:${orderSymbol}`,
    symbol: displayPair,
    side: 'long',
    market: 'spot',
    leverage: 1,
    entryPrice: markUsd,
    positionNotionalUsd: notional,
    marginUsd: Math.max(1e-9, notional),
    liquidationPrice: null,
    takeProfitPrice: null,
    stopLossPrice: null,
    openedAtMs: Date.now(),
  };
}
