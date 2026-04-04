import type { RiskLevel } from '@/types/trade';

const levelTint: Record<RiskLevel, string> = {
  Low: 'bg-emerald-400/90 shadow-[0_0_6px_rgba(52,211,153,0.45)]',
  Medium: 'bg-amber-400/90 shadow-[0_0_6px_rgba(251,191,36,0.4)]',
  High: 'bg-rose-400/90 shadow-[0_0_6px_rgba(251,113,133,0.45)]',
};

/** Five-segment strip; fill count derived from meter % (mockup-style). */
export function RiskSegmentMeter({ pct, level }: { pct: number; level: RiskLevel }) {
  const filled = Math.min(5, Math.max(1, Math.round((pct / 100) * 5)));
  return (
    <div className="flex gap-0.5 pt-0.5" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 flex-1 rounded-sm ${i < filled ? levelTint[level] : 'bg-white/[0.08]'}`}
        />
      ))}
    </div>
  );
}
