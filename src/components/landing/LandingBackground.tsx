import { motion, useReducedMotion } from 'framer-motion';

export function LandingBackground() {
  const reduced = useReducedMotion();

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-landing-bg" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse 85% 65% at 50% 0%, black 18%, transparent 72%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 85% 65% at 50% 0%, black 18%, transparent 72%)',
        }}
      />
      <motion.div
        className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-landing-accent/[0.028] blur-[72px]"
        animate={reduced ? undefined : { x: [0, 24, 0], y: [0, 16, 0], scale: [1, 1.06, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-cyan-500/[0.028] blur-[72px]"
        animate={reduced ? undefined : { x: [0, -20, 0], y: [0, 22, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
      <motion.div
        className="absolute bottom-0 left-1/2 h-72 w-[120%] -translate-x-1/2 bg-gradient-to-t from-landing-mid/90 to-transparent"
        animate={reduced ? undefined : { opacity: [0.72, 0.88, 0.72] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}
