import { motion } from 'framer-motion';
import { LandingSectionBackdrop } from '@/components/landing/LandingSectionBackdrop';
import { LANDING_SECTIONS } from '@/components/landing/landingSections';
import { ScrollReveal } from '@/components/landing/ScrollReveal';

const FEATURES = [
  {
    title: 'AI Signal Engine',
    description: 'Curated setups with context — not an endless alert stream.',
  },
  {
    title: 'Entry Guidance',
    description: 'Clear zones, invalidation, and what has to be true for the idea to work.',
  },
  {
    title: 'Exit Guidance',
    description: 'Structured take-profit thinking and assisted exit workflows when conditions shift.',
  },
  {
    title: 'Risk & Position View',
    description: 'See exposure and risk in plain language before you commit size.',
  },
  {
    title: 'Trade Execution Screen',
    description: 'One focused screen to move from review to order with fewer mistakes.',
  },
  {
    title: 'Bybit Integration',
    description: 'Built around Bybit first, with a roadmap for more venues.',
  },
] as const;

export function LandingFeatures() {
  return (
    <section
      id={LANDING_SECTIONS.features}
      className="relative scroll-mt-24 overflow-hidden bg-landing-mid px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-32"
    >
      <LandingSectionBackdrop variant="features" />
      <div className="relative z-[1] mx-auto max-w-6xl">
        <ScrollReveal>
          <h2 className="text-[1.65rem] font-semibold tracking-tight text-landing-text sm:text-[1.875rem] lg:text-[2.125rem]">
            Everything in one trading flow
          </h2>
          <p className="mt-4 max-w-xl text-landing-muted opacity-[0.86]">
            The pieces traders already juggle — unified into a single, disciplined interface.
          </p>
        </ScrollReveal>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <ScrollReveal key={f.title} delay={0.07 * i}>
              <motion.div
                whileHover={{
                  y: -5,
                  boxShadow:
                    '0 18px 48px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.09), 0 0 36px -14px rgba(0, 200, 120, 0.1)',
                }}
                transition={{ type: 'tween', duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="group relative h-full overflow-hidden rounded-2xl border border-white/[0.1] bg-landing-card p-6 shadow-landing-card-strong"
              >
                <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-landing-accent/6 blur-2xl transition-opacity group-hover:opacity-100" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/14 to-transparent" />
                <h3 className="text-base font-semibold text-landing-text">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-landing-muted opacity-90">{f.description}</p>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
