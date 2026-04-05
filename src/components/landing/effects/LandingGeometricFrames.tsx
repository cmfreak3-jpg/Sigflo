import { motion, useReducedMotion } from 'framer-motion';

const FRAMES = [
  { w: 'min(72vw, 520px)', h: 'min(48vh, 380px)', left: '-12%', top: '8%' },
  { w: 'min(55vw, 400px)', h: 'min(38vh, 300px)', left: '58%', top: '3%' },
  { w: 'min(65vw, 480px)', h: 'min(42vh, 340px)', left: '22%', top: '42%' },
  { w: 'min(48vw, 360px)', h: 'min(55vh, 400px)', left: '72%', top: '48%' },
  { w: 'min(80vw, 640px)', h: 'min(35vh, 260px)', left: '8%', top: '72%' },
  { w: 'min(42vw, 320px)', h: 'min(44vh, 320px)', left: '45%', top: '18%' },
  { w: 'min(58vw, 440px)', h: 'min(50vh, 360px)', left: '-18%', top: '55%' },
  { w: 'min(50vw, 380px)', h: 'min(40vh, 300px)', left: '68%', top: '78%' },
] as const;

export function LandingGeometricFrames() {
  const reduced = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {FRAMES.map((f, i) => (
        <motion.div
          key={i}
          className="absolute rounded-[1.75rem] border border-[rgba(0,200,120,0.045)] sm:rounded-[2rem]"
          style={{
            width: f.w,
            height: f.h,
            left: f.left,
            top: f.top,
            boxShadow: 'inset 0 0 48px rgba(0,200,120,0.012)',
          }}
          animate={
            reduced
              ? undefined
              : {
                  opacity: [0.028, 0.065, 0.035, 0.055, 0.028],
                  rotate: [0, 1.2, -0.8, 0.6, 0],
                  x: [0, 12, -8, 6, 0],
                  y: [0, -10, 6, -4, 0],
                  scale: [1, 1.02, 0.99, 1.01, 1],
                }
          }
          transition={{
            duration: 18 + i * 2.2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.7,
          }}
          initial={{ opacity: reduced ? 0.045 : 0.038 }}
        />
      ))}
    </div>
  );
}
