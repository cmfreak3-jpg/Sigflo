import type { TradeSide } from '@/types/trade';

/** Parsed from `/trade` query when `mode=manage` (portfolio → Trade). */
export type ManageTradePositionContext = {
  pair: string;
  side: TradeSide;
  positionUsd: number;
  entryPrice: number;
  markPrice?: number;
  posSize?: number;
  /** From portfolio deep link when known; exchange snapshot overrides in Trade UI when connected. */
  leverage?: number;
};

export function parseManageTradeContext(params: URLSearchParams): ManageTradePositionContext | null {
  if (params.get('mode') !== 'manage') return null;
  const pair = params.get('pair')?.trim();
  const sideRaw = params.get('side');
  if (!pair || (sideRaw !== 'long' && sideRaw !== 'short')) return null;

  const entryRaw = params.get('portfolioEntry') ?? params.get('entryPrice');
  const entryPrice = entryRaw ? Number(entryRaw) : NaN;
  const posUsdRaw = params.get('positionUsd');
  const positionUsd = posUsdRaw ? Number(posUsdRaw) : NaN;
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) return null;
  if (!Number.isFinite(positionUsd) || positionUsd <= 0) return null;

  const markRaw = params.get('markPrice') ?? params.get('currentPrice');
  const markParsed = markRaw ? Number(markRaw) : NaN;
  const markPrice = Number.isFinite(markParsed) && markParsed > 0 ? markParsed : undefined;

  const ps = params.get('posSize');
  const posSize = ps != null && ps !== '' ? Number(ps) : NaN;
  const posSizeOut = Number.isFinite(posSize) ? posSize : undefined;

  const levRaw = params.get('leverage');
  const levParsed = levRaw != null && levRaw !== '' ? Number(levRaw) : NaN;
  const leverage =
    Number.isFinite(levParsed) && levParsed > 0 ? Math.min(200, Math.round(levParsed)) : undefined;

  return {
    pair,
    side: sideRaw as TradeSide,
    positionUsd,
    entryPrice,
    markPrice,
    posSize: posSizeOut,
    leverage,
  };
}

export function managePnlFromPrices(
  side: TradeSide,
  entryPrice: number,
  currentPrice: number,
  positionUsd: number,
): { pnlUsd: number; pnlPct: number } {
  if (!(entryPrice > 0) || !(currentPrice > 0)) {
    return { pnlUsd: 0, pnlPct: 0 };
  }
  const pnlPct = ((side === 'long' ? currentPrice - entryPrice : entryPrice - currentPrice) / entryPrice) * 100;
  const pnlUsd = positionUsd * (pnlPct / 100);
  return { pnlUsd, pnlPct };
}
