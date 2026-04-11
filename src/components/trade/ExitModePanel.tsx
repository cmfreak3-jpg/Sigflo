import type { ReactNode } from 'react';

export type ExitModePanelProps = {
  /** When true, wraps children with live-trade emphasis chrome. */
  live: boolean;
  children: ReactNode;
  /** Rendered below children, inside the same frame when `live`. */
  footer?: ReactNode;
  className?: string;
};

/**
 * Groups AI exit / automation controls with state-aware framing in live trade mode.
 */
export function ExitModePanel({ live, children, footer, className = '' }: ExitModePanelProps) {
  const footerBlock =
    footer != null ? (
      <div className={`mt-2 border-t pt-2 ${live ? 'border-[#00ffc8]/12' : 'border-white/[0.06]'}`}>{footer}</div>
    ) : null;

  if (!live) {
    return (
      <div className={className}>
        {children}
        {footerBlock}
      </div>
    );
  }
  return (
    <div
      className={`rounded-xl bg-gradient-to-b from-[#00ffc8]/[0.04] to-black/20 p-2 sm:p-2.5 ${className}`}
    >
      <p className="mb-1.5 text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#7ee8d3]/85 sm:text-[9px]">
        Exit & automation
      </p>
      {children}
      {footerBlock}
    </div>
  );
}
