import { motion, useReducedMotion } from 'framer-motion';
import { useId } from 'react';
import { LandingSectionPixelField } from '@/components/landing/effects/LandingSectionPixelField';
import { LandingSectionBackdrop } from '@/components/landing/LandingSectionBackdrop';
import { ScrollReveal } from '@/components/landing/ScrollReveal';

/** Smooth oscilloscope-style line woven through the section title (same palette as headline). */
function InsideSignalTitleAccent() {
  const reduced = useReducedMotion();
  const uid = useId().replace(/:/g, '');

  return (
    <div className="relative mx-auto inline-block max-w-full px-1">
      <svg
        className="pointer-events-none absolute left-1/2 top-[58%] z-0 h-8 w-[min(104%,20rem)] -translate-x-1/2 -translate-y-1/2 opacity-[0.72] sm:h-9 sm:w-[min(108%,24rem)]"
        viewBox="0 0 400 28"
        fill="none"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id={`isw-a-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgb(245, 247, 250)" stopOpacity="0" />
            <stop offset="18%" stopColor="rgb(245, 247, 250)" stopOpacity="0.14" />
            <stop offset="48%" stopColor="rgb(0, 200, 120)" stopOpacity="0.11" />
            <stop offset="78%" stopColor="rgb(245, 247, 250)" stopOpacity="0.13" />
            <stop offset="100%" stopColor="rgb(245, 247, 250)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`isw-b-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgb(245, 247, 250)" stopOpacity="0" />
            <stop offset="50%" stopColor="rgb(245, 247, 250)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="rgb(245, 247, 250)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.g
          style={{ transformOrigin: 'center' }}
          animate={reduced ? undefined : { x: [0, -5, 0, 4, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        >
          <path
            d="M0,17 C45,5 85,24 130,12 S210,20 265,9 S340,18 400,11"
            stroke={`url(#isw-b-${uid})`}
            strokeWidth="1"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            opacity={0.85}
          />
          <motion.path
            d="M0,15 C52,3 92,22 142,10 S218,18 272,8 S348,16 400,10"
            stroke={`url(#isw-a-${uid})`}
            strokeWidth="1.35"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0.35, opacity: 0.4 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true, amount: 0.9 }}
            transition={{
              pathLength: { duration: 1.5, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 0.6 },
            }}
          />
        </motion.g>
      </svg>
      <h2 className="relative z-[1] text-center text-[1.65rem] font-semibold tracking-tight text-landing-text sm:text-[1.875rem] lg:text-[2.125rem]">
        Inside the Signal
      </h2>
    </div>
  );
}

function PanelChart() {
  const pts = '4,36 28,32 52,28 76,18 100,22 124,12 148,8 172,14 196,6 220,10 244,4';
  return (
    <svg viewBox="0 0 248 44" className="h-11 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="inSigFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(0, 200, 120)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="rgb(0, 200, 120)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.polyline
        fill="none"
        stroke="rgb(0, 200, 120)"
        strokeWidth="1.2"
        strokeOpacity="0.45"
        points={pts}
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0.2, opacity: 0.25 }}
        whileInView={{ pathLength: 1, opacity: 0.55 }}
        viewport={{ once: false, amount: 0.4 }}
        transition={{ pathLength: { duration: 1.8, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.8 } }}
      />
      <polygon fill="url(#inSigFill)" points={`0,44 ${pts} 248,44`} />
    </svg>
  );
}

export function LandingInsideSignal() {
  return (
    <section
      id="inside-signal"
      className="relative scroll-mt-24 overflow-hidden bg-landing-bg px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-32"
    >
      <LandingSectionBackdrop variant="insideSignal" />
      <LandingSectionPixelField count={52} />
      <div className="relative z-[2] mx-auto max-w-3xl">
        <ScrollReveal>
          <div className="flex flex-col items-center">
            <InsideSignalTitleAccent />
            <p className="mx-auto mt-4 max-w-lg text-center text-sm text-landing-muted opacity-[0.86]">
              Not just alerts — structured decisions.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.12} className="mt-12">
          <motion.div
            className="relative overflow-hidden rounded-2xl border border-[rgba(0,200,120,0.22)] bg-landing-card shadow-[0_0_0_1px_rgba(255,255,255,0.05)_inset,0_24px_64px_rgba(0,0,0,0.5)]"
            animate={{
              boxShadow: [
                '0 0 0 1px rgba(255,255,255,0.05) inset, 0 24px 64px rgba(0,0,0,0.5), 0 0 48px -20px rgba(0,200,120,0.12)',
                '0 0 0 1px rgba(255,255,255,0.06) inset, 0 24px 64px rgba(0,0,0,0.52), 0 0 56px -16px rgba(0,200,120,0.2)',
                '0 0 0 1px rgba(255,255,255,0.05) inset, 0 24px 64px rgba(0,0,0,0.5), 0 0 48px -20px rgba(0,200,120,0.12)',
              ],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(0,200,120,0.35)] to-transparent" />
            <div className="divide-y divide-white/[0.08] p-1 sm:p-2">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-landing-muted opacity-80">
                    Pair
                  </p>
                  <p className="mt-1 text-lg font-semibold tracking-tight text-landing-text">BTC / USDT</p>
                </div>
                <motion.div
                  className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2"
                  whileHover={{ boxShadow: '0 0 24px -4px rgba(0,200,120,0.35)' }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="text-[10px] uppercase tracking-wider text-emerald-400/90">Bias</p>
                  <p className="text-center text-sm font-bold tracking-wide text-emerald-400">LONG</p>
                </motion.div>
                <motion.div
                  className="min-w-[5.5rem] rounded-lg border border-white/[0.1] bg-landing-bg/80 px-3 py-2 text-right"
                  whileHover={{ borderColor: 'rgba(0,200,120,0.35)' }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="text-[10px] uppercase tracking-wider text-landing-muted opacity-80">
                    Confidence
                  </p>
                  <p className="text-lg font-semibold tabular-nums text-landing-text">72%</p>
                </motion.div>
              </div>

              <div className="grid gap-0 sm:grid-cols-2">
                <div className="border-b border-white/[0.06] px-4 py-4 sm:border-b-0 sm:border-r sm:py-5">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-landing-muted opacity-75">
                    Entry zone
                  </p>
                  <p className="mt-2 font-mono text-sm font-semibold tabular-nums text-landing-text sm:text-base">
                    34,100 – 34,400
                  </p>
                </div>
                <div className="px-4 py-4 sm:py-5">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-landing-muted opacity-75">
                    Stop loss
                  </p>
                  <p className="mt-2 font-mono text-sm font-semibold tabular-nums text-rose-300/95 sm:text-base">
                    33,420
                  </p>
                </div>
              </div>

              <div className="px-4 py-4 sm:px-5 sm:py-5">
                <p className="text-[10px] font-medium uppercase tracking-widest text-landing-muted opacity-75">
                  Targets
                </p>
                <p className="mt-2 font-mono text-sm font-semibold tabular-nums text-emerald-300/95 sm:text-base">
                  36,000 / 37,200
                </p>
              </div>

              <div className="border-t border-white/[0.06] bg-landing-bg/40 px-3 py-2">
                <PanelChart />
              </div>
            </div>
          </motion.div>
        </ScrollReveal>
      </div>
    </section>
  );
}
