import { motion, useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';

function seeded(i: number, m: number) {
  return ((i * 7919 + m * 17) % 10000) / 10000;
}

type Props = {
  /** Mote count (default tuned for waitlist band). */
  count?: number;
};

/**
 * Section-scoped “data motes” — global {@link LandingFloatingPixels} sit behind `main`
 * and are hidden by opaque section fills; use this where pixels should read on scroll.
 */
export function LandingSectionPixelField({ count = 72 }: Props) {
  const reduced = useReducedMotion();
  const pixels = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: 2 + seeded(i, 1) * 96,
        top: 4 + seeded(i, 2) * 92,
        delay: seeded(i, 3) * 3.2,
        dur: 2.4 + seeded(i, 4) * 2,
        w: 2 + Math.floor(seeded(i, 5) * 3),
        h: 2 + Math.floor(seeded(i, 6) * 2),
        hue: seeded(i, 7) > 0.5,
      })),
    [count],
  );

  const cap = reduced ? Math.min(40, count) : count;
  const list = reduced ? pixels.slice(0, cap) : pixels;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
      aria-hidden
    >
      {list.map((p, i) =>
        reduced ? (
          <span
            key={i}
            className={`absolute rounded-[1px] opacity-[0.22] ${p.hue ? 'bg-[#00C878]' : 'bg-white'}`}
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: p.w,
              height: p.h,
            }}
          />
        ) : (
          <motion.span
            key={i}
            className={`absolute rounded-[1px] ${p.hue ? 'bg-[#00C878]' : 'bg-[rgba(245,247,250,0.55)]'}`}
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: p.w,
              height: p.h,
              boxShadow: p.hue ? '0 0 5px rgba(0,200,120,0.28)' : 'none',
            }}
            animate={{
              opacity: [0.12, 0.38, 0.16, 0.32, 0.12],
              y: [0, -6, 3, -4, 0],
              x: [0, 2, -1, 0],
              scale: [1, 1.12, 0.95, 1.06, 1],
            }}
            transition={{
              duration: p.dur,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: p.delay,
            }}
          />
        ),
      )}
    </div>
  );
}
