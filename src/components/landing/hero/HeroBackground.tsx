import { motion, useReducedMotion } from 'framer-motion';
import { useId, useMemo } from 'react';

const WAVE_PATHS = [
  'M-240,118 C120,88 360,148 600,108 S1040,128 1320,98 S1680,118 1960,88',
  'M-200,218 C180,198 420,248 680,208 S980,228 1280,188 S1720,208 2000,178',
  'M-280,348 C140,308 400,388 720,338 S1000,368 1380,318 S1760,348 2040,308',
  'M-220,478 C200,438 440,508 760,458 S1040,488 1360,438 S1740,468 2020,428',
  'M-260,608 C160,568 380,638 640,598 S960,628 1240,578 S1620,608 1980,568',
] as const;

function Particle({ i }: { i: number }) {
  const reduced = useReducedMotion();
  const s = useMemo(
    () => ({
      left: `${6 + ((i * 47) % 88)}%`,
      top: `${10 + ((i * 71) % 80)}%`,
      delay: (i % 8) * 0.4,
      dur: 11 + (i % 7) * 2,
      w: 1 + (i % 2),
    }),
    [i],
  );

  if (reduced) {
    return (
      <span
        className="absolute rounded-full bg-[rgba(33,240,195,0.3)]"
        style={{ left: s.left, top: s.top, width: s.w, height: s.w }}
        aria-hidden
      />
    );
  }

  return (
    <motion.span
      className="absolute rounded-full bg-[rgba(245,247,250,0.4)]"
      style={{ left: s.left, top: s.top, width: s.w, height: s.w }}
      animate={{
        opacity: [0.1, 0.38, 0.16, 0.32, 0.1],
        x: [0, 8, -5, 3, 0],
        y: [0, -12, 5, -6, 0],
      }}
      transition={{
        duration: s.dur,
        repeat: Infinity,
        ease: 'easeInOut',
        delay: s.delay,
      }}
      aria-hidden
    />
  );
}

export function HeroBackground() {
  const reduced = useReducedMotion();
  const uid = useId().replace(/:/g, '');

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* 1 — Dark gradient base */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 100% 70% at 50% -20%, rgba(12, 20, 36, 0.9) 0%, transparent 50%),
            radial-gradient(ellipse 55% 50% at 12% 80%, rgba(6, 18, 32, 0.45) 0%, transparent 55%),
            linear-gradient(168deg, #020305 0%, #05070b 28%, #081018 55%, #0a1018 100%)
          `,
        }}
      />

      {/* 2 — Faint chart grid */}
      <div
        className="absolute inset-0 opacity-[0.085] motion-reduce:opacity-[0.055]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(130, 170, 190, 0.32) 1px, transparent 1px),
            linear-gradient(90deg, rgba(130, 170, 190, 0.24) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 88% 78% at 50% 42%, black 18%, transparent 92%)',
          WebkitMaskImage: 'radial-gradient(ellipse 88% 78% at 50% 42%, black 18%, transparent 92%)',
        }}
      />

      {/* 3 — Flowing teal signal lines (full hero width) */}
      <svg
        className="absolute inset-0 h-full w-full min-h-[480px]"
        viewBox="0 0 1600 720"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`hw-stroke-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgb(0, 200, 120)" stopOpacity="0" />
            <stop offset="20%" stopColor="rgb(33, 240, 195)" stopOpacity="0.42" />
            <stop offset="50%" stopColor="rgb(0, 200, 120)" stopOpacity="0.32" />
            <stop offset="80%" stopColor="rgb(33, 240, 195)" stopOpacity="0.38" />
            <stop offset="100%" stopColor="rgb(0, 200, 120)" stopOpacity="0" />
          </linearGradient>
          <filter id={`hw-glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {WAVE_PATHS.map((d, wi) => (
          <motion.g
            key={wi}
            filter={`url(#hw-glow-${uid})`}
            animate={
              reduced
                ? undefined
                : { x: wi % 2 === 0 ? [0, 32, 0, -24, 0] : [0, -28, 0, 20, 0] }
            }
            transition={{
              duration: 20 + wi * 3,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: wi * 0.85,
            }}
          >
            <path
              d={d}
              stroke={`url(#hw-stroke-${uid})`}
              strokeWidth={wi === 2 ? 2 : 1.4}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              opacity={0.2 + wi * 0.035}
            />
          </motion.g>
        ))}
      </svg>

      {/* 4 — Sparse particles */}
      {Array.from({ length: 40 }, (_, i) => (
        <Particle key={i} i={i} />
      ))}

      {/* 5 — Radial bloom behind SignalPanel (right) */}
      <motion.div
        className="absolute right-[-8%] top-[10%] h-[min(85%,600px)] w-[min(52%,480px)] rounded-[50%]"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(0, 200, 120, 0.28) 0%, rgba(33, 240, 195, 0.06) 45%, transparent 68%)',
          filter: 'blur(40px)',
        }}
        animate={reduced ? undefined : { opacity: [0.7, 0.95, 0.75, 0.9, 0.7], scale: [1, 1.03, 0.99, 1.02, 1] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        className="absolute right-[4%] top-[24%] h-[min(62%,420px)] w-[min(38%,340px)] rounded-[2rem] opacity-[0.14] blur-2xl motion-reduce:opacity-[0.1]"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(33, 240, 195, 0.22), transparent 72%)',
        }}
      />
    </div>
  );
}
