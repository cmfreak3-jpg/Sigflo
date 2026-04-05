import { motion, useReducedMotion } from 'framer-motion';
import { useId } from 'react';

function MiniChart({ gid, className = '' }: { gid: string; className?: string }) {
  const pts =
    '0,52 20,44 40,48 60,32 80,26 100,18 120,22 140,12 160,8 180,14 200,6 220,10 240,4 260,8 280,2 300,6 320,4';
  return (
    <svg
      viewBox="0 0 320 56"
      className={`h-full min-h-[100px] w-full ${className}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={`hspFill-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#21F0C3" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#00C878" stopOpacity="0" />
        </linearGradient>
        <filter id={`hspGlow-${gid}`} x="-8%" y="-8%" width="116%" height="116%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <line
        x1="0"
        y1="54"
        x2="320"
        y2="54"
        stroke="rgba(130,170,190,0.14)"
        strokeWidth="0.5"
        vectorEffect="non-scaling-stroke"
      />
      <g filter={`url(#hspGlow-${gid})`}>
        <polyline
          fill="none"
          stroke="#21F0C3"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity="0.82"
          points={pts}
          vectorEffect="non-scaling-stroke"
        />
      </g>
      <polygon fill={`url(#hspFill-${gid})`} points={`0,56 ${pts} 320,56`} />
    </svg>
  );
}

export function HeroSignalPanel() {
  const gid = useId().replace(/:/g, '');
  const reduced = useReducedMotion();

  return (
    <div className="relative mx-auto w-full min-w-0 lg:ml-auto lg:mr-0 lg:w-[min(100%,600px)] lg:max-w-[640px]">
      <div className="relative [perspective:1200px]">
        <div className="origin-center will-change-transform lg:[transform:rotateX(3deg)_rotateY(-6deg)]">
          <motion.div
            className="relative"
            animate={reduced ? undefined : { y: [0, -8, 0] }}
            transition={{ duration: 7.5, repeat: Infinity, ease: 'easeInOut' }}
            whileHover={reduced ? undefined : { y: -4, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
          >
            <div
              className="relative flex h-[min(92vw,520px)] max-h-[620px] min-h-[480px] flex-col overflow-hidden rounded-2xl border border-[rgba(130,170,190,0.22)] sm:rounded-3xl lg:h-[570px] lg:min-h-[520px] lg:max-h-[620px]"
              style={{
                background: 'linear-gradient(165deg, rgba(18, 26, 36, 0.92) 0%, rgba(10, 14, 20, 0.94) 100%)',
                boxShadow: `
                  0 0 0 1px rgba(0, 200, 120, 0.14),
                  0 0 80px -12px rgba(33, 240, 195, 0.22),
                  0 32px 80px rgba(0, 0, 0, 0.55),
                  inset 0 1px 0 rgba(255, 255, 255, 0.06)
                `,
              }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.085]"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(245,247,250,0.28) 1px, transparent 1px), linear-gradient(90deg, rgba(245,247,250,0.16) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
                aria-hidden
              />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(33,240,195,0.5)] to-transparent" />
              <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_rgba(33,240,195,0.06)]" aria-hidden />

              {!reduced ? (
                <motion.div
                  className="pointer-events-none absolute inset-x-0 top-0 h-full w-full opacity-[0.035]"
                  style={{
                    background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.9) 50%, transparent 60%)',
                    backgroundSize: '200% 100%',
                  }}
                  animate={{ backgroundPosition: ['0% 0%', '200% 0%'] }}
                  transition={{ duration: 14, repeat: Infinity, ease: 'linear', repeatDelay: 5 }}
                />
              ) : null}

              <div className="relative flex min-h-0 flex-1 flex-col p-5 sm:p-6 lg:p-7">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(130,170,190,0.14)] pb-4">
                  <div>
                    <p className="text-base font-semibold tracking-tight text-[#F5F7FA] sm:text-lg">BTC / USDT</p>
                    <p className="mt-0.5 text-[11px] text-[rgba(245,247,250,0.48)] sm:text-xs">Perpetual</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 rounded-full border border-[rgba(0,200,120,0.5)] bg-[rgba(0,200,120,0.1)] px-2.5 py-1.5 shadow-[0_0_24px_-6px_rgba(0,200,120,0.4)] sm:px-3 sm:py-2">
                    <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5">
                      {!reduced ? (
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#21F0C3] opacity-40" />
                      ) : null}
                      <motion.span
                        className="relative inline-flex h-2 w-2 rounded-full bg-[#21F0C3] shadow-[0_0_12px_rgba(33,240,195,0.85)] sm:h-2.5 sm:w-2.5"
                        animate={reduced ? undefined : { opacity: [1, 0.4, 1], scale: [1, 0.9, 1] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#21F0C3] sm:text-[10px] sm:tracking-[0.2em]">
                      Live signal
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-2.5">
                  <div className="flex items-center justify-between rounded-xl border border-[rgba(130,170,190,0.14)] bg-[rgba(5,7,11,0.5)] px-3.5 py-2.5 sm:px-4 sm:py-3">
                    <span className="text-xs text-[rgba(245,247,250,0.6)] sm:text-sm">Bias</span>
                    <span className="rounded-md bg-[rgba(0,200,120,0.16)] px-2 py-0.5 text-xs font-bold tracking-wide text-[#21F0C3] sm:text-sm">
                      LONG
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-[rgba(130,170,190,0.14)] bg-[rgba(5,7,11,0.5)] px-3.5 py-2.5 sm:px-4 sm:py-3">
                    <span className="text-xs text-[rgba(245,247,250,0.6)] sm:text-sm">Confidence</span>
                    <span className="text-base font-semibold tabular-nums text-[#F5F7FA] sm:text-lg">72%</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-[rgba(245,247,250,0.5)] sm:text-xs">
                    <span>Signal strength</span>
                    <span className="tabular-nums text-[rgba(245,247,250,0.72)]">72 / 100</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[rgba(5,7,11,0.95)] ring-1 ring-[rgba(130,170,190,0.1)]">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-[#00C878] via-[#21F0C3] to-[#00C878] bg-[length:200%_100%]"
                      initial={{ width: '0%' }}
                      animate={{ width: '72%', backgroundPosition: ['0% 0%', '100% 0%'] }}
                      transition={{
                        width: { duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.1 },
                        backgroundPosition: { duration: 3.5, repeat: Infinity, ease: 'linear' },
                      }}
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-2.5">
                  {(
                    [
                      { k: 'Entry', v: '34,100', tone: 'text-[#F5F7FA]' },
                      { k: 'Stop', v: '33,420', tone: 'text-rose-300' },
                      { k: 'Target', v: '36,050', tone: 'text-[#21F0C3]' },
                    ] as const
                  ).map((m) => (
                    <div
                      key={m.k}
                      className="rounded-xl border border-[rgba(130,170,190,0.14)] bg-[rgba(5,7,11,0.58)] px-1.5 py-2.5 text-center sm:px-2 sm:py-3"
                    >
                      <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[rgba(245,247,250,0.42)] sm:text-[9px] sm:tracking-[0.14em]">
                        {m.k}
                      </p>
                      <p className={`mt-1 text-xs font-bold tabular-nums sm:text-sm ${m.tone}`}>{m.v}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-auto flex min-h-0 flex-1 flex-col pt-4">
                  <div className="flex min-h-[120px] flex-1 flex-col overflow-hidden rounded-xl border border-[rgba(130,170,190,0.12)] bg-[rgba(5,7,11,0.55)] px-2.5 py-2.5 ring-1 ring-[rgba(0,200,120,0.07)] sm:min-h-[140px] sm:rounded-2xl sm:px-3 sm:py-3">
                    <div className="mb-1.5 flex justify-between text-[8px] uppercase tracking-[0.18em] text-[rgba(245,247,250,0.3)] sm:text-[9px] sm:tracking-[0.2em]">
                      <span>Price action</span>
                      <span>15m · live</span>
                    </div>
                    <div className="min-h-0 flex-1">
                      <MiniChart gid={gid} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
