import { type FormEvent, useState } from 'react';
import { LandingPrimaryCta } from '@/components/landing/LandingCta';
import { LANDING_SECTIONS } from '@/components/landing/landingSections';
import { ScrollReveal } from '@/components/landing/ScrollReveal';

export function LandingFinalCta() {
  const [email, setEmail] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    // Waitlist wiring can connect here later.
    setEmail('');
  }

  return (
    <section
      id={LANDING_SECTIONS.joinWaitlist}
      className="scroll-mt-24 px-4 pb-20 pt-6 sm:px-6 sm:pb-28 sm:pt-8 lg:px-8 lg:pb-32"
    >
      <ScrollReveal className="mx-auto max-w-4xl">
        <div
          className="relative overflow-hidden rounded-3xl border border-white/[0.12] px-6 py-14 shadow-[0_0_80px_-24px_rgba(0,200,120,0.35)] sm:px-10 sm:py-16"
          style={{
            background:
              'linear-gradient(165deg, #0B0E14 0%, #0F1418 35%, rgba(0, 200, 120, 0.08) 78%, #0F1115 100%)',
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 90% 55% at 50% -10%, rgba(0, 224, 138, 0.22), transparent 55%)',
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
            className="pointer-events-none absolute -right-24 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-[rgba(0,200,120,0.12)] blur-[90px]"
            aria-hidden
          />
          <div className="relative text-center">
            <h2 className="text-[1.65rem] font-semibold tracking-tight text-landing-text sm:text-[1.95rem] lg:text-[2.125rem]">
              Trade with clarity. Execute with confidence.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-landing-muted opacity-[0.88]">
              Join the waitlist and get early access to Sigflo.
            </p>

            <form
              onSubmit={onSubmit}
              className="mx-auto mt-10 flex max-w-md flex-col gap-3 sm:flex-row sm:items-stretch"
            >
              <label htmlFor="landing-email" className="sr-only">
                Email
              </label>
              <input
                id="landing-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-[48px] flex-1 rounded-xl border border-white/[0.12] bg-landing-bg/85 px-4 text-sm text-landing-text placeholder:text-landing-muted placeholder:opacity-50 outline-none ring-[rgba(0,200,120,0.2)] transition-shadow focus:border-[rgba(0,200,120,0.45)] focus:ring-2"
              />
              <LandingPrimaryCta type="submit" className="min-h-[48px] shrink-0 px-6">
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
