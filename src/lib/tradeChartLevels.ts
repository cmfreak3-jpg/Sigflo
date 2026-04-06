/**
 * Shared trade level colors for chart + UI (live trade mode).
 * Entry: teal/cyan · Target: green · Stop: red · Trim: amber · Last: cyan.
 */
export const TRADE_CHART_LEVEL_COLORS = {
  last: '#22d3ee',
  entry: '#2dd4bf',
  target: '#4ade80',
  stop: '#f87171',
  liquidation: '#fbbf24',
  trim: '#f59e0b',
} as const;

/** Preset id: pre-entry — overlay chips default off until the user opts in. */
export const CHART_OVERLAY_PRESET_SETUP = 'setup' as const;
/** Preset id: position open — core trade levels on by default (see `buildChartOverlayPresetLive`). */
export const CHART_OVERLAY_PRESET_LIVE_TRADE = 'live_trade' as const;

export type TradeChartAuxLine = {
  id: string;
  price: number;
  color: string;
  title: string;
};

type OverlayLevelKey = 'last' | 'entry' | 'stop' | 'target' | 'liquidation';

/** All trade overlay toggles off (setup / clean default). */
export function chartOverlayPresetSetupLevels(): Record<OverlayLevelKey, boolean> {
  return {
    last: false,
    entry: false,
    stop: false,
    target: false,
    liquidation: false,
  };
}

/**
 * Live trade default visibility: entry, stop, target, last on; liquidation only when a valid price exists.
 * Trim / scale-out lines are driven separately via `auxiliaryPriceLines` on the chart card.
 */
export function buildChartOverlayPresetLive(
  showLiquidationRow: boolean,
  liquidationPrice: number | undefined,
): Record<OverlayLevelKey, boolean> {
  const liqOn =
    showLiquidationRow &&
    liquidationPrice != null &&
    Number.isFinite(liquidationPrice) &&
    liquidationPrice > 0;
  return {
    last: true,
    entry: true,
    stop: true,
    target: true,
    liquidation: liqOn,
  };
}
