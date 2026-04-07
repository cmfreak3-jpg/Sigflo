import type { SimulatedActivePosition } from '@/types/activePosition';
import type { MarketMode, TradeSide } from '@/types/trade';

export type ClosedPositionSummary = {
  pairLabel: string;
  side: TradeSide;
  market: MarketMode;
  execution: 'exchange' | 'paper';
  /** 0–1 fraction closed this action */
  fraction: number;
  entryPrice: number;
  /** Reference exit price (mark / last at submit; exchange fills may differ). */
  markPrice: number;
  closedNotionalUsd: number;
  /** Estimated P&L on the closed notional at `markPrice`. */
  pnlUsd: number;
  /** Signed move % from entry to mark (side-aware). */
  movePct: number;
  leverage?: number;
};

/**
 * Snapshot for the post-close summary card. Uses the same P&L geometry as live unrealized (linear in move %).
 */
export function buildClosedPositionSummary(
  pos: SimulatedActivePosition,
  mark: number,
  fraction: number,
  execution: 'exchange' | 'paper',
): ClosedPositionSummary | null {
  const f = Math.min(1, Math.max(0, fraction));
  if (!(f > 0)) return null;
  const entry = Math.max(1e-9, pos.entryPrice);
  const m = Number.isFinite(mark) && mark > 0 ? mark : entry;
  const dir = pos.side === 'long' ? 1 : -1;
  const movePct = ((m - entry) / entry) * 100 * dir;
  const fullPnl = pos.positionNotionalUsd * (movePct / 100);
  const pnlUsd = fullPnl * f;
  const closedNotional = pos.positionNotionalUsd * f;
  return {
    pairLabel: pos.symbol,
    side: pos.side,
    market: pos.market,
    execution,
    fraction: f,
    entryPrice: pos.entryPrice,
    markPrice: m,
    closedNotionalUsd: closedNotional,
    pnlUsd,
    movePct,
    leverage: pos.market === 'futures' ? pos.leverage : undefined,
  };
}
