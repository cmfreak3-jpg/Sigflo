/**
 * Trade screen — Lightweight Charts plot height (px).
 *
 * **Single source of truth.** Import these constants from this file only.
 * Do not reintroduce literal `260` / `120` / `116` / `56` etc. on `ChartHeader`,
 * `TradeScreen`, or `PriceChartCard` defaults — that caused repeated drift.
 */
/** Expanded / collapsed plot heights (px); keep in sync if layout changes. */
export const TRADE_CHART_PLOT_EXPANDED_PX = 125;
export const TRADE_CHART_PLOT_COLLAPSED_PX = 58;
