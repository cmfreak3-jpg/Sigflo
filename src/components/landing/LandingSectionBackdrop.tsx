import type { ReactNode } from 'react';

export type LandingSectionBackdropVariant =
  | 'insideSignal'
  | 'transformation'
  | 'howItWorks'
  | 'features'
  | 'screens'
  | 'trust'
  | 'faq'
  | 'finalCta';

const LAYERS: Record<LandingSectionBackdropVariant, ReactNode> = {
  insideSignal: (
    <>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 85% 55% at 50% 100%, rgba(0, 200, 120, 0.045), transparent 68%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.04] motion-reduce:opacity-[0.03]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 11px, rgba(255,255,255,0.05) 11px, rgba(255,255,255,0.05) 12px)',
        }}
      />
      <div
        className="absolute -left-[18%] top-0 h-[42%] w-[48%] rounded-full opacity-50 blur-2xl motion-reduce:opacity-35"
        style={{ background: 'radial-gradient(circle, rgba(0, 200, 120, 0.04), transparent 72%)' }}
      />
      <div
        className="absolute -right-[12%] bottom-[5%] h-[38%] w-[44%] rounded-full opacity-50 blur-2xl motion-reduce:opacity-35"
        style={{ background: 'radial-gradient(circle, rgba(0, 224, 138, 0.03), transparent 70%)' }}
      />
    </>
  ),
  transformation: (
    <>
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(102deg, rgba(248, 113, 113, 0.02) 0%, transparent 38%, transparent 62%, rgba(0, 200, 120, 0.03) 100%)',
        }}
      />
      <div
        className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 opacity-35"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, rgba(0, 200, 120, 0.06) 45%, rgba(0, 200, 120, 0.06) 55%, transparent 100%)',
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-1/3"
        style={{
          background: 'linear-gradient(to top, rgba(0, 0, 0, 0.22), transparent)',
        }}
      />
    </>
  ),
  howItWorks: (
    <>
      <div
        className="absolute inset-x-0 bottom-0 h-[42%]"
        style={{
          background: 'linear-gradient(to top, rgba(0, 200, 120, 0.022), transparent)',
        }}
      />
      <div
        className="absolute left-[6%] top-[18%] h-36 w-36 rounded-full opacity-45 blur-2xl motion-reduce:opacity-30"
        style={{ background: 'radial-gradient(circle, rgba(0, 200, 120, 0.035), transparent 75%)' }}
      />
      <div
        className="absolute right-[8%] bottom-[22%] h-44 w-44 rounded-full opacity-45 blur-2xl motion-reduce:opacity-30"
        style={{ background: 'radial-gradient(circle, rgba(0, 224, 138, 0.028), transparent 73%)' }}
      />
      <svg
        className="absolute inset-x-[12%] bottom-[10%] h-20 w-auto opacity-[0.05] motion-reduce:opacity-[0.03]"
        viewBox="0 0 800 48"
        fill="none"
        preserveAspectRatio="none"
      >
        <path
          d="M0 36 C180 8 380 44 520 22 S700 6 800 28"
          stroke="rgb(0, 200, 120)"
          strokeWidth="1"
          strokeOpacity="0.32"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </>
  ),
  features: (
    <>
      <div
        className="absolute -right-[22%] top-[12%] h-[78%] w-[58%] -rotate-[7deg] rounded-full opacity-45 blur-2xl motion-reduce:opacity-30"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0, 200, 120, 0.038), transparent 75%)',
        }}
      />
      <div
        className="absolute -left-[18%] bottom-0 h-[55%] w-[52%] rounded-full opacity-45 blur-2xl motion-reduce:opacity-30"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0, 224, 138, 0.022), transparent 72%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.028] motion-reduce:opacity-[0.018]"
        style={{
          backgroundImage:
            'linear-gradient(135deg, rgba(255,255,255,0.04) 0.5px, transparent 0.5px)',
          backgroundSize: '28px 28px',
        }}
      />
    </>
  ),
  screens: (
    <>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 72% 58% at 50% 42%, rgba(255, 255, 255, 0.014), transparent 76%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 130% 85% at 50% 105%, rgba(0, 0, 0, 0.22), transparent 58%)',
        }}
      />
      <div
        className="absolute left-[15%] top-0 h-full w-px opacity-[0.18] motion-reduce:opacity-[0.1]"
        style={{
          background: 'linear-gradient(180deg, transparent, rgba(0, 200, 120, 0.04), transparent)',
        }}
      />
      <div
        className="absolute right-[18%] top-0 h-full w-px opacity-[0.18] motion-reduce:opacity-[0.1]"
        style={{
          background: 'linear-gradient(180deg, transparent, rgba(0, 200, 120, 0.03), transparent)',
        }}
      />
    </>
  ),
  trust: (
    <>
      <div
        className="absolute inset-0 opacity-[0.022] motion-reduce:opacity-[0.014]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }}
      />
      <div
        className="absolute -top-[20%] left-1/2 h-[58%] w-[88%] -translate-x-1/2 rounded-full opacity-45 blur-2xl motion-reduce:opacity-30"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0, 200, 120, 0.028), transparent 75%)',
        }}
      />
      <div
        className="absolute bottom-0 left-1/2 h-[35%] w-full -translate-x-1/2"
        style={{
          background: 'linear-gradient(to top, rgba(0, 0, 0, 0.12), transparent)',
        }}
      />
    </>
  ),
  faq: (
    <>
      <div
        className="absolute inset-x-0 top-0 h-[55%]"
        style={{
          background: 'linear-gradient(to bottom, rgba(0, 200, 120, 0.018), transparent)',
        }}
      />
      <div
        className="absolute right-0 top-[28%] h-72 w-72 translate-x-1/3 rounded-full opacity-40 blur-2xl motion-reduce:opacity-28"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.022), transparent 72%)' }}
      />
      <div
        className="absolute -left-[8%] bottom-[15%] h-48 w-48 rounded-full opacity-40 blur-2xl motion-reduce:opacity-28"
        style={{
          background: 'radial-gradient(circle, rgba(0, 200, 120, 0.022), transparent 74%)',
        }}
      />
    </>
  ),
  finalCta: (
    <>
      <div
        className="absolute inset-x-0 bottom-0 h-[75%]"
        style={{
          background:
            'linear-gradient(to top, rgba(0, 200, 120, 0.032), rgba(0, 200, 120, 0.01) 45%, transparent)',
        }}
      />
      <div
        className="absolute left-0 top-1/4 h-1/2 w-[min(40%,280px)] opacity-35 motion-reduce:opacity-25"
        style={{
          background:
            'linear-gradient(90deg, rgba(0, 224, 138, 0.032), transparent)',
        }}
      />
      <div
        className="absolute right-0 top-1/3 h-[45%] w-[min(35%,240px)] opacity-35 motion-reduce:opacity-25"
        style={{
          background:
            'linear-gradient(270deg, rgba(0, 200, 120, 0.028), transparent)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.018] motion-reduce:opacity-[0.01]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.035) 0.5px, transparent 0.5px)',
          backgroundSize: '64px 64px',
        }}
      />
    </>
  ),
};

export function LandingSectionBackdrop({ variant }: { variant: LandingSectionBackdropVariant }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden"
      aria-hidden
    >
      {LAYERS[variant]}
    </div>
  );
}
