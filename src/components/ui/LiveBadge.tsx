export function LiveBadge({ label = 'IN PLAY', className = '' }: { label?: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-sigflo-accent/25 bg-sigflo-accentDim px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sigflo-accent ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-pulse-dot rounded-full bg-sigflo-accent [animation-duration:1.8s]" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sigflo-accent" />
      </span>
      {label}
    </span>
  );
}
