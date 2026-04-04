import { formatQuoteNumber } from '@/lib/formatQuote';
import type { TradeViewModel } from '@/types/trade';

const scrollHide = '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

export function MarketStatsRow({
  model,
  variant = 'default',
}: {
  model: TradeViewModel;
  /** `compact` matches chart overlay bar typography (Vol / Last / … row). */
  variant?: 'default' | 'compact';
}) {
  const pos = model.change24hPct >= 0;
  const wrap =
    variant === 'compact'
      ? `flex min-w-0 max-w-full items-center justify-end gap-x-2 overflow-x-auto whitespace-nowrap text-[7px] font-medium leading-tight text-sigflo-muted md:gap-x-2.5 md:text-[8px] ${scrollHide}`
      : `flex items-center gap-2 overflow-x-auto whitespace-nowrap text-xs text-sigflo-muted ${scrollHide}`;
  return (
    <div className={wrap} aria-label="24 hour market stats">
      <span className="shrink-0">
        H/L: <span className="text-white">${formatQuoteNumber(model.high24h)} / ${formatQuoteNumber(model.low24h)}</span>
      </span>
      <span className="shrink-0">
        Vol: <span className="text-white">{model.volume24h}</span>
      </span>
      <span className="shrink-0">
        24h:{' '}
        <span className={pos ? 'text-emerald-400' : 'text-rose-400'}>
          {pos ? '+' : ''}
          {model.change24hPct.toFixed(2)}%
        </span>
      </span>
    </div>
  );
}
