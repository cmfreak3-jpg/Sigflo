import type { TradeSide } from '@/types/trade';

/** Stable decimal string for Bybit `takeProfit` / `stopLoss` (no scientific notation). */
export function formatLinearPriceStringForBybit(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return '';
  const s = price.toFixed(12).replace(/\.?0+$/, '');
  return s.length > 0 ? s : String(price);
}

export type LinearTpSlStrings = {
  takeProfit?: string;
  stopLoss?: string;
};

/**
 * Maps UI target/stop to Bybit TP/SL strings only when prices are valid for the side vs entry.
 * Wrong-side levels are omitted (caller may toast).
 */
export function linearTpSlStringsForOpen(
  side: TradeSide,
  entryPrice: number,
  targetParsed: number,
  stopParsed: number,
): { tpSl: LinearTpSlStrings; skippedTarget: boolean; skippedStop: boolean } {
  let skippedT = false;
  let skippedS = false;
  const tpSl: LinearTpSlStrings = {};

  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    return { tpSl: {}, skippedTarget: false, skippedStop: false };
  }

  if (Number.isFinite(targetParsed) && targetParsed > 0) {
    const okLong = side === 'long' && targetParsed > entryPrice;
    const okShort = side === 'short' && targetParsed < entryPrice;
    if (okLong || okShort) {
      tpSl.takeProfit = formatLinearPriceStringForBybit(targetParsed);
    } else {
      skippedT = true;
    }
  }

  if (Number.isFinite(stopParsed) && stopParsed > 0) {
    const okLong = side === 'long' && stopParsed < entryPrice;
    const okShort = side === 'short' && stopParsed > entryPrice;
    if (okLong || okShort) {
      tpSl.stopLoss = formatLinearPriceStringForBybit(stopParsed);
    } else {
      skippedS = true;
    }
  }

  return { tpSl, skippedTarget: skippedT, skippedStop: skippedS };
}
