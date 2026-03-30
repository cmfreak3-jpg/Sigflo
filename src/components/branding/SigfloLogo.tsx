type SigfloLogoProps = {
  size?: number;
  glowing?: boolean;
  className?: string;
};

export function SigfloLogo({ size = 30, glowing = false, className = '' }: SigfloLogoProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-xl ${glowing ? 'shadow-[0_0_24px_rgba(34,211,238,0.28)]' : ''} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <defs>
          <linearGradient id="sigflo-blue" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#67e8f9" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
          <linearGradient id="sigflo-green" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d9f99d" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
        </defs>
        <rect x="1.5" y="1.5" width="61" height="61" rx="16" fill="#0b0e14" stroke="rgba(255,255,255,0.08)" />
        <path
          d="M10 39c6 9 23 13 37 9 8-2 12-7 11-11-2 4-7 6-15 6-12 0-24-4-33-12z"
          fill="url(#sigflo-blue)"
          opacity="0.95"
        />
        <path
          d="M54 25c-6-9-23-13-37-9-8 2-12 7-11 11 2-4 7-6 15-6 12 0 24 4 33 12z"
          fill="url(#sigflo-green)"
          opacity="0.95"
        />
        <ellipse cx="32" cy="32" rx="16" ry="8" fill="none" stroke="#22d3ee" strokeOpacity="0.18" />
      </svg>
    </div>
  );
}
