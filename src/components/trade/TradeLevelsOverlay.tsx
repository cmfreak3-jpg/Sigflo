/**
 * Trade level visuals shared by the chart and future multi-position overlays.
 * Price-line sync lives in `PriceChartCard`; colors live in `tradeChartLevels`.
 */
export {
  TRADE_CHART_LEVEL_COLORS,
  buildChartOverlayPresetLive,
  chartOverlayPresetSetupLevels,
  CHART_OVERLAY_PRESET_LIVE_TRADE,
  CHART_OVERLAY_PRESET_SETUP,
  type TradeChartAuxLine,
} from '@/lib/tradeChartLevels';
