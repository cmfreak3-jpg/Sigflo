import { motion } from 'framer-motion';
import { type FormEvent, useState } from 'react';
import { LandingPrimaryCta } from '@/components/landing/LandingCta';
import { LandingSectionPixelField } from '@/components/landing/effects/LandingSectionPixelField';
import { LandingSectionBackdrop } from '@/components/landing/LandingSectionBackdrop';
import { LANDING_SECTIONS } from '@/components/landing/landingSections';
import { ScrollReveal } from '@/components/landing/ScrollReveal';

export function LandingFinalCta() {
  const [email, setEmail] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setEmail('');
  }

  return (
    <section
      id={LANDING_SECTIONS.joinWaitlist}
      className="relative scroll-mt-24 overflow-hidden bg-landing-bg px-4 pb-20 pt-6 sm:px-6 sm:pb-28 sm:pt-8 lg:px-8 lg:pb-32"
    >
      <LandingSectionBackdrop variant="finalCta" />
      <LandingSectionPixelField count={120} />
      <ScrollReveal className="relative z-[2] mx-auto max-w-4xl">
        <div
          className="relative overflow-hidden rounded-3xl border border-white/[0.12] px-6 py-14 shadow-[0_0_64px_-28px_rgba(0,200,120,0.16)] sm:px-10 sm:py-16"
          style={{
            background:
              'linear-gradient(155deg, #07090d 0%, #0B0E14 30%, rgba(0, 200, 120, 0.06) 72%, #0d1218 100%)',
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 90% 55% at 50% -10%, rgba(0, 224, 138, 0.12), transparent 55%)',
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, transparent, transparent 31px, rgba(245,247,250,0.4) 31px, rgba(245,247,250,0.4) 32px)',
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-24 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-[rgba(0,200,120,0.06)] blur-[64px]"
            aria-hidden
          />
          <div className="relative text-center">
            <h2 className="text-[1.65rem] font-semibold tracking-tight text-landing-text sm:text-[1.95rem] lg:text-[2.125rem]">
              Trade with clarity. Execute with confidence.
            </h2>
            <motion.div
              className="mx-auto mt-3 h-[2px] max-w-xs origin-center rounded-full bg-gradient-to-r from-transparent via-[#00C878] to-transparent"
              animate={{ scaleX: [0.45, 1, 0.45], opacity: [0.5, 0.95, 0.5] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden
            />
            <p className="mx-auto mt-6 max-w-lg text-landing-muted opacity-[0.88]">
              Join the waitlist and get early access to Sigflo.
            </p>

            <form
              onSubmit={onSubmit}
              className="mx-auto mt-10 flex max-w-md flex-col gap-3 sm:flex-row sm:items-stretch"
            >
              <label htmlFor="landing-email" className="sr-only">
                Email
              </label>
              <motion.div
                className="relative min-h-[48px] flex-1 rounded-xl"
                animate={{
                  boxShadow: [
                    '0 0 0 1px rgba(255,255,255,0.1), 0 0 24px -8px rgba(0,200,120,0.15)',
                    '0 0 0 1px rgba(0,200,120,0.25), 0 0 36px -6px rgba(0,200,120,0.28)',
                    '0 0 0 1px rgba(255,255,255,0.1), 0 0 24px -8px rgba(0,200,120,0.15)',
                  ],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <input
                  id="landing-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="relative z-[1] min-h-[48px] w-full rounded-xl border border-white/[0.12] bg-landing-bg/90 px-4 text-sm text-landing-text placeholder:text-landing-muted placeholder:opacity-50 outline-none ring-0 transition-colors focus:border-[rgba(0,200,120,0.5)]"
                />
              </motion.div>
              <LandingPrimaryCta pulseIdle type="submit" className="min-h-[48px] shrink-0 px-6">
                Join Waitlist
              </LandingPrimaryCta>
            </form>

            <p className="mt-6 text-xs text-landing-muted opacity-80">
              Bybit support first. More integrations later.
            </p>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
