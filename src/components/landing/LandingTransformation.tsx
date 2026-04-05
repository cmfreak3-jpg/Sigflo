import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { LandingSectionPixelField } from '@/components/landing/effects/LandingSectionPixelField';
import { LandingSectionBackdrop } from '@/components/landing/LandingSectionBackdrop';
import { ScrollReveal } from '@/components/landing/ScrollReveal';

/** Split “chaos → clarity” block replacing the old three-card why section. */
export function LandingTransformation() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.85', 'end 0.35'],
  });
  const leftDim = useTransform(scrollYProgress, [0, 0.45, 1], [0.72, 0.55, 0.4]);
  const rightBright = useTransform(scrollYProgress, [0, 0.5, 1], [0.62, 0.88, 1]);

  return (
    <section
      ref={ref}
      className="relative overflow-hidden bg-landing-mid px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-32"
    >
      <LandingSectionBackdrop variant="transformation" />
      <LandingSectionPixelField count={44} />
      <div className="relative z-[2] mx-auto max-w-6xl">
        <ScrollReveal>
          <h2 className="text-[1.65rem] font-semibold tracking-tight text-landing-text sm:text-[1.875rem] lg:text-[2.125rem]">
            From noise to a single flow
          </h2>
          <p className="mt-4 max-w-2xl text-landing-muted opacity-[0.86]">
            The same market — two ways to experience it. Sigflo is built for the right side.
          </p>
        </ScrollReveal>

        <div className="relative mt-14 grid min-h-[280px] gap-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-landing-bg/40 md:grid-cols-2 md:min-h-[320px] lg:min-h-[360px]">
          <div
            className="absolute left-0 right-0 top-1/2 z-[3] h-px bg-gradient-to-r from-transparent via-[rgba(0,200,120,0.35)] to-transparent md:hidden"
            aria-hidden
          />
          <motion.div
            style={{ opacity: leftDim }}
            className="relative flex flex-col justify-center border-b border-white/[0.08] p-6 md:border-b-0 md:border-r md:border-white/[0.08]"
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-40 blur-[1.5px]"
              style={{
                backgroundImage: `
                  repeating-linear-gradient(0deg, transparent, transparent 14px, rgba(255,255,255,0.06) 14px, rgba(255,255,255,0.06) 15px),
                  repeating-linear-gradient(90deg, transparent, transparent 18px, rgba(255,255,255,0.05) 18px, rgba(255,255,255,0.05) 19px)
                `,
              }}
              aria-hidden
            />
            <div className="relative space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-400/70">Noise</p>
              <p className="text-lg font-semibold text-landing-text/50">Too many signals</p>
              <p className="text-lg font-semibold text-landing-text/45">No clarity</p>
              <div className="flex flex-wrap gap-2 pt-2">
                {['Alert', 'Alert', 'Chart', 'Signal', 'DM'].map((t, i) => (
                  <span
                    key={`${t}-${i}`}
                    className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[10px] text-landing-muted opacity-60"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>

          <div className="pointer-events-none absolute left-1/2 top-0 z-[2] hidden h-full w-px -translate-x-1/2 md:block">
            <div className="h-full w-full bg-gradient-to-b from-transparent via-[rgba(0,200,120,0.22)] to-transparent shadow-[0_0_16px_rgba(0,200,120,0.14)]" />
          </div>

          <motion.div
            style={{ opacity: rightBright }}
            className="relative flex flex-col justify-center p-6 lg:p-8"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[rgba(0,200,120,0.06)] to-transparent opacity-90" aria-hidden />
            <div className="relative rounded-xl border border-[rgba(0,200,120,0.2)] bg-landing-card/95 p-4 shadow-[0_0_28px_-14px_rgba(0,200,120,0.1)]">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <span className="text-sm font-semibold text-landing-text">Sigflo</span>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-400">
                  Structured
                </span>
              </div>
              <div className="mt-3 space-y-2 text-[11px]">
                <div className="flex justify-between text-landing-muted opacity-90">
                  <span>Setup</span>
                  <span className="text-landing-text">BTC / USDT</span>
                </div>
                <div className="flex justify-between text-landing-muted opacity-90">
                  <span>Plan</span>
                  <span className="text-emerald-400/90">Entry · Stop · Targets</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-landing-bg">
                  <div
                    className="h-full w-[72%] rounded-full bg-gradient-to-r from-[#00C878] to-landing-accent-hi"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
