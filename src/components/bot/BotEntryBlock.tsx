import { formatQuoteNumber } from '@/lib/formatQuote';

type BotEntryBlockProps = {
  entry: number;
  entryTiming: string;
};

export function BotEntryBlock({ entry, entryTiming }: BotEntryBlockProps) {
  return (
    <section className="mt-3 rounded-2xl border border-[#00ffc8]/24 bg-gradient-to-r from-[#00ffc8]/[0.08] to-transparent p-3 opacity-0 [animation:fade-in-up_220ms_ease-out_260ms_forwards]">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#a8ffed]">Entry</p>
      <p className="mt-1 text-3xl font-bold tracking-tight text-white tabular-nums">{formatQuoteNumber(entry)}</p>
      <p className="mt-1 text-xs font-semibold text-[#9fffe9]">{entryTiming}</p>
    </section>
  );
}
