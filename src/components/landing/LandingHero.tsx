import { motion } from 'framer-motion';
import { HeroTradingMockup } from '@/components/landing/HeroTradingMockup';
import { LandingPrimaryCta, LandingSecondaryCta } from '@/components/landing/LandingCta';
import { LANDING_SECTIONS } from '@/components/landing/landingSections';

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function LandingHero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden bg-[#0B0E14] px-4 pb-24 pt-14 sm:px-6 sm:pb-32 sm:pt-20 lg:px-8 lg:pb-40 lg:pt-28"
    >
      {/* Chart-style environment texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage: `
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 39px,
              rgba(245, 247, 250, 0.55) 39px,
              rgba(245, 247, 250, 0.55) 40px
            ),
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 47px,
              rgba(245, 247, 250, 0.35) 47px,
              rgba(245, 247, 250, 0.35) 48px
            )
          `,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(105deg, transparent 40%, rgba(0, 200, 120, 0.12) 50%, transparent 60%)',
        }}
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-6xl gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-center lg:gap-20">
        <div className="max-w-xl">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-landing-accent"
          >
            Trading terminal · AI-assisted
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.48, delay: 0.05 }}
            className="text-[2rem] font-semibold leading-[1.15] tracking-tight text-landing-text sm:text-4xl sm:leading-[1.12] lg:text-[3.15rem] lg:leading-[1.1]"
          >
            Sigflo — The Smarter Way to Trade
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.48, delay: 0.1 }}
            className="mt-6 text-lg leading-relaxed text-landing-muted opacity-[0.88] sm:text-xl"
          >
            AI-assisted signals, cleaner entries, and smarter exits — all in one trading interface.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.48, delay: 0.16 }}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <LandingPrimaryCta
              onClick={() => scrollToId(LANDING_SECTIONS.joinWaitlist)}
              className="px-6 py-3"
            >
              Join Waitlist
            </LandingPrimaryCta>
            <LandingSecondaryCta
              onClick={() => scrollToId(LANDING_SECTIONS.screens)}
              className="px-6 py-3"
            >
              View Screens
            </LandingSecondaryCta>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.28 }}
            className="mt-7 text-sm text-landing-muted opacity-[0.82]"
          >
            Built for active traders — no hype, no noise.
          </motion.p>
        </div>

        <div className="relative flex justify-center lg:justify-end">
          <HeroTradingMockup />
        </div>
      </div>
    </section>
  );
}
