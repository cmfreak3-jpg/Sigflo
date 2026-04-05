import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { LandingPrimaryCta } from '@/components/landing/LandingCta';
import { LANDING_SECTIONS } from '@/components/landing/landingSections';

const NAV = [
  { label: 'Features', id: LANDING_SECTIONS.features },
  { label: 'How It Works', id: LANDING_SECTIONS.howItWorks },
  { label: 'Screens', id: LANDING_SECTIONS.screens },
  { label: 'FAQ', id: LANDING_SECTIONS.faq },
] as const;

export function scrollToLandingId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

type Props = {
  /** Lighter glass when overlaid on hero gradient */
  variant?: 'hero' | 'solid';
  className?: string;
};

export function HeroNavBar({ variant = 'solid', className = '' }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const bar =
    variant === 'hero'
      ? 'border-b border-[rgba(130,170,190,0.14)] bg-[rgba(5,7,11,0.38)] backdrop-blur-xl'
      : 'border-b border-white/[0.08] bg-[#0B0E14]/92 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.35)]';

  return (
    <>
      <div className={`${bar} ${className}`.trim()}>
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-[3.75rem] sm:px-6 lg:px-8">
          <a
            href="#top"
            className="text-lg font-semibold tracking-tight text-[#F5F7FA] transition-colors hover:text-white"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setMobileOpen(false);
            }}
          >
            Sigflo
          </a>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToLandingId(item.id)}
                className="text-sm text-[rgba(245,247,250,0.72)] transition-colors hover:text-[#F5F7FA]"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="hidden md:block">
            <LandingPrimaryCta
              onClick={() => scrollToLandingId(LANDING_SECTIONS.joinWaitlist)}
              className="px-4 py-2"
            >
              Join Waitlist
            </LandingPrimaryCta>
          </div>

          <button
            type="button"
            className="relative z-[60] flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-lg border border-[rgba(130,170,190,0.2)] bg-[rgba(14,20,28,0.5)] md:hidden"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileOpen((o) => !o)}
          >
            <motion.span
              animate={mobileOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
              className="block h-0.5 w-5 rounded-full bg-[#F5F7FA]"
            />
            <motion.span
              animate={mobileOpen ? { opacity: 0, x: -8 } : { opacity: 1, x: 0 }}
              className="block h-0.5 w-5 rounded-full bg-[#F5F7FA]"
            />
            <motion.span
              animate={mobileOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
              className="block h-0.5 w-5 rounded-full bg-[#F5F7FA]"
            />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.nav
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 360 }}
            className="fixed inset-y-0 right-0 z-[58] flex w-[min(100%,20rem)] flex-col border-l border-white/[0.1] bg-[#0B1220] shadow-2xl md:hidden"
            aria-label="Mobile"
          >
            <div className="flex flex-1 flex-col gap-1 p-4 pt-20">
              {NAV.map((item, i) => (
                <motion.button
                  key={item.id}
                  type="button"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 * i, duration: 0.25 }}
                  onClick={() => {
                    scrollToLandingId(item.id);
                    setMobileOpen(false);
                  }}
                  className="rounded-xl px-4 py-3 text-left text-base font-medium text-[#F5F7FA] transition-colors hover:bg-[rgba(14,20,28,0.9)]"
                >
                  {item.label}
                </motion.button>
              ))}
            </div>
            <div className="border-t border-white/[0.08] p-4">
              <LandingPrimaryCta
                className="w-full py-3"
                onClick={() => {
                  scrollToLandingId(LANDING_SECTIONS.joinWaitlist);
                  setMobileOpen(false);
                }}
              >
                Join Waitlist
              </LandingPrimaryCta>
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </>
  );
}
