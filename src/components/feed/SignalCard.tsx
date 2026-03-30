import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Pill';
import { displaySetupScoreCaption } from '@/lib/setupScore';
import { deriveMarketStatus, inPlayMicroHeadline, inPlayStructureConfidence } from '@/lib/marketScannerRows';
import { buildTradeQueryString } from '@/lib/tradeNavigation';
import { resolveWatchCue } from '@/lib/watchCue';
import type { CryptoSignal } from '@/types/signal';

function TriggerBoltIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />
    </svg>
  );
}

export function SignalCard({ signal }: { signal: CryptoSignal }) {
  const navigate = useNavigate();
  const isLong = signal.side === 'long';
  const isElite = signal.setupScore >= 85;
  const isStrong = signal.setupScore >= 70;
  const isInPlay = deriveMarketStatus(signal) === 'triggered';
  const riskTone =
    signal.riskTag === 'Low Risk' ? 'green' : signal.riskTag === 'Medium Risk' ? 'neutral' : 'red';
  const riskClass =
    signal.riskTag === 'High Risk'
      ? 'border-rose-400/55 bg-rose-500/20 text-rose-100 shadow-[0_0_16px_rgba(244,63,94,0.25)]'
      : signal.riskTag === 'Low Risk'
        ? 'border-emerald-400/40 bg-emerald-500/14 text-emerald-100 shadow-[0_0_10px_rgba(52,211,153,0.15)]'
        : 'border-white/20 bg-white/[0.06] text-sigflo-text';
  const cardEmphasisClass = isInPlay
    ? isElite
      ? 'ring-0 border-cyan-200/40 bg-gradient-to-b from-cyan-500/[0.07] to-transparent animate-sigflo-trigger'
      : 'ring-0 border-emerald-300/45 bg-gradient-to-b from-emerald-500/[0.06] to-transparent animate-sigflo-trigger'
    : isElite
      ? 'ring-2 ring-cyan-300/45 shadow-[0_0_32px_rgba(34,211,238,0.28)]'
      : isStrong
        ? 'ring-1 ring-cyan-400/25 shadow-[0_0_20px_rgba(34,211,238,0.16)]'
        : isLong
          ? 'ring-1 ring-emerald-500/15'
          : 'ring-1 ring-rose-500/15';
  const topBarClass = isElite
    ? 'from-emerald-300 via-cyan-300 to-cyan-400'
    : isStrong
      ? 'from-emerald-400/90 via-cyan-300/80 to-cyan-500/70'
      : isLong
        ? 'from-emerald-500/80 via-cyan-400/70 to-cyan-500/40'
        : 'from-rose-500/80 via-cyan-400/40 to-rose-500/30';
  const scoreTone =
    signal.setupScore >= 85
      ? 'text-emerald-100 border-emerald-400/40 bg-emerald-500/14'
      : signal.setupScore >= 70
        ? 'text-cyan-100 border-cyan-400/40 bg-cyan-500/12'
        : signal.setupScore >= 55
          ? 'text-amber-100 border-amber-400/35 bg-amber-500/12'
          : signal.setupScore >= 40
            ? 'text-rose-100 border-rose-400/35 bg-rose-500/12'
            : 'text-rose-100 border-rose-500/45 bg-rose-600/14';

  const openTrade = () => {
    navigate(`/trade?${buildTradeQueryString(signal, { marketStatus: deriveMarketStatus(signal) })}`);
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={openTrade}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openTrade();
        }
      }}
      className="cursor-pointer"
      aria-label={`Open trade for ${signal.pair}`}
    >
      <Card
        className={`relative overflow-hidden border border-white/[0.06] p-0 shadow-card ring-0 ${cardEmphasisClass} transition hover:border-white/15 hover:bg-sigflo-elevated/90`}
      >
        <div
          className={`h-1 w-full bg-gradient-to-r ${topBarClass}`}
          aria-hidden
        />
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {isInPlay ? (
                  <TriggerBoltIcon className="shrink-0 text-emerald-300/95 drop-shadow-[0_0_12px_rgba(52,211,153,0.35)]" />
                ) : null}
                <h2 className="text-lg font-semibold tracking-tight text-white">{signal.pair}</h2>
                <Pill tone={isLong ? 'green' : 'red'}>{signal.biasLabel}</Pill>
                {signal.setupScore >= 70 && (
                  <Pill
                    tone="cyan"
                    className={
                      signal.setupScore >= 85
                        ? 'border-cyan-300/60 bg-cyan-300/20 text-cyan-100 shadow-[0_0_16px_rgba(103,232,249,0.35)]'
                        : 'border-cyan-400/45 bg-cyan-400/14 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.25)]'
                    }
                  >
                    {signal.setupScore >= 85 ? 'Top setup' : 'Strong setup'}
                  </Pill>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sigflo-muted">
                <span className="tabular-nums">{signal.postedAgo}</span>
                <span className="hidden h-3 w-px bg-white/15 sm:inline" aria-hidden />
                <span>{signal.exchange}</span>
              </div>
            </div>
            <Pill tone={riskTone} className={riskClass}>
              {signal.riskTag}
            </Pill>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-sigflo-muted">Setup Score</p>
              <span className={`rounded-md border px-2 py-0.5 text-sm font-semibold tabular-nums ${scoreTone}`}>
                {signal.setupScore}
              </span>
            </div>
            <p className="mt-1 text-xs font-medium text-sigflo-text/90">{displaySetupScoreCaption(signal)}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06] p-px ring-1 ring-white/[0.05]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500/80 via-cyan-400/90 to-cyan-500/90 transition-[width] duration-500"
                style={{ width: `${signal.setupScore}%` }}
              />
            </div>
          </div>

          {isInPlay ? (
            <p className="text-[11px] font-medium leading-snug tracking-[0.03em] text-teal-200/88">
              {inPlayMicroHeadline(signal.setupType)}
            </p>
          ) : null}
          {isInPlay ? (
            <p className="text-[10px] font-medium tracking-[0.02em] text-sigflo-muted/85">
              {inPlayStructureConfidence(signal)}
            </p>
          ) : null}
          <p className="text-sm leading-relaxed text-sigflo-muted/95">"{signal.aiExplanation}"</p>
          <p className="text-xs leading-snug">
            <span className="font-semibold uppercase tracking-[0.12em] text-cyan-400/80">What to watch </span>
            <span className="font-medium text-white/90">{resolveWatchCue(signal)}</span>
          </p>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-200/90">Why this matters</p>
            <p className="mt-1 text-xs leading-relaxed text-sigflo-text/90">{signal.whyThisMatters}</p>
          </div>
          <div className="grid grid-cols-5 gap-1 text-[10px]">
            <ScoreChip label="Trend" value={signal.scoreBreakdown.trendAlignment} max={25} />
            <ScoreChip label="Mom." value={signal.scoreBreakdown.momentumQuality} max={20} />
            <ScoreChip label="Struct." value={signal.scoreBreakdown.structureQuality} max={25} />
            <ScoreChip label="Vol." value={signal.scoreBreakdown.volumeConfirmation} max={15} />
            <ScoreChip label="Risk" value={signal.scoreBreakdown.riskConditions} max={15} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.05] pt-3">
            <div className="flex flex-wrap gap-2">
              {signal.setupTags.map((tag) => (
                <Pill key={`${signal.id}-${tag}`} tone={tag === 'Overextended' ? 'red' : 'cyan'}>
                  {tag}
                </Pill>
              ))}
              {signal.riskTag === 'High Risk' && <Pill tone="red">High Risk</Pill>}
            </div>
            <span className="rounded-lg border border-cyan-400/35 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-100">
              Open Trade →
            </span>
          </div>
        </div>
      </Card>
    </article>
  );
}

function ScoreChip({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-1 text-center">
      <p className="text-[9px] uppercase tracking-wide text-sigflo-muted">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-sigflo-text">
        {value}/{max}
      </p>
    </div>
  );
}
