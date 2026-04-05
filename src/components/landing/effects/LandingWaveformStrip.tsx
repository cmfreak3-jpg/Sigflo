import { motion, useReducedMotion } from 'framer-motion';

const DEFAULT_BARS = 72;

export function LandingWaveformStrip({
  className = '',
  bars = DEFAULT_BARS,
  heightClass = 'h-14 md:h-16',
}: {
  className?: string;
  /** Number of vertical bars (more = denser “spectrum”). */
  bars?: number;
  /** Container height (Tailwind classes). Default matches previous full-size strip. */
  heightClass?: string;
}) {
  const reduced = useReducedMotion();
  const n = Math.max(24, Math.min(120, bars));

  return (
    <div
      className={`flex items-end justify-center gap-px sm:gap-0.5 ${heightClass} ${className}`}
      aria-hidden
    >
      {Array.from({ length: n }, (_, i) => {
        const hSeq = [
          22 + ((i * 7) % 18),
          55 + ((i * 11) % 35),
          30 + ((i * 5) % 25),
          70 + ((i * 13) % 25),
          18 + ((i * 3) % 20),
        ].map((v) => `${v}%`);

        if (reduced) {
          return (
            <div
              key={i}
              className="w-[2px] max-w-[3px] flex-1 rounded-t-sm bg-[#00C878]/25 sm:w-0.5"
              style={{ height: hSeq[1] }}
            />
          );
        }

        return (
          <motion.div
            key={i}
            className="w-[2px] max-w-[3px] flex-1 rounded-t-sm bg-gradient-to-t from-[#00C878]/15 to-[#00E08A]/55 sm:w-0.5"
            animate={{ height: hSeq }}
            transition={{
              duration: 1.6 + (i % 7) * 0.12,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * (2.2 / n),
            }}
          />
        );
      })}
    </div>
  );
}
