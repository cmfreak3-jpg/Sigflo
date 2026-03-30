import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { formatQuoteNumber } from '@/lib/formatQuote';
import { formatInPlayTimingCue, inPlayMicroHeadline } from '@/lib/marketScannerRows';
import { displaySetupScoreCaption } from '@/lib/setupScore';
import { resolveWatchCue, resolveWatchNextCue } from '@/lib/watchCue';
import type { MarketScannerRow, MarketRowStatus, MarketScoreTrend } from '@/types/markets';

function TriggerBoltIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />
    </svg>
  );
}

function statusLabel(status: MarketRowStatus): string {
  switch (status) {
    case 'triggered':
      return 'Live setup';
    case 'developing':
      return 'Developing';
    case 'overextended':
      return 'Overextended';
    default:
      return 'Idle';
  }
}

function ScoreTrendMark({ trend }: { trend?: MarketScoreTrend }) {
  if (trend === 'up')
    return (
      <span className="text-emerald-400" title="Setup improving">
        ↑
      </span>
    );
  if (trend === 'down')
    return (
      <span className="text-rose-400" title="Setup weakening">
        ↓
      </span>
    );
  return null;
}

function statusClass(status: MarketRowStatus): string {
  switch (status) {
    case 'triggered':
      return 'border-emerald-400/45 bg-emerald-500/15 text-emerald-100';
    case 'developing':
      return 'border-cyan-400/30 bg-cyan-500/12 text-cyan-100';
    case 'overextended':
      return 'border-amber-400/40 bg-amber-500/15 text-amber-100';
    default:
      return 'border-white/10 bg-white/[0.04] text-sigflo-muted';
  }
}

export function MarketCard({
  row,
  onOpen,
}: {
  row: MarketScannerRow;
  onOpen: () => void;
}) {
  const strong = row.setupScore >= 70;
  const elite = row.setupScore >= 85;
  const isTriggered = row.status === 'triggered';
  const [timingNow, setTimingNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isTriggered) return;
    const id = window.setInterval(() => setTimingNow(Date.now()), 45000);
    return () => clearInterval(id);
  }, [isTriggered]);

  const timingCue = isTriggered
    ? formatInPlayTimingCue(row.triggeredAtMs, row.signal.postedAgo, timingNow, true)
    : '';

  const cardAccent = isTriggered
    ? 'ring-0 border-emerald-300/50 bg-gradient-to-b from-emerald-500/[0.08] to-transparent animate-sigflo-trigger hover:border-emerald-200/30'
    : elite
      ? 'ring-1 ring-cyan-300/35 shadow-[0_0_22px_rgba(34,211,238,0.18)]'
      : strong
        ? 'ring-1 ring-cyan-400/25 shadow-[0_0_16px_rgba(34,211,238,0.12)]'
        : 'ring-1 ring-white/10';

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left"
      aria-label={`Open trade for ${row.symbol}${isTriggered ? `, live setup, ${timingCue}, active now` : ''}`}
    >
      <Card
        className={`overflow-hidden border border-white/[0.07] p-4 transition hover:border-white/15 hover:bg-sigflo-elevated/90 ${cardAccent}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {isTriggered ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <TriggerBoltIcon className="shrink-0 text-emerald-300/95 drop-shadow-[0_0_12px_rgba(52,211,153,0.35)]" />
                  <h3 className="text-base font-semibold tracking-tight text-white">{row.symbol}</h3>
                  {row.setupTag && !(row.status === 'overextended' && row.setupTag === 'Overextended') ? (
                    <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-sigflo-muted">
                      {row.setupTag}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-emerald-100/95">
                  <span className="mr-0.5 inline-block align-middle text-[11px] leading-none" aria-hidden>
                    🟢
                  </span>
                  <span className="font-semibold">Live setup</span>
                  <span className="text-emerald-200/45"> · </span>
                  <span className="font-medium tabular-nums text-emerald-50/95">{timingCue}</span>
                  <span className="text-emerald-200/45"> · </span>
                  <span className="font-medium text-emerald-200/80">Active now</span>
                </p>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold tracking-tight text-white">{row.symbol}</h3>
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${statusClass(row.status)}`}>
                    {statusLabel(row.status)}
                  </span>
                  {row.setupTag && !(row.status === 'overextended' && row.setupTag === 'Overextended') ? (
                    <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-sigflo-muted">
                      {row.setupTag}
                    </span>
                  ) : null}
                </div>
              </>
            )}
            <div className={`flex flex-wrap items-baseline gap-2 ${isTriggered ? 'mt-2' : 'mt-1'}`}>
              <span className="text-sm font-semibold text-white">{formatQuoteNumber(row.lastPrice)}</span>
              {Number.isFinite(row.change24hPct) ? (
                <span className={row.change24hPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                  {row.change24hPct >= 0 ? '+' : ''}
                  {row.change24hPct.toFixed(2)}%
                </span>
              ) : (
                <span className="text-sigflo-muted">—</span>
              )}
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-xs">
              <span className="font-bold tabular-nums text-white">{row.setupScore}</span>
              <span className="font-medium text-sigflo-muted">
                {displaySetupScoreCaption(row.signal, { rowOverextended: row.status === 'overextended' })}
              </span>
              <ScoreTrendMark trend={row.scoreTrend} />
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-bold tabular-nums leading-none text-white">{row.setupScore}</p>
          </div>
        </div>
        {isTriggered ? (
          <p className="mt-3 text-[11px] font-medium leading-snug tracking-[0.03em] text-teal-200/88">
            {inPlayMicroHeadline(row.signal.setupType)}
          </p>
        ) : null}
        <p className={`line-clamp-2 text-xs leading-relaxed text-sigflo-muted ${isTriggered ? 'mt-2' : 'mt-3'}`}>
          {row.insight}
        </p>
        {isTriggered ? (
          <p className="mt-2.5 text-xs leading-snug">
            <span className="font-semibold text-cyan-200/75">Watch: </span>
            <span className="font-medium text-white/88">{resolveWatchNextCue(row.signal)}</span>
          </p>
        ) : null}
        {!isTriggered ? (
          <p className="mt-3 border-t border-white/[0.06] pt-2.5 text-xs leading-snug">
            <span className="font-semibold text-cyan-200/75">Watch: </span>
            <span className="font-medium text-white/88">{resolveWatchCue(row.signal)}</span>
          </p>
        ) : (
          <div className="mt-3 border-t border-white/[0.06] pt-2.5">
            <span className="text-xs font-medium tracking-wide text-cyan-300/80">Open trade →</span>
          </div>
        )}
      </Card>
    </button>
  );
}
