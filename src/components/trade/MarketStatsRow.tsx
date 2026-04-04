import { formatQuoteNumber } from '@/lib/formatQuote';
import type { TradeViewModel } from '@/types/trade';

export function MarketStatsRow({ model }: { model: TradeViewModel }) {
  const pos = model.change24hPct >= 0;
  return (
    <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap text-xs text-sigflo-muted [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <span className="shrink-0">
        H/L: <span className="text-white">${formatQuoteNumber(model.high24h)} / ${formatQuoteNumber(model.low24h)}</span>
      </span>
      <span className="shrink-0">
        Vol: <span className="text-white">{model.volume24h}</span>
      </span>
      <span className="shrink-0">
        24h: <span className={pos ? 'text-emerald-400' : 'text-rose-400'}>{pos ? '+' : ''}{model.change24hPct.toFixed(2)}%</span>
      </span>
    </div>
  );
}
