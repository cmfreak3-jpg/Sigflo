import { motion } from 'framer-motion';
import { Fragment } from 'react';
import { LandingSectionBackdrop } from '@/components/landing/LandingSectionBackdrop';
import { LANDING_SECTIONS } from '@/components/landing/landingSections';
import { ScrollReveal } from '@/components/landing/ScrollReveal';

const STEPS = [
  {
    step: '01',
    title: 'Signal Appears',
    body: 'Ranked setups instead of spam.',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 14l4-4 4 4 8-8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M16 6h4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    step: '02',
    title: 'Review the Trade',
    body: 'Entry, stop, targets, confidence, and AI context.',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    step: '03',
    title: 'Execute Fast',
    body: 'Move from idea to action with less friction.',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M13 5l7 7-7 7M4 12h15"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
] as const;

function FlowConnector() {
  return (
    <div
      className="relative hidden h-12 w-12 shrink-0 self-center overflow-hidden md:flex md:w-16 lg:w-20"
      aria-hidden
    >
      <div className="absolute inset-y-0 left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-landing-accent/25 via-white/[0.08] to-landing-accent/20" />
      <motion.div
        className="absolute top-1/2 w-[45%] -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-[#00C878] to-transparent py-[1px] opacity-70 shadow-[0_0_8px_rgba(0,200,120,0.18)]"
        initial={{ left: '-40%' }}
        animate={{ left: ['-40%', '110%'] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

export function LandingHowItWorks() {
  return (
    <section
      id={LANDING_SECTIONS.howItWorks}
      className="relative scroll-mt-24 overflow-hidden bg-landing-bg px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-32"
    >
      <LandingSectionBackdrop variant="howItWorks" />
      <div className="relative z-[1] mx-auto max-w-6xl">
        <ScrollReveal>
          <h2 className="text-[1.65rem] font-semibold tracking-tight text-landing-text sm:text-[1.875rem] lg:text-[2.125rem]">
            From signal to execution
          </h2>
          <p className="mt-4 max-w-xl text-landing-muted opacity-[0.86]">
            A linear flow designed for people who actually place trades — not scroll forever.
          </p>
        </ScrollReveal>

        <div className="mt-16 flex flex-col gap-10 md:flex-row md:items-stretch md:justify-center md:gap-0">
          {STEPS.map((s, i) => (
            <Fragment key={s.step}>
              <ScrollReveal className="min-w-0 flex-1 md:max-w-[min(100%,18rem)] lg:max-w-none" delay={0.1 * i}>
                <motion.div
                  whileHover={{
                    y: -5,
                    boxShadow:
                      '0 18px 52px rgba(0, 0, 0, 0.48), 0 0 0 1px rgba(255,255,255,0.08), 0 0 40px -18px rgba(0, 200, 120, 0.12)',
                  }}
                  transition={{ type: 'tween', duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="relative flex h-full flex-col rounded-2xl border border-white/[0.1] bg-landing-card p-6 shadow-landing-card-strong"
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
                  <div className="mb-4 flex items-center gap-3">
                    <motion.span
                      className="relative z-[1] flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.1] bg-landing-bg text-landing-accent shadow-[0_0_0_3px_#1E222A]"
                      whileHover={{ scale: 1.07, borderColor: 'rgba(0,200,120,0.35)' }}
                      transition={{ type: 'tween', duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {s.icon}
                    </motion.span>
                    <span className="font-mono text-xs font-semibold uppercase tracking-widest text-landing-muted opacity-90">
                      {s.step}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-landing-text">{s.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-landing-muted opacity-90">
                    {s.body}
                  </p>
                  {i < STEPS.length - 1 ? (
                    <div className="mt-8 flex items-center gap-2 opacity-40 md:hidden" aria-hidden>
                      <div className="h-px flex-1 bg-gradient-to-r from-landing-accent/50 to-transparent" />
                      <span className="font-mono text-[10px] uppercase tracking-wider text-landing-muted">
                        {STEPS[i + 1]?.step}
                      </span>
                      <div className="h-px flex-1 bg-gradient-to-l from-landing-accent/35 to-transparent" />
                    </div>
                  ) : null}
                </motion.div>
              </ScrollReveal>
              {i < STEPS.length - 1 ? <FlowConnector /> : null}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
