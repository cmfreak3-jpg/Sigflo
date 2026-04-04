import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { LANDING_SECTIONS } from '@/components/landing/landingSections';
import { ScrollReveal } from '@/components/landing/ScrollReveal';

const FAQS = [
  {
    q: 'What is Sigflo?',
    a: 'Sigflo is an AI-assisted trading interface that brings together signals, structured trade review, and execution-focused workflows. It is designed to reduce noise and make the path from idea to order more deliberate.',
  },
  {
    q: 'Does Sigflo guarantee profits?',
    a: 'No. Trading carries real risk, and outcomes are never guaranteed. Sigflo provides context and organization — not promises about returns.',
  },
  {
    q: 'Which exchange does Sigflo support first?',
    a: 'Bybit is supported first. Additional exchanges are planned as the product matures.',
  },
  {
    q: 'Is this for beginners or active traders?',
    a: 'Sigflo is aimed at people who already trade actively and want a cleaner, faster workflow. Beginners may still find it useful, but the product assumes you understand basic market and order concepts.',
  },
  {
    q: 'Can I join the waitlist?',
    a: 'Yes. Add your email in the form below to join the waitlist. We will reach out as spots open.',
  },
] as const;

export function LandingFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id={LANDING_SECTIONS.faq}
      className="scroll-mt-24 bg-landing-bg px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-32"
    >
      <div className="mx-auto max-w-3xl">
        <ScrollReveal>
          <h2 className="text-[1.65rem] font-semibold tracking-tight text-landing-text sm:text-[1.875rem] lg:text-[2.125rem]">
            Frequently asked questions
          </h2>
          <p className="mt-4 text-landing-muted opacity-[0.82]">Straight answers — no marketing fog.</p>
        </ScrollReveal>

        <div className="mt-14 divide-y divide-white/[0.08] rounded-2xl border border-white/[0.1] bg-landing-card/90 shadow-landing-card-strong">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.03] sm:px-6 sm:py-5"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-semibold text-landing-text sm:text-base">{item.q}</span>
                  <motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.22 }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.1] bg-landing-bg text-landing-muted"
                    aria-hidden
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M6 9l6 6 6-6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="border-t border-white/[0.08] px-5 pb-5 pt-3 text-sm leading-relaxed text-landing-muted opacity-90 sm:px-6 sm:pb-6">
                        {item.a}
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
