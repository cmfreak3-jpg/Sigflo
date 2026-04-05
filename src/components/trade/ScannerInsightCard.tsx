import { useMemo, useState } from 'react';
import { StatusChip } from '@/components/trade/StatusChip';
import { requestAssistantSuggestion } from '@/services/ai/client';
import { tradeTimingChipProps } from '@/lib/tradeTimingChip';
import type { MarketRowStatus } from '@/types/markets';
import type { CryptoSignal } from '@/types/signal';

function setupTone(score: number): string {
  if (score >= 80) return 'Strong';
  if (score >= 65) return 'Developing';
  if (score >= 50) return 'Mixed';
  return 'Weak';
}

function trendCue(signal: CryptoSignal): string {
  const t = signal.scoreBreakdown.trendAlignment;
  if (t >= 17) return 'Trend holding';
  if (t <= 10) return 'Weak trend';
  return 'Trend mixed';
}

function momentumCue(signal: CryptoSignal): string {
  const m = signal.scoreBreakdown.momentumQuality;
  if (m >= 14) return 'Momentum building';
  if (m <= 8) return 'Momentum fading';
  return 'Momentum steady';
}

function readFor(signal: CryptoSignal, status: MarketRowStatus): string {
  const trendAligned = signal.scoreBreakdown.trendAlignment >= 14;
  if (signal.setupType === 'breakout') {
    if (status === 'triggered') return 'Breakout active';
    if (status === 'developing') return 'Breakout forming';
    if (status === 'overextended') return 'Breakout stretched';
    return 'Breakout coiling';
  }
  if (signal.setupType === 'pullback') {
    if (status === 'triggered') return trendAligned ? 'Pullback holding' : 'Trend uncertain';
    if (status === 'developing') return 'Pullback forming';
    if (status === 'overextended') return 'Bounce stretched';
    return 'Weak bounce';
  }
  if (status === 'overextended') return 'Exhaustion risk';
  return signal.side === 'long' ? 'Rejection forming' : 'Relief forming';
}

function watchFor(signal: CryptoSignal): string {
  if (signal.setupType === 'breakout') return 'breakout or rejection';
  if (signal.setupType === 'pullback') return signal.side === 'long' ? 'hold or fade' : 'reclaim or fail';
  return 'continuation or rollover';
}

function actionFor(signal: CryptoSignal, status: MarketRowStatus, tradeScore: number): string {
  if (signal.riskTag === 'High Risk' || tradeScore < 45) return 'High risk — reduce size';
  if (status === 'overextended') return 'Avoid chasing';
  if (status === 'developing') return 'Wait for confirmation';
  if (status === 'triggered' && tradeScore >= 65) return 'Entry active';
  if (signal.setupType === 'breakout') {
    return signal.side === 'long' ? 'Confirmation above level needed' : 'Confirmation below level needed';
  }
  return 'Keep size controlled';
}

/** Up to 4 short lines: prefer sentences from AI copy, then structural cues. */
function previewBullets(signal: CryptoSignal, status: MarketRowStatus): string[] {
  const raw = signal.aiExplanation.trim();
  const sentences = raw
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 8);
  const out: string[] = [];
  for (const s of sentences) {
    if (out.length >= 4) break;
    if (!out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s);
  }
  if (out.length < 2) out.push(readFor(signal, status));
  if (out.length < 3) out.push(trendCue(signal));
  if (out.length < 4) out.push(`Watch: ${watchFor(signal)}`);
  if (out.length < 4) out.push(momentumCue(signal));
  return out.slice(0, 4);
}

