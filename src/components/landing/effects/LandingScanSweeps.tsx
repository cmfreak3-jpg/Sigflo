import { motion, useReducedMotion } from 'framer-motion';

export function LandingScanSweeps() {
  const reduced = useReducedMotion();
  if (reduced) return null;

  return (
    <>
      <motion.div
        className="pointer-events-none absolute inset-x-0 z-[1] h-28 bg-gradient-to-b from-transparent via-[rgba(0,200,120,0.028)] to-transparent"
        initial={{ top: '-12%' }}
        animate={{ top: ['-12%', '112%'] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'linear' }}
        aria-hidden
      />
      <motion.div
        className="pointer-events-none absolute inset-x-0 z-[1] h-20 bg-gradient-to-b from-transparent via-[rgba(0,224,138,0.02)] to-transparent"
        initial={{ top: '112%' }}
        animate={{ top: ['112%', '-12%'] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear', delay: 2 }}
        aria-hidden
      />
      <motion.div
        className="pointer-events-none absolute inset-y-0 z-[1] w-24 bg-gradient-to-r from-transparent via-[rgba(0,200,120,0.018)] to-transparent"
        initial={{ left: '-15%' }}
        animate={{ left: ['-15%', '115%'] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear', delay: 4 }}
        aria-hidden
      />
    </>
  );
}
