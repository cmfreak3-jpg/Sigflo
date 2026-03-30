import { Card } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Pill';
import type { AiInsight } from '@/types/trade';

export function AiInsightCard({
  insight,
  activeHeadline,
  activeStructureNote,
}: {
  insight: AiInsight;
  /** Lead line when setup is in play (before desk note body). */
  activeHeadline?: string | null;
  /** Micro structural confidence under headline when in play. */
  activeStructureNote?: string | null;
}) {
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">AI insight</h2>
        <span className="text-[11px] text-sigflo-muted">Mock analysis</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Pill tone="cyan">Trend: {insight.trend}</Pill>
        <Pill tone="green">Momentum: {insight.momentum}</Pill>
        <Pill tone={insight.risk === 'High' ? 'red' : insight.risk === 'Medium' ? 'neutral' : 'green'}>
          Risk: {insight.risk}
        </Pill>
      </div>
      <p className="text-sm font-medium text-sigflo-text/95">Desk note</p>
      {activeHeadline ? (
        <p className="text-[11px] font-medium leading-snug tracking-[0.03em] text-teal-200/88">{activeHeadline}</p>
      ) : null}
      {activeStructureNote ? (
        <p className="text-[10px] font-medium tracking-[0.02em] text-sigflo-muted/85">{activeStructureNote}</p>
      ) : null}
      <p className="text-sm leading-relaxed text-sigflo-muted">{insight.summary}</p>
    </Card>
  );
}
