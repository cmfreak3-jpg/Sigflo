import { motion, useReducedMotion } from 'framer-motion';

export function LandingAtmosphereGrid() {
  const reduced = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div
        className="absolute inset-0 opacity-[0.038]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 200, 120, 0.14) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 200, 120, 0.09) 1px, transparent 1px)
          `,
          backgroundSize: '56px 56px',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.028]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(245, 247, 250, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(245, 247, 250, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '14px 14px',
        }}
      />
      {!reduced ? (
        <motion.div
          className="absolute inset-0 opacity-100"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 100% 80% at 50% 50%, transparent 40%, rgba(0,200,120,0.016) 70%, transparent 100%)',
          }}
          animate={{ opacity: [0.55, 0.82, 0.6, 0.78, 0.55] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : null}
    </div>
  );
}
