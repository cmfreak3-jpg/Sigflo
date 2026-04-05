import { motion, useReducedMotion } from 'framer-motion';

const ROWS = [
  { pair: 'BTC / USDT', side: 'LONG', pct: '72%' },
  { pair: 'ETH / USDT', side: 'SHORT', pct: '68%' },
  { pair: 'SOL / USDT', side: 'LONG', pct: '64%' },
] as const;

function Row({ pair, side, pct }: (typeof ROWS)[number]) {
  const isLong = side === 'LONG';
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap px-4 text-[9px] uppercase tracking-[0.18em] opacity-90 sm:gap-3 sm:px-7 sm:text-[11px] sm:tracking-[0.2em] sm:opacity-100">
      <span className="font-medium text-[rgba(245,247,250,0.88)]">{pair}</span>
      <span className="text-[rgba(245,247,250,0.35)]">—</span>
      <span className={isLong ? 'font-semibold text-[#21F0C3]' : 'font-semibold text-rose-400/90'}>
        {side}
      </span>
      <span className="text-[rgba(245,247,250,0.35)]">—</span>
      <span className="tabular-nums font-medium text-[#00C878]">{pct}</span>
    </span>
  );
}

type Props = { className?: string };

export function HeroLiveTickerStrip({ className = '' }: Props) {
  const reduced = useReducedMotion();
  const loop = [...ROWS, ...ROWS, ...ROWS];

  return (
    <div
      className={`overflow-hidden rounded-md border border-[rgba(130,170,190,0.12)] bg-[rgba(14,20,28,0.42)] py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-md sm:rounded-lg sm:border-[rgba(130,170,190,0.16)] sm:bg-[rgba(14,20,28,0.55)] sm:py-2.5 sm:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${className}`}
    >
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-8 bg-gradient-to-r from-[#081018] to-transparent sm:w-16" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-8 bg-gradient-to-l from-[#081018] to-transparent sm:w-16" />
        <div className="overflow-hidden">
          {reduced ? (
            <div className="flex justify-center gap-8 py-0.5">
              {ROWS.map((r) => (
                <Row key={r.pair} {...r} />
              ))}
            </div>
          ) : (
            <motion.div
              className="flex w-max gap-0"
              animate={{ x: ['0%', '-33.333%'] }}
              transition={{ duration: 42, repeat: Infinity, ease: 'linear' }}
            >
              {loop.map((r, i) => (
                <Row key={`${r.pair}-${i}`} {...r} />
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
