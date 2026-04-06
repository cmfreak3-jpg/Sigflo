import type { ReactNode } from 'react';

export type ExitModePanelProps = {
  /** When true, wraps children with live-trade emphasis chrome. */
  live: boolean;
  children: ReactNode;
  className?: string;
};

/**
 * Groups AI exit / automation controls with state-aware framing in live trade mode.
 */
export function ExitModePanel({ live, children, className = '' }: ExitModePanelProps) {
  if (!live) {
    return <div className={className}>{children}</div>;
  }
  return (
    <div
      className={`rounded-xl border border-[#00ffc8]/14 bg-gradient-to-b from-[#00ffc8]/[0.04] to-black/20 p-2 ring-1 ring-white/[0.04] sm:p-2.5 ${className}`}
    >
      <p className="mb-1.5 text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#7ee8d3]/85 sm:text-[9px]">
        Exit & automation
      </p>
      {children}
    </div>
  );
}
