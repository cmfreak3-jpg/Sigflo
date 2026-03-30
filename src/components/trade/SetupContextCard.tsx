import { Card } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Pill';
import { displaySetupScoreCaption } from '@/lib/setupScore';
import { resolveWatchCue } from '@/lib/watchCue';
import type { CryptoSignal } from '@/types/signal';

function scoreTone(score: number): string {
  if (score >= 85) return 'border-emerald-400/35 bg-emerald-500/15 text-emerald-100';
  if (score >= 70) return 'border-cyan-400/35 bg-cyan-500/14 text-cyan-100';
  if (score >= 55) return 'border-amber-400/35 bg-amber-500/12 text-amber-100';
  if (score >= 40) return 'border-rose-400/30 bg-rose-500/12 text-rose-100';
  return 'border-rose-500/40 bg-rose-600/14 text-rose-100';
}

export function SetupContextCard({ signal }: { signal: CryptoSignal }) {
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Setup context</h2>
          <p className="mt-0.5 text-[11px] text-sigflo-muted">
            Setup Score rates market quality. Trade Score rates your execution risk.
          </p>
        </div>
        <span className={`rounded-lg border px-2.5 py-1 text-sm font-semibold tabular-nums ${scoreTone(signal.setupScore)}`}>
          {signal.setupScore}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={signal.setupType === 'overextended' ? 'red' : 'cyan'}>{displaySetupScoreCaption(signal)}</Pill>
        {signal.setupTags.map((tag) => (
          <Pill key={`${signal.id}-setup-${tag}`} tone={tag === 'Overextended' ? 'red' : 'neutral'}>
            {tag}
          </Pill>
        ))}
      </div>

      <p className="text-xs leading-snug">
        <span className="font-semibold uppercase tracking-[0.12em] text-cyan-400/80">What to watch </span>
        <span className="font-medium text-white/90">{resolveWatchCue(signal)}</span>
      </p>

      <p className="text-sm leading-relaxed text-sigflo-muted">{signal.aiExplanation}</p>

      <div className="grid grid-cols-5 gap-1 text-[10px]">
        <BreakdownChip label="Trend" value={signal.scoreBreakdown.trendAlignment} max={25} />
        <BreakdownChip label="Mom." value={signal.scoreBreakdown.momentumQuality} max={20} />
        <BreakdownChip label="Struct." value={signal.scoreBreakdown.structureQuality} max={25} />
        <BreakdownChip label="Vol." value={signal.scoreBreakdown.volumeConfirmation} max={15} />
        <BreakdownChip label="Risk" value={signal.scoreBreakdown.riskConditions} max={15} />
      </div>
    </Card>
  );
}

function BreakdownChip({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-1 text-center">
      <p className="text-[9px] uppercase tracking-wide text-sigflo-muted">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-sigflo-text">
        {value}/{max}
      </p>
    </div>
  );
}
