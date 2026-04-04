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

function scrollToId(id: string) {
  const el = document.getElementById(id);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <header
      className={`sticky top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-300 ${
        scrolled
          ? 'border-b border-white/[0.08] bg-[#0B0E14]/90 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl'
          : 'border-b border-transparent bg-[#0B0E14]/55 backdrop-blur-md'
      }`}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6 lg:px-8">
        <a
          href="#top"
          className="text-lg font-semibold tracking-tight text-landing-text transition-colors hover:text-white"
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
              onClick={() => scrollToId(item.id)}
              className="text-sm text-landing-muted opacity-90 transition-colors hover:text-landing-text hover:opacity-100"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="hidden md:block">
          <LandingPrimaryCta
            onClick={() => scrollToId(LANDING_SECTIONS.joinWaitlist)}
            className="px-4 py-2"
          >
            Join Waitlist
          </LandingPrimaryCta>
        </div>

        <button
          type="button"
          className="relative z-[60] flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-lg border border-white/[0.12] bg-landing-surface/50 md:hidden"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMobileOpen((o) => !o)}
        >
          <motion.span
            animate={mobileOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
            className="block h-0.5 w-5 rounded-full bg-landing-text"
          />
          <motion.span
            animate={mobileOpen ? { opacity: 0, x: -8 } : { opacity: 1, x: 0 }}
            className="block h-0.5 w-5 rounded-full bg-landing-text"
          />
          <motion.span
            animate={mobileOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
            className="block h-0.5 w-5 rounded-full bg-landing-text"
          />
        </button>
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
            className="fixed inset-y-0 right-0 z-[58] flex w-[min(100%,20rem)] flex-col border-l border-white/[0.1] bg-landing-mid shadow-2xl md:hidden"
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
                    scrollToId(item.id);
                    setMobileOpen(false);
                  }}
                  className="rounded-xl px-4 py-3 text-left text-base font-medium text-landing-text transition-colors hover:bg-landing-card"
                >
                  {item.label}
                </motion.button>
              ))}
            </div>
            <div className="border-t border-white/[0.08] p-4">
              <LandingPrimaryCta
                className="w-full py-3"
                onClick={() => {
                  scrollToId(LANDING_SECTIONS.joinWaitlist);
                  setMobileOpen(false);
                }}
              >
                Join Waitlist
              </LandingPrimaryCta>
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
