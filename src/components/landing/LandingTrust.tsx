import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { LandingSectionPixelField } from '@/components/landing/effects/LandingSectionPixelField';
import { LandingSectionBackdrop } from '@/components/landing/LandingSectionBackdrop';
import { ScrollReveal } from '@/components/landing/ScrollReveal';

const CARDS: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: 'No guaranteed profits',
    body: 'Markets are uncertain. Sigflo is built to improve clarity — not to promise outcomes.',
    icon: (
      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3l7 4v6c0 5-3.5 8.5-7 9.5C8.5 21.5 5 18 5 13V7l7-4z"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
        <path d="M9 12h6" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'No signal spam',
    body: 'Fewer, higher-context setups so you can focus on execution quality.',
    icon: (
      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.35" />
        <path d="M8.2 12.2l2.2 2.2 5.4-5.4" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Designed for disciplined execution',
    body: 'Workflows that reward planning: risk, invalidation, and exits upfront.',
    icon: (
      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 18V6M4 18h16M8 14l3-3 3 2 4-5"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export function LandingTrust() {
  return (
    <section className="relative overflow-hidden bg-landing-mid px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
      <LandingSectionBackdrop variant="trust" />
      <LandingSectionPixelField count={48} />
      <div className="relative z-[2] mx-auto max-w-6xl">
        <ScrollReveal>
          <h2 className="text-[1.65rem] font-semibold tracking-tight text-landing-text sm:text-[1.875rem] lg:text-[2.125rem]">
            Built for real traders
          </h2>
        </ScrollReveal>

        <div className="mt-14 grid divide-y divide-white/[0.08] overflow-visible rounded-2xl border border-white/[0.08] bg-landing-card/40 md:grid-cols-3 md:divide-x md:divide-y-0">
          {CARDS.map((c, i) => (
            <ScrollReveal
              key={c.title}
              delay={0.09 * i}
              className="overflow-visible p-6 sm:p-8"
            >
              <motion.div
                whileHover={{ y: -3 }}
                transition={{ type: 'tween', duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="h-full"
              >
                {/* Outer pad so any soft halo stays inside the cell (avoids rectangular clip artifacts). */}
                <div className="mb-4 flex h-14 w-14 items-center justify-center overflow-visible">
                  <motion.div
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.1] bg-landing-bg text-landing-muted"
                    animate={{
                      boxShadow: [
                        'inset 0 0 0 0 rgba(0,200,120,0)',
                        'inset 0 0 14px 2px rgba(0,200,120,0.2)',
                        'inset 0 0 0 0 rgba(0,200,120,0)',
                      ],
                    }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
                  >
                    {c.icon}
                  </motion.div>
                </div>
                <h3 className="text-base font-semibold text-landing-text">{c.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-landing-muted opacity-90">{c.body}</p>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={0.18} className="mt-10 text-center">
          <p className="text-sm font-medium tracking-wide text-landing-muted opacity-80">
            Designed for execution, not entertainment.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.22} className="mt-8 max-w-2xl text-center md:mx-auto">
          <p className="text-base leading-relaxed text-landing-muted opacity-[0.88]">
            Sigflo is built to help traders make clearer decisions — not to sell fantasy.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