export function ScannerInsightCard({
  signal,
  status,
  tradeScore,
}: {
  signal: CryptoSignal;
  status: MarketRowStatus;
  tradeScore: number;
}) {
  const [aiResult, setAiResult] = useState<{ headline: string; body: string; source: 'local' | 'remote' } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [readOpen, setReadOpen] = useState(false);
  const bullets = useMemo(() => previewBullets(signal, status), [signal, status]);
  const timingChip = tradeTimingChipProps(status, tradeScore);
  const action = actionFor(signal, status, tradeScore);
  const sideChipClass =
    signal.side === 'long'
      ? 'border-emerald-400/30 bg-emerald-500/12 text-emerald-300'
      : 'border-rose-400/30 bg-rose-500/12 text-rose-300';

  const runExplain = async () => {
    setAiLoading(true);
    const result = await requestAssistantSuggestion({ action: 'explain', signal, status, tradeScore });
    setAiResult({ headline: result.headline, body: result.body, source: result.source });
    setAiLoading(false);
  };

  const runWatch = async () => {
    setAiLoading(true);
    const result = await requestAssistantSuggestion({ action: 'watch', signal, status, tradeScore });
    setAiResult({ headline: result.headline, body: result.body, source: result.source });
    setAiLoading(false);
  };

  const runEntry = async () => {
    setAiLoading(true);
    const result = await requestAssistantSuggestion({ action: 'entry', signal, status, tradeScore });
    setAiResult({ headline: result.headline, body: result.body, source: result.source });
    setAiLoading(false);
  };

  return (
    <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/[0.08] via-sigflo-surface/95 to-emerald-500/[0.06] px-2.5 py-2.5 shadow-[0_0_30px_-16px_rgba(34,211,238,0.55)] ring-1 ring-cyan-400/10">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${sideChipClass}`}
        >
          {signal.side}
        </span>
        <div className="flex items-center gap-1.5 text-right">
          <span
            className="relative h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300/90 shadow-[0_0_10px_-2px_rgba(34,211,238,0.5)] ring-1 ring-cyan-400/25"
            aria-hidden
          />
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/90">AI Scanner</p>
        </div>
      </div>

      <ul className="mt-2.5 list-none space-y-1.5">
        {bullets.map((line, i) => (
          <li key={`${i}-${line.slice(0, 24)}`} className="flex gap-2 text-[12px] font-medium leading-snug text-white/92">
            <span className="shrink-0 font-bold text-cyan-300/75" aria-hidden>
              •
            </span>
            <span className="min-w-0">{line}</span>
          </li>
        ))}
      </ul>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-black/35 px-2 py-1.5 ring-1 ring-white/[0.04]">
        <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-sigflo-muted">Readiness</span>
        <StatusChip label={timingChip.label} state={timingChip.state} />
      </div>

      <button
        type="button"
        onClick={() => setReadOpen((o) => !o)}
        className="mt-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200/75 transition hover:text-cyan-100"
        aria-expanded={readOpen}
      >
        {readOpen ? 'Hide full explanation' : 'Full explanation'}
      </button>
      {readOpen ? (
        <p className="mt-1.5 rounded-lg border border-white/[0.06] bg-black/25 p-2 text-[11px] leading-relaxed text-sigflo-muted">
          {signal.aiExplanation}
        </p>
      ) : null}

      <div className="mt-2.5 text-[11px] text-sigflo-muted">
        Setup: <span className="font-semibold text-white">{signal.setupScore}</span>
        <span className="text-sigflo-muted"> · </span>
        <span className="text-sigflo-text/85">{setupTone(signal.setupScore)}</span>
      </div>

      <p className="mt-1.5 text-[11px] font-semibold leading-snug text-emerald-300/95">{action}</p>

      <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/20 p-2">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={runExplain}
            disabled={aiLoading}
            className="rounded-md border border-white/[0.06] bg-white/[0.04] px-2 py-1 text-[10px] font-medium leading-tight text-sigflo-text/95 transition hover:bg-white/[0.08]"
          >
            Explain setup
          </button>
          <button
            type="button"
            onClick={runWatch}
            disabled={aiLoading}
            className="rounded-md border border-white/[0.06] bg-white/[0.04] px-2 py-1 text-[10px] font-medium leading-tight text-sigflo-text/95 transition hover:bg-white/[0.08]"
          >
            What to watch
          </button>
          <button
            type="button"
            onClick={runEntry}
            disabled={aiLoading}
            className="rounded-md border border-white/[0.06] bg-white/[0.04] px-2 py-1 text-[10px] font-medium leading-tight text-sigflo-text/95 transition hover:bg-white/[0.08]"
          >
            Improve entry
          </button>
        </div>
        {aiLoading ? (
          <p className="mt-2 text-[10px] text-sigflo-muted">Assistant is thinking...</p>
        ) : aiResult ? (
          <div className="mt-2 rounded-md border border-white/[0.05] bg-black/30 p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold leading-snug text-white/95">{aiResult.headline}</p>
              <span
                className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                  aiResult.source === 'remote'
                    ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200'
                    : 'border-amber-400/35 bg-amber-500/15 text-amber-200'
                }`}
              >
                {aiResult.source === 'remote' ? 'AI live' : 'Fallback'}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-line text-[10px] leading-relaxed text-sigflo-muted">{aiResult.body}</p>
          </div>
        ) : (
          <p className="mt-2 text-[10px] text-sigflo-muted">Assistant is ready for this setup.</p>
        )}
      </div>
    </div>
  );
}
