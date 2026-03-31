import type { RiskLevel } from '@/types/trade';

const markerColor: Record<RiskLevel, string> = {
  Low: 'bg-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.8)]',
  Medium: 'bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.8)]',
  High: 'bg-rose-300 shadow-[0_0_10px_rgba(251,113,133,0.8)]',
};

export function RiskMeter({ pct, level }: { pct: number; level: RiskLevel }) {
  return (
    <div className="space-y-1">
      <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="absolute inset-y-0 left-0 w-1/3 bg-emerald-500/60" />
        <div className="absolute inset-y-0 left-1/3 w-1/3 bg-amber-500/60" />
        <div className="absolute inset-y-0 right-0 w-1/3 bg-rose-500/60" />
        <div
          className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-white/80 ${markerColor[level]}`}
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      </div>
      <div className="flex justify-between text-[9px] uppercase tracking-wider text-sigflo-muted">
        <span>Low</span>
        <span>Med</span>
        <span>High</span>
      </div>
    </div>
  );
}
