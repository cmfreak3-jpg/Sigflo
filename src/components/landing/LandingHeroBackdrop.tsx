import { motion, useReducedMotion } from 'framer-motion';

/** Animated signal lines, dashed carriers, second wave layer — trading “system” feel. */
export function LandingHeroBackdrop() {
  const reduced = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(245,247,250,0.9) 1px, transparent 1px),
            linear-gradient(90deg, rgba(245,247,250,0.9) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />
      <svg
        className="absolute -left-[5%] top-[18%] h-[42%] w-[110%] min-w-[800px] text-[#00C878]"
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
        fill="none"
      >
        <defs>
          <linearGradient id="sigLineA" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
            <stop offset="35%" stopColor="currentColor" stopOpacity="0.14" />
            <stop offset="65%" stopColor="currentColor" stopOpacity="0.1" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="sigPulse" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
            <stop offset="50%" stopColor="currentColor" stopOpacity="0.45" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.g
          animate={reduced ? undefined : { x: [0, -80, 0] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
        >
          <path
            d="M0 120 C200 80 400 160 600 100 S1000 140 1200 90"
            stroke="url(#sigLineA)"
            strokeWidth="1.2"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M0 150 C180 190 380 60 580 130 S960 70 1200 110"
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M0 95 C220 130 420 50 640 115 S980 85 1200 125"
            stroke="currentColor"
            strokeOpacity="0.06"
            strokeWidth="0.9"
            vectorEffect="non-scaling-stroke"
          />
          {!reduced ? (
            <motion.path
              d="M0 120 C200 80 400 160 600 100 S1000 140 1200 90"
              stroke="url(#sigPulse)"
              strokeWidth="2"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              strokeDasharray="14 28"
              initial={{ strokeDashoffset: 0 }}
              animate={{ strokeDashoffset: [0, -420] }}
              transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
            />
          ) : null}
        </motion.g>
        <motion.g
          animate={reduced ? undefined : { x: [0, 60, 0] }}
          transition={{ duration: 36, repeat: Infinity, ease: 'easeInOut' }}
        >
          <path
            d="M0 165 Q300 100 600 155 T1200 140"
            stroke="currentColor"
            strokeOpacity="0.05"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M0 52 C280 20 520 88 760 42 S1080 72 1200 38"
            stroke="currentColor"
            strokeOpacity="0.055"
            strokeWidth="0.85"
            strokeLinecap="round"
            strokeDasharray="1 18"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M0 178 C320 150 560 195 800 165 S1120 188 1200 172"
            stroke="currentColor"
            strokeOpacity="0.04"
            strokeWidth="0.8"
            strokeLinecap="round"
            strokeDasharray="1 22"
            vectorEffect="non-scaling-stroke"
          />
        </motion.g>
      </svg>

      {/* Secondary waveform band — lower hero */}
      <svg
        className="absolute -bottom-[2%] left-0 right-0 h-24 w-full text-[#00C878] opacity-[0.35] sm:h-28"
        viewBox="0 0 1200 80"
        preserveAspectRatio="none"
        fill="none"
      >
        <motion.g
          animate={reduced ? undefined : { y: [0, -2.5, 0, 1.5, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <polyline
            points="0,50 80,45 160,55 240,38 320,48 400,32 480,52 560,28 640,46 720,34 800,50 880,30 960,44 1040,36 1120,48 1200,40"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity="0.5"
          />
        </motion.g>
        <motion.g
          animate={reduced ? undefined : { y: [0, 2, 0, -2, 0] }}
          transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <polyline
            points="0,62 100,58 200,66 300,54 400,64 500,50 600,60 700,48 800,58 900,52 1000,62 1100,56 1200,60"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeOpacity="0.25"
          />
        </motion.g>
        <motion.g
          animate={reduced ? undefined : { y: [0, -1.5, 0, 1, 0] }}
          transition={{ duration: 7.2, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
        >
          <polyline
            points="0,72 75,68 150,76 225,64 300,74 375,60 450,70 525,58 600,68 675,56 750,66 825,54 900,64 975,52 1050,62 1125,58 1200,54"
            stroke="currentColor"
            strokeWidth="0.85"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity="0.18"
            strokeDasharray="1 8"
          />
        </motion.g>
      </svg>
    </div>
  );
}
