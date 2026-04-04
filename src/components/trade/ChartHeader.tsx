import type { ComponentProps } from 'react';
import { PriceChartCard } from '@/components/trade/PriceChartCard';
import { TRADE_CHART_PLOT_COLLAPSED_PX, TRADE_CHART_PLOT_EXPANDED_PX } from '@/config/tradeChartHeights';

export type ChartHeaderProps = Omit<ComponentProps<typeof PriceChartCard>, 'chartPlotHeightPx'> & {
  collapsed: boolean;
  plotExpandedPx?: number;
  plotCollapsedPx?: number;
};

/**
 * Sticky trade chart block with a collapsible plot height driven by scroll on `.trade-scroll`.
 */
export function ChartHeader({
  collapsed,
  plotExpandedPx = TRADE_CHART_PLOT_EXPANDED_PX,
  plotCollapsedPx = TRADE_CHART_PLOT_COLLAPSED_PX,
  className = '',
  ...chartProps
}: ChartHeaderProps & { className?: string }) {
  const plotH = collapsed ? plotCollapsedPx : plotExpandedPx;
  return (
    <div className={`w-full ${className}`}>
      <div className="mx-auto w-full max-w-lg px-1.5">
        <PriceChartCard {...chartProps} chartPlotHeightPx={plotH} chartHeightPx={plotH} />
      </div>
    </div>
  );
}
