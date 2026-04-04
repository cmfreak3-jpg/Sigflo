import { motion } from 'framer-motion';
import { ScrollReveal } from '@/components/landing/ScrollReveal';

const ROWS = [
  {
    before: 'Noise',
    beforeDetail: 'Feeds that never quiet down.',
    after: 'Clear setups',
    afterDetail: 'Ranked context you can scan in seconds.',
  },
  {
    before: 'Confusion',
    beforeDetail: 'Charts crowded with contradictions.',
    after: 'Guided decisions',
    afterDetail: 'Entry, risk, and targets in one place.',
  },
  {
    before: 'Delay',
    beforeDetail: 'Jumping between tools and tabs.',
    after: 'Fast execution',
    afterDetail: 'From signal review to action with less friction.',
  },
] as const;

export function LandingWhyExists() {
  return (
    <section className="bg-landing-mid px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <ScrollReveal>
          <h2 className="text-[1.65rem] font-semibold tracking-tight text-landing-text sm:text-[1.875rem] lg:text-[2.125rem]">
            Trading apps got noisy.
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-landing-muted opacity-[0.86]">
            Too many indicators. Too many signals. Not enough execution clarity. Sigflo simplifies the
            process into one clean flow.
          </p>
        </ScrollReveal>

        <div className="mt-16 grid gap-8 md:grid-cols-3 md:gap-10">
          {ROWS.map((row, i) => (
            <ScrollReveal key={row.before} delay={0.1 * i}>
              <motion.div
                whileHover={{
                  y: -6,
                  boxShadow:
                    '0 20px 56px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(0, 200, 120, 0.12), 0 0 48px -16px rgba(0, 200, 120, 0.15)',
                }}
                transition={{ type: 'tween', duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.1] bg-landing-card p-5 shadow-landing-card-strong"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/14 to-transparent" />
                <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-1">
                  <div className="rounded-xl border border-white/[0.07] bg-landing-bg/90 p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-landing-muted opacity-80">
                      Before
                    </p>
                    <p className="mt-2 text-lg font-semibold text-landing-text/90">{row.before}</p>
                    <p className="mt-1 text-sm leading-relaxed text-landing-muted opacity-90">
                      {row.beforeDetail}
                    </p>
                  </div>
                  <div
                    className="rounded-xl border border-[rgba(0,200,120,0.35)] p-4 shadow-[0_0_32px_-8px_rgba(0,200,120,0.2)]"
                    style={{
                      background:
                        'linear-gradient(145deg, rgba(0, 200, 120, 0.14) 0%, rgba(0, 224, 138, 0.06) 45%, rgba(30, 34, 42, 0.95) 100%)',
                    }}
                  >
                    <p className="text-xs font-medium uppercase tracking-wider text-landing-accent">
                      With Sigflo
                    </p>
                    <p className="mt-2 text-lg font-semibold text-landing-text">{row.after}</p>
                    <p className="mt-1 text-sm leading-relaxed text-landing-muted opacity-90">
                      {row.afterDetail}
                    </p>
                  </div>
                </div>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
