import type { SimulatedActivePosition } from '@/types/activePosition';
import type { MarketMode, TradeSide } from '@/types/trade';

export const PAPER_POSITIONS_STORAGE_KEY = 'sigflo.paperPositions.v1';
export const PAPER_POSITIONS_CHANGED_EVENT = 'sigflo:paper-positions-changed';
/** Set by Trade when user clears demo positions; Portfolio uses it to avoid false "vanished" banners. */
export const SESSION_INTENTIONAL_PAPER_CLEAR_KEY = 'sigflo.intentionalPaperClear';

function isTradeSide(s: unknown): s is TradeSide {
  return s === 'long' || s === 'short';
}

function isMarketMode(s: unknown): s is MarketMode {
  return s === 'futures' || s === 'spot';
}

function parsePosition(raw: unknown): SimulatedActivePosition | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : '';
  const symbol = typeof o.symbol === 'string' ? o.symbol : '';
  if (!id || !symbol) return null;
  if (!isTradeSide(o.side)) return null;
  if (!isMarketMode(o.market)) return null;
  const leverage = Number(o.leverage);
  const entryPrice = Number(o.entryPrice);
  const positionNotionalUsd = Number(o.positionNotionalUsd);
  const marginUsd = Number(o.marginUsd);
  const openedAtMs = Number(o.openedAtMs);
  if (
    !Number.isFinite(leverage) ||
    !Number.isFinite(entryPrice) ||
    !Number.isFinite(positionNotionalUsd) ||
    !Number.isFinite(marginUsd) ||
    !Number.isFinite(openedAtMs)
  ) {
    return null;
  }
  const liq = o.liquidationPrice;
  const tp = o.takeProfitPrice;
  const sl = o.stopLossPrice;
  return {
    id,
    symbol,
    side: o.side,
    market: o.market,
    leverage,
    entryPrice,
    positionNotionalUsd,
    marginUsd,
    liquidationPrice: liq != null && Number.isFinite(Number(liq)) ? Number(liq) : null,
    takeProfitPrice: tp != null && Number.isFinite(Number(tp)) ? Number(tp) : null,
    stopLossPrice: sl != null && Number.isFinite(Number(sl)) ? Number(sl) : null,
    openedAtMs,
  };
}

export function loadPaperPositions(): SimulatedActivePosition[] {
  try {
    const raw = window.localStorage.getItem(PAPER_POSITIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: SimulatedActivePosition[] = [];
    for (const row of parsed) {
      const p = parsePosition(row);
      if (p) out.push(p);
    }
    return out;
  } catch {
    return [];
  }
}

export function savePaperPositions(positions: SimulatedActivePosition[]): void {
  try {
    window.localStorage.setItem(PAPER_POSITIONS_STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // quota / private mode — ignore
  }
  window.dispatchEvent(new Event(PAPER_POSITIONS_CHANGED_EVENT));
}

export function paperPairToQueryParam(symbol: string): string {
  const s = symbol.trim();
  if (s.includes('/')) return s.split('/')[0]?.trim().toUpperCase() || 'BTC';
  return s.replace(/USDT$/i, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'BTC';
}
