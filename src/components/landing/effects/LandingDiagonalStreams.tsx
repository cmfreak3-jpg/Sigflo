import { motion, useReducedMotion } from 'framer-motion';

const STREAMS = [
  { left: '-8%', rotate: 34, delay: 0, dots: 34 },
  { left: '4%', rotate: 38, delay: 0.2, dots: 30 },
  { left: '12%', rotate: 41, delay: 0.4, dots: 38 },
  { left: '25%', rotate: 35, delay: 0.55, dots: 32 },
  { left: '38%', rotate: 36, delay: 0.2, dots: 36 },
  { left: '52%', rotate: 31, delay: 0.8, dots: 36 },
  { left: '62%', rotate: 44, delay: 0.65, dots: 32 },
  { left: '72%', rotate: 37, delay: 0.3, dots: 34 },
  { left: '78%', rotate: 33, delay: 0.15, dots: 40 },
  { left: '88%', rotate: 40, delay: 0.45, dots: 28 },
  { left: '95%', rotate: 39, delay: 0.5, dots: 30 },
] as const;

export function LandingDiagonalStreams() {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {STREAMS.slice(0, 6).map((s, si) => (
          <div
            key={si}
            className="absolute top-[-15%] h-[130vh] w-6 opacity-[0.2]"
            style={{ left: s.left, transform: `rotate(${s.rotate}deg)` }}
          >
            {Array.from({ length: 16 }, (_, i) => (
              <span
                key={i}
                className="absolute left-1/2 block h-1 w-1 -translate-x-1/2 rounded-[1px] bg-[#00C878]"
                style={{ top: `${(i / 16) * 100}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {STREAMS.map((s, si) => (
        <div
          key={si}
          className="absolute top-[-25%] h-[150vh] w-10"
          style={{ left: s.left, transform: `rotate(${s.rotate}deg)` }}
        >
          {Array.from({ length: s.dots }, (_, i) => {
            const t = i / s.dots;
            const isBright = i % 4 === 0;
            return (
              <motion.span
                key={i}
                className={`absolute left-1/2 block -translate-x-1/2 rounded-[1px] ${
                  isBright ? 'bg-[#00E08A]' : 'bg-[#00C878]'
                }`}
                style={{
                  top: `${t * 100}%`,
                  width: isBright ? 4 : 3,
                  height: isBright ? 4 : 2,
                  boxShadow: isBright ? '0 0 5px rgba(0,224,138,0.28)' : '0 0 3px rgba(0,200,120,0.18)',
                }}
                animate={{
                  opacity: [0.08, 0.48, 0.14, 0.38, 0.08],
                  scale: [0.9, 1.12, 0.96, 1.06, 0.9],
                  y: [0, 6, -4, 3, 0],
                }}
                transition={{
                  duration: 2.4 + (i % 5) * 0.15,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.07 + s.delay,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
