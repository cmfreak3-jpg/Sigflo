import type { ReactNode } from 'react';

type PillTone = 'neutral' | 'cyan' | 'green' | 'red';

const tones: Record<PillTone, string> = {
  neutral: 'border-white/10 bg-white/[0.04] text-sigflo-muted',
  cyan: 'border-cyan-400/25 bg-sigflo-accentDim text-cyan-200',
  green: 'border-emerald-400/25 bg-sigflo-profitDim text-emerald-200',
  red: 'border-rose-400/25 bg-sigflo-lossDim text-rose-200',
};

export function Pill({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: PillTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
