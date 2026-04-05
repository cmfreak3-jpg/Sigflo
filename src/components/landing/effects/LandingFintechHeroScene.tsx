import { motion, useReducedMotion } from 'framer-motion';
import { useId, useMemo } from 'react';

/** Hero-only: perspective grid floor, teal→violet particle waves, soft square bokeh. */
export function LandingFintechHeroScene() {
  const reduced = useReducedMotion();
  const gid = useId().replace(/:/g, '');

  const bokeh = useMemo(
    () =>
      Array.from({ length: 68 }, (_, i) => ({
        left: ((i * 41) % 94) + 3,
        top: ((i * 59) % 78) + 5,
        size: 2 + (i % 5),
        blur: (i % 3) as 0 | 1 | 2,
        purple: i % 6 === 0 || i % 7 === 2,
        op: 0.11 + (i % 9) * 0.018,
      })),
    [],
  );

  const blurCls = (b: 0 | 1 | 2) =>
    b === 0 ? 'blur-[0.5px]' : b === 1 ? 'blur-sm' : 'blur-md';

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_72%_48%_at_100%_-5%,rgba(157,0,255,0.085),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_68%_42%_at_0%_102%,rgba(0,232,255,0.06),transparent_52%)]" />

      <div
        className="absolute inset-x-0 bottom-0 h-[min(48vh,380px)]"
        style={{ perspective: '560px', perspectiveOrigin: '50% 100%' }}
      >
        <div
          className="absolute bottom-0 left-1/2 h-[240%] w-[min(140%,920px)] origin-bottom sm:w-[min(130%,1100px)]"
          style={{
            transform: 'translateX(-50%) rotateX(76deg)',
            transformStyle: 'preserve-3d',
            maskImage: 'linear-gradient(to top, black 0%, black 18%, transparent 78%)',
            WebkitMaskImage: 'linear-gradient(to top, black 0%, black 18%, transparent 78%)',
          }}
        >
          <div
            className="absolute inset-0 opacity-[0.38]"
            style={{
              backgroundImage: `
                linear-gradient(rgba(0, 200, 120, 0.16) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0, 200, 120, 0.11) 1px, transparent 1px),
                radial-gradient(ellipse 45% 35% at 28% 42%, rgba(0, 232, 255, 0.1), transparent 52%),
                radial-gradient(ellipse 40% 38% at 72% 48%, rgba(157, 0, 255, 0.08), transparent 50%)
              `,
              backgroundSize: '14px 14px, 14px 14px, 100% 100%, 100% 100%',
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.52]"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(0, 232, 255, 0.55) 1px, transparent 1.5px)',
              backgroundSize: '16px 16px',
            }}
          />
        </div>
      </div>

      <svg
        className="absolute -left-[6%] top-[8%] h-[clamp(112px,min(38vh,240px),260px)] w-[112%] min-w-[720px] opacity-[0.48] motion-reduce:opacity-[0.32] sm:top-[10%]"
        viewBox="0 0 1200 140"
        preserveAspectRatio="none"
        fill="none"
      >
        <defs>
          <linearGradient id={`ftWaveA-${gid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgb(0, 200, 120)" stopOpacity="0.72" />
            <stop offset="48%" stopColor="rgb(0, 232, 255)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="rgb(157, 0, 255)" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id={`ftWaveB-${gid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgb(0, 200, 120)" stopOpacity="0.48" />
            <stop offset="100%" stopColor="rgb(157, 0, 255)" stopOpacity="0.42" />
          </linearGradient>
        </defs>
        <motion.g
          animate={reduced ? undefined : { x: [0, -36, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        >
          <path
            d="M0,88 C220,48 420,108 620,62 S1020,96 1200,52"
            stroke={`url(#ftWaveA-${gid})`}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeDasharray="1 16"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M0,108 C200,130 400,72 600,98 S960,78 1200,102"
            stroke={`url(#ftWaveB-${gid})`}
            strokeWidth="1"
            strokeLinecap="round"
            strokeDasharray="1 22"
            opacity={0.75}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M0,72 C260,92 440,38 680,78 S1000,58 1200,68"
            stroke="rgb(0, 232, 255)"
            strokeOpacity={0.2}
            strokeWidth="0.9"
            strokeLinecap="round"
            strokeDasharray="1 20"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M0,124 C240,88 480,132 720,96 S1040,118 1200,108"
            stroke={`url(#ftWaveB-${gid})`}
            strokeWidth="0.85"
            strokeLinecap="round"
            strokeDasharray="1 12"
            opacity={0.55}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M0,58 C300,28 500,78 780,48 S1080,68 1200,42"
            stroke={`url(#ftWaveA-${gid})`}
            strokeWidth="1"
            strokeLinecap="round"
            strokeDasharray="1 24"
            opacity={0.35}
            vectorEffect="non-scaling-stroke"
          />
        </motion.g>
      </svg>

      <div className="absolute inset-0">
        {bokeh.map((b, i) => (
          <span
            key={i}
            className={`absolute rounded-[1px] ${blurCls(b.blur)} ${
              b.purple ? 'bg-[#9D00FF]' : 'bg-[#00E8FF]'
            }`}
            style={{
              left: `${b.left}%`,
              top: `${b.top}%`,
              width: b.size,
              height: b.size,
              opacity: b.op,
            }}
          />
        ))}
      </div>
    </div>
  );
}
