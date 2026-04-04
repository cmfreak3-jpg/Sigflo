import { motion } from 'framer-motion';
import { Fragment } from 'react';
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

function StepConnector() {
  return (
    <div
      className="hidden shrink-0 flex-col justify-center self-stretch pt-10 opacity-[0.28] md:flex"
      aria-hidden
    >
      <div className="flex items-center gap-0.5">
        <div className="h-px w-6 bg-gradient-to-r from-landing-accent/50 to-transparent" />
        <svg className="h-3 w-3 text-landing-accent/60" viewBox="0 0 12 12" fill="none">
          <path
            d="M2.5 6h5.5m0 0L6 3.5M8 6 6 8.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="h-px w-6 bg-gradient-to-l from-landing-accent/40 to-transparent" />
      </div>
    </div>
  );
}

export function LandingHowItWorks() {
  return (
    <section
      id={LANDING_SECTIONS.howItWorks}
      className="scroll-mt-24 bg-landing-bg px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-32"
    >
      <div className="mx-auto max-w-6xl">
        <ScrollReveal>
          <h2 className="text-[1.65rem] font-semibold tracking-tight text-landing-text sm:text-[1.875rem] lg:text-[2.125rem]">
            From signal to execution
          </h2>
          <p className="mt-4 max-w-xl text-landing-muted opacity-[0.86]">
            A linear flow designed for people who actually place trades — not scroll forever.
          </p>
        </ScrollReveal>

        <div className="mt-16 flex flex-col gap-10 md:flex-row md:items-stretch md:gap-2 lg:gap-4">
          {STEPS.map((s, i) => (
            <Fragment key={s.step}>
              <ScrollReveal className="min-w-0 flex-1" delay={0.12 * i}>
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
                    <span className="relative z-[1] flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.1] bg-landing-bg text-landing-accent shadow-[0_0_0_3px_#1E222A]">
                      {s.icon}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-widest text-landing-muted opacity-90">
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
                      <span className="text-[10px] uppercase tracking-wider text-landing-muted">Next</span>
                      <div className="h-px flex-1 bg-gradient-to-l from-landing-accent/35 to-transparent" />
                    </div>
                  ) : null}
                </motion.div>
              </ScrollReveal>
              {i < STEPS.length - 1 ? <StepConnector /> : null}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
