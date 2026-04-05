import { motion } from 'framer-motion';
import { HeroBackground } from '@/components/landing/hero/HeroBackground';
import { HeroLiveTickerStrip } from '@/components/landing/hero/HeroLiveTickerStrip';
import { HeroNavBar, scrollToLandingId } from '@/components/landing/HeroNavBar';
import { HeroSignalPanel } from '@/components/landing/hero/HeroSignalPanel';
import { LandingPrimaryCta, LandingSecondaryCta } from '@/components/landing/LandingCta';
import { LANDING_SECTIONS } from '@/components/landing/landingSections';

const rise = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

type Props = {
  embedNav: boolean;
};

export function HeroSection({ embedNav }: Props) {
  return (
    <section
      id="top"
      className="relative flex min-h-[92vh] flex-col overflow-hidden bg-[#05070b] text-[#F5F7FA] antialiased"
    >
      <HeroBackground />

      {embedNav ? (
        <div className="sticky top-0 z-30 shrink-0">
          <HeroNavBar variant="hero" />
        </div>
      ) : null}

      <div className="relative z-[1] mx-auto w-full max-w-[1280px] shrink-0 px-4 pt-3 sm:px-6 sm:pt-4 lg:px-8">
        <HeroLiveTickerStrip />
      </div>

      <div className="relative z-[1] flex min-h-0 flex-1 flex-col justify-center py-8 sm:py-10 lg:py-6">
        <div className="mx-auto grid w-full max-w-[1280px] grid-cols-1 items-center gap-10 px-4 sm:gap-12 sm:px-6 lg:grid-cols-[46%_54%] lg:gap-8 lg:px-8 xl:gap-12">
          <div className="min-w-0 lg:py-2">
            <motion.p
              {...rise}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#00C878] sm:mb-5 sm:text-xs sm:tracking-[0.26em]"
            >
              Trading signals / AI-assisted
            </motion.p>
            <motion.h1
              {...rise}
              transition={{ duration: 0.48, delay: 0.03, ease: [0.22, 1, 0.36, 1] }}
              className="text-[1.875rem] font-semibold leading-[1.12] tracking-tight sm:text-[2.125rem] lg:text-[2.5rem] lg:leading-[1.1] xl:text-[2.75rem]"
            >
              Sigflo — The Smarter Way to Trade
            </motion.h1>
            <motion.p
              {...rise}
              transition={{ duration: 0.48, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="mt-5 max-w-[28rem] text-base leading-relaxed text-[rgba(245,247,250,0.72)] sm:text-lg"
            >
              AI-assisted signals, cleaner entries, and smarter exits — all in one trading interface.
            </motion.p>
            <motion.div
              {...rise}
              transition={{ duration: 0.48, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 flex flex-wrap items-center gap-3 sm:mt-9"
            >
              <LandingPrimaryCta
                pulseIdle
                onClick={() => scrollToLandingId(LANDING_SECTIONS.joinWaitlist)}
                className="px-7 py-3.5 text-[0.9375rem]"
              >
                Join Waitlist
              </LandingPrimaryCta>
              <LandingSecondaryCta
                onClick={() => scrollToLandingId(LANDING_SECTIONS.screens)}
                className="border-[rgba(130,170,190,0.22)] bg-[rgba(14,20,28,0.55)] px-7 py-3.5 text-[0.9375rem] backdrop-blur-md hover:border-[rgba(130,170,190,0.32)] hover:bg-[rgba(14,20,28,0.72)]"
              >
                View Screens
              </LandingSecondaryCta>
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.22 }}
              className="mt-7 text-sm text-[rgba(245,247,250,0.55)]"
            >
              Built for active traders — no hype, no noise.
            </motion.p>
          </div>

          <div className="flex min-w-0 justify-center lg:justify-end lg:pl-2">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-[560px] lg:max-w-none"
            >
              <HeroSignalPanel />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
