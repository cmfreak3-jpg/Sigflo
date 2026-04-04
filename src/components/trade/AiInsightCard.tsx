import type { AiInsight } from '@/types/trade';

export function AiInsightCard({
  insight,
}: {
  insight: AiInsight;
  activeHeadline?: string | null;
  activeStructureNote?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-2.5">
      <div className="flex items-center gap-3 text-xs text-sigflo-muted">
        <span>Trend: <span className="font-semibold text-white">{insight.trend}</span></span>
        <span>Mom: <span className="font-semibold text-white">{insight.momentum}</span></span>
        <span>Risk: <span className={`font-semibold ${insight.risk === 'High' ? 'text-rose-400' : insight.risk === 'Medium' ? 'text-amber-300' : 'text-emerald-400'}`}>{insight.risk}</span></span>
      </div>
    </div>
  );
}
