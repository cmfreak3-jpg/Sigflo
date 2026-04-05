import type { ReactNode } from 'react';

/**
 * Minimal live / triggered marker: small dot with optional restrained pulse + glow.
 * Pair with `uiSignalStateClasses().dot` for scanner-driven colors.
 */
export function LiveIndicator({
  pulse = false,
  dotClassName,
  size = 'md',
  label,
  className = '',
  pulseDurationSec = 2.4,
}: {
  pulse?: boolean;
  dotClassName: string;
  size?: 'sm' | 'md';
  label?: ReactNode;
  className?: string;
  /** Animation duration for the pulse layer (seconds). */
  pulseDurationSec?: number;
}) {
  const dim = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2';
  const glowInset = size === 'md' ? 'inset-[-5px]' : 'inset-[-4px]';
  const blur = size === 'md' ? 'blur-[3px]' : 'blur-[2px]';
  const glowBg = size === 'md' ? 'bg-[#00ffc8]/18' : 'bg-[#00ffc8]/22';

  const dot = (
    <span
      className={`relative inline-flex ${dim} shrink-0 rounded-full ${dotClassName}`}
      aria-hidden
    />
  );

  if (!pulse) {
    if (label == null) return dot;
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        {dot}
        {label}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className={`relative flex ${dim} shrink-0`}>
        <span
          className={`absolute ${glowInset} rounded-full ${glowBg} ${blur} sigflo-live-pulse`}
          aria-hidden
        />
        <span
          className={`absolute inline-flex h-full w-full animate-pulse-dot rounded-full ${dotClassName}`}
          style={{ animationDuration: `${pulseDurationSec}s` }}
          aria-hidden
        />
        <span className={`relative inline-flex h-full w-full rounded-full ${dotClassName}`} aria-hidden />
      </span>
      {label}
    </span>
  );
}
