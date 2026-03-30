import { formatQuoteNumber } from '@/lib/formatQuote';
import type { TradeViewModel } from '@/types/trade';

export function MarketStatsRow({ model }: { model: TradeViewModel }) {
  const change = model.change24hPct;
  const pos = change >= 0;
  return (
    <div className="grid grid-cols-2 gap-2">
      <StatBox label="Last price" value={`$${formatQuoteNumber(model.lastPrice)}`} />
      <StatBox
        label="24h change"
        value={`${pos ? '+' : ''}${change.toFixed(2)}%`}
        valueClass={pos ? 'text-emerald-300' : 'text-rose-300'}
      />
      <StatBox
        label="24h high / low"
        value={`$${formatQuoteNumber(model.high24h)} / $${formatQuoteNumber(model.low24h)}`}
      />
      <StatBox label="Volume (24h)" value={model.volume24h} />
    </div>
  );
}

function StatBox({
  label,
  value,
  valueClass = 'text-sigflo-text',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-sigflo-muted">{label}</p>
      <p className={`mt-1 text-sm font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}
