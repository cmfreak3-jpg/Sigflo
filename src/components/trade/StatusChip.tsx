import type { TradeTimingChipState } from '@/lib/tradeTimingChip';

const stateStyles: Record<
  TradeTimingChipState,
  { ring: string; bg: string; text: string; glow: string }
> = {
  early: {
    ring: 'ring-sky-500/25',
    bg: 'bg-sky-500/[0.09]',
    text: 'text-sky-200/95',
    glow: 'shadow-[0_0_14px_-4px_rgba(56,189,248,0.35)]',
  },
  developing: {
    ring: 'ring-amber-400/22',
    bg: 'bg-amber-500/[0.08]',
    text: 'text-amber-100/90',
    glow: 'shadow-[0_0_14px_-4px_rgba(251,191,36,0.22)]',
  },
  ready: {
    ring: 'ring-[rgba(0,255,200,0.28)]',
    bg: 'bg-[rgba(0,255,200,0.08)]',
    text: 'text-[#a8ffe8]',
    glow: 'shadow-[0_0_16px_-5px_rgba(0,255,200,0.32)]',
  },
  invalid: {
    ring: 'ring-rose-400/22',
    bg: 'bg-rose-500/[0.08]',
    text: 'text-rose-200/90',
    glow: 'shadow-[0_0_14px_-4px_rgba(251,113,133,0.28)]',
  },
};

export function StatusChip({
  label,
  state,
  compact,
}: {
  label: string;
  state: TradeTimingChipState;
  /** Tighter chip for dense rows (e.g. chart dock). */
  compact?: boolean;
}) {
  const s = stateStyles[state];
  return (
    <span
      className={`inline-flex max-w-full items-center truncate rounded-full border border-white/[0.06] font-semibold tracking-wide ring-1 ${s.ring} ${s.bg} ${s.text} ${s.glow} ${
        compact ? 'px-1 py-0 text-[7px] leading-none' : 'px-2 py-0.5 text-[10px]'
      }`}
    >
      {label}
    </span>
  );
}
