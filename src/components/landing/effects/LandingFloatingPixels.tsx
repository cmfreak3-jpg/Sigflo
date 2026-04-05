import { motion, useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';

const COUNT = 280;

function seeded(i: number, m: number) {
  return ((i * 7919 + m * 17) % 10000) / 10000;
}

export function LandingFloatingPixels() {
  const reduced = useReducedMotion();
  const pixels = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        left: 3 + seeded(i, 1) * 94,
        top: 2 + seeded(i, 2) * 96,
        delay: seeded(i, 3) * 4,
        dur: 2.8 + seeded(i, 4) * 2.4,
        w: 2 + Math.floor(seeded(i, 5) * 3),
        h: 2 + Math.floor(seeded(i, 6) * 2),
        hue: seeded(i, 7) > 0.55,
      })),
    [],
  );

  if (reduced) {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {pixels.slice(0, 88).map((p, i) => (
          <span
            key={i}
            className={`absolute rounded-[1px] opacity-[0.24] ${p.hue ? 'bg-[#00C878]' : 'bg-white'}`}
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: p.w,
              height: p.h,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pixels.map((p, i) => (
        <motion.span
          key={i}
          className={`absolute rounded-[1px] ${p.hue ? 'bg-[#00C878]' : 'bg-[rgba(245,247,250,0.55)]'}`}
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.w,
            height: p.h,
            boxShadow: p.hue ? '0 0 6px rgba(0,200,120,0.26)' : 'none',
          }}
          animate={{
            opacity: [0.14, 0.42, 0.18, 0.36, 0.14],
            y: [0, -10, 4, -6, 0],
            x: [0, 3, -2, 0],
            scale: [1, 1.22, 0.92, 1.08, 1],
          }}
          transition={{
            duration: p.dur,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: p.delay,
          }}
        />
      ))}
    </div>
  );
}
