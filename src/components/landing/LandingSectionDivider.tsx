import { motion, useReducedMotion } from 'framer-motion';

export function LandingSectionDivider() {
  const reduced = useReducedMotion();

  return (
    <div className="relative h-px w-full overflow-hidden" aria-hidden>
      <div className="absolute inset-x-6 h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent sm:inset-x-10 lg:inset-x-16" />
      {!reduced ? (
        <motion.div
          className="absolute inset-x-6 top-1/2 h-[3px] -translate-y-1/2 bg-gradient-to-r from-transparent via-[#00C878]/28 to-transparent blur-[1.5px] sm:inset-x-10 lg:inset-x-16"
          initial={{ x: '-30%', opacity: 0 }}
          animate={{ x: ['-30%', '130%'], opacity: [0, 0.5, 0] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.2 }}
        />
      ) : null}
    </div>
  );
}
