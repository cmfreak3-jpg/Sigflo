import { motion, useReducedMotion } from 'framer-motion';
import { useId } from 'react';

/** Fixed viewport-bottom data ribbons — teal / cyan / violet, like a live terminal feed. */
export function LandingAmbientWaveforms() {
  const reduced = useReducedMotion();
  const id = useId().replace(/:/g, '');

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[min(32vh,280px)] overflow-hidden opacity-[0.22] motion-reduce:opacity-[0.14]"
      aria-hidden
    >
      <svg
        className="absolute bottom-0 left-[-5%] h-full w-[110%] min-w-[900px]"
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
        fill="none"
      >
        <defs>
          <linearGradient id={`ambW1-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgb(0, 200, 120)" stopOpacity="0.45" />
            <stop offset="50%" stopColor="rgb(0, 232, 255)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(157, 0, 255)" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id={`ambW2-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgb(0, 232, 255)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="rgb(157, 0, 255)" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <motion.g
          animate={reduced ? undefined : { x: [0, -24, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        >
          <polyline
            points="0,142 60,128 120,138 180,115 240,125 300,108 360,118 420,98 480,112 540,95 600,108 660,88 720,102 780,92 840,108 900,85 960,98 1020,88 1080,102 1140,95 1200,88"
            stroke={`url(#ambW1-${id})`}
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            strokeDasharray="1 10"
          />
          <polyline
            points="0,168 80,158 160,172 240,152 320,165 400,148 480,162 560,145 640,158 720,138 800,155 880,142 960,152 1040,135 1120,148 1200,138"
            stroke={`url(#ambW2-${id})`}
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            strokeDasharray="1 14"
            opacity={0.85}
          />
          <polyline
            points="0,118 55,108 110,122 165,98 220,112 275,95 330,108 385,88 440,102 495,85 550,98 605,82 660,95 715,78 770,92 825,75 880,90 935,72 990,88 1045,78 1100,92 1155,82 1200,75"
            stroke="rgb(0, 200, 120)"
            strokeOpacity={0.14}
            strokeWidth="0.9"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            strokeDasharray="1 18"
          />
        </motion.g>
        {!reduced ? (
          <motion.g
            animate={{ x: [0, 18, 0] }}
            transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
          >
            <polyline
              points="0,188 100,178 200,192 300,172 400,185 500,168 600,182 700,162 800,178 900,165 1000,180 1100,168 1200,158"
              stroke="rgb(157, 0, 255)"
              strokeOpacity={0.12}
              strokeWidth="1"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              strokeDasharray="2 16"
            />
          </motion.g>
        ) : null}
      </svg>
    </div>
  );
}
