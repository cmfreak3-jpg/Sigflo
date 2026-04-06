import type { ComponentProps } from 'react';
import { ChartHeader } from '@/components/trade/ChartHeader';
import { LiveMarketStrip } from '@/components/trade/LiveMarketStrip';

type ChartHeaderProps = ComponentProps<typeof ChartHeader>;

export type TradeChartPanelProps = ChartHeaderProps & {
  liveStrip?: ComponentProps<typeof LiveMarketStrip> | null;
};

/**
 * Chart region for trade screen: optional live strip + collapsible chart header.
 */
export function TradeChartPanel({ liveStrip, className = '', ...chartProps }: TradeChartPanelProps) {
  return (
    <div className={`space-y-0 ${className}`}>
      {liveStrip ? <LiveMarketStrip {...liveStrip} /> : null}
      <ChartHeader {...chartProps} />
    </div>
  );
}
