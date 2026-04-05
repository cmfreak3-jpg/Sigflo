import { motion } from 'framer-motion';

const ROWS = [
  { pair: 'BTC / USDT', side: 'LONG', pct: '62%' },
  { pair: 'ETH / USDT', side: 'SHORT', pct: '58%' },
  { pair: 'SOL / USDT', side: 'LONG', pct: '64%' },
  { pair: 'BTC / USDT', side: 'LONG', pct: '62%' },
  { pair: 'ETH / USDT', side: 'SHORT', pct: '58%' },
  { pair: 'SOL / USDT', side: 'LONG', pct: '64%' },
] as const;

function TickerRow({
  pair,
  side,
  pct,
}: {
  pair: string;
  side: string;
  pct: string;
}) {
  const isLong = side === 'LONG';
  return (
    <span className="inline-flex items-center gap-3 px-6 text-[11px] uppercase tracking-[0.18em] text-landing-muted opacity-50 transition-opacity duration-300 hover:opacity-95">
      <span className="font-medium text-landing-text opacity-80">{pair}</span>
      <span className={isLong ? 'text-emerald-400/90' : 'text-rose-400/85'}>{side}</span>
      <span className="tabular-nums text-landing-accent/80">{pct}</span>
    </span>
  );
}

export function LandingLiveTicker() {
  const loop = [...ROWS, ...ROWS];
  return (
    <div className="relative border-y border-white/[0.06] bg-black/20">
      <div className="absolute inset-y-0 left-0 z-[1] w-16 bg-gradient-to-r from-[#0B0E14] to-transparent" />
      <div className="absolute inset-y-0 right-0 z-[1] w-16 bg-gradient-to-l from-[#0B0E14] to-transparent" />
      <div className="overflow-hidden py-2.5">
        <motion.div
          className="flex w-max gap-0"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 48, repeat: Infinity, ease: 'linear' }}
        >
          {loop.map((r, i) => (
            <TickerRow key={`${r.pair}-${r.side}-${i}`} pair={r.pair} side={r.side} pct={r.pct} />
          ))}
        </motion.div>
      </div>
    </div>
  );
}
