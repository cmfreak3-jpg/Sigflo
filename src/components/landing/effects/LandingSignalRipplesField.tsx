import { motion, useReducedMotion } from 'framer-motion';

function RippleCluster({
  className,
  delay = 0,
}: {
  className: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return null;

  return (
    <div className={className} aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(0,200,120,0.055)]"
          initial={{ width: '12%', height: '12%', opacity: 0.18 }}
          animate={{
            width: ['14%', '100%'],
            height: ['14%', '100%'],
            opacity: [0.16, 0],
          }}
          transition={{
            duration: 4.8,
            repeat: Infinity,
            ease: 'easeOut',
            delay: delay + i * 1.1,
          }}
        />
      ))}
    </div>
  );
}

export function LandingSignalRipplesField() {
  return (
    <>
      <RippleCluster
        className="pointer-events-none absolute bottom-[6%] left-1/2 z-0 h-[min(52vh,440px)] w-[min(92vw,760px)] -translate-x-1/2"
        delay={0}
      />
      <RippleCluster
        className="pointer-events-none absolute left-[8%] top-[12%] z-0 h-[min(35vh,300px)] w-[min(40vw,320px)]"
        delay={0.6}
      />
      <RippleCluster
        className="pointer-events-none absolute right-[5%] top-[38%] z-0 h-[min(38vh,320px)] w-[min(42vw,340px)]"
        delay={1.2}
      />
      <RippleCluster
        className="pointer-events-none absolute bottom-[22%] right-[12%] z-0 h-[min(32vh,280px)] w-[min(36vw,300px)]"
        delay={1.8}
      />
    </>
  );
}
