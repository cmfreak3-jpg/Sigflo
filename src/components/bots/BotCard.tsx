import { useMemo } from 'react';
import {
  botCardStatusMeta,
  formatBotPrice,
  setupTypeFromSignal,
  type BotAgent,
  type BotCardStatus,
  type BotMarketContext,
} from '@/lib/bots';
import { deriveMarketStatus } from '@/lib/marketScannerRows';
import { uiSignalStateFromMarketStatus, uiSignalStateLabel } from '@/lib/signalState';
import type { CryptoSignal } from '@/types/signal';

export type BotCardProps = {
  bot: BotAgent;
  signal: CryptoSignal | null;
  cardStatus: BotCardStatus;
  /** Strong amber focal glow — at most one card per screen. */
  isSpotlight?: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onOpenBot: () => void;
  onPause: () => void;
  onSettings: () => void;
  onViewChart?: () => void;
  onAdjustRisk?: () => void;
};

function initialsFromName(name: string): string {
  const p = name.trim().split(/\s+/);
  if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function commentaryLines(note: string, short?: string): string {
  const raw = (short ?? note).trim();
  if (!raw) return '';
  const sentences = raw.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 2);
  const joined = sentences.join(' ');
  return joined.length > 200 ? `${joined.slice(0, 197)}…` : joined;
}

function levelsValid(e?: number, s?: number, t?: number): boolean {
  return (
    e != null &&
    s != null &&
    t != null &&
    Number.isFinite(e) &&
    Number.isFinite(s) &&
    Number.isFinite(t) &&
    e > 0 &&
    s > 0 &&
    t > 0
  );
}

function BotAvatar({ name }: { name: string }) {
  const ch = initialsFromName(name);
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgba(0,200,120,0.22)] bg-gradient-to-br from-[#171A20] to-[#0F1115] text-[12px] font-bold tracking-tight text-[#00E08A] shadow-[0_0_20px_-8px_rgba(0,200,120,0.45)]"
      aria-hidden
    >
      {ch}
    </div>
  );
}

function ContextTagPills({ ctx }: { ctx: BotMarketContext }) {
  const items: { k: string; v: string }[] = [
    { k: 'Volatility', v: ctx.volatility },
    { k: 'Structure', v: ctx.structure },
    { k: 'Volume', v: ctx.volume },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(({ k, v }) => (
        <span
          key={k}
          className="inline-flex items-center rounded-full border border-white/[0.08] bg-black/35 px-2 py-0.5 text-[9px] font-medium text-sigflo-muted"
        >
          <span className="text-white/35">{k}</span>
          <span className="mx-1 text-white/15">·</span>
          <span className="text-cyan-100/85">{v}</span>
        </span>
      ))}
    </div>
  );
}

/** Abstract SL / entry / TP ladder — not real chart data. */
function MiniPlanVisual({
  entry,
  stop,
  target,
  active,
}: {
  entry?: number;
  stop?: number;
  target?: number;
  active: boolean;
}) {
  if (!active || !levelsValid(entry, stop, target)) {
    return (
      <div className="flex h-[5.5rem] items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-[#0F1115]/90 text-center">
        <p className="px-3 text-[10px] leading-snug text-sigflo-muted">Plan preview appears when a setup is validated.</p>
      </div>
    );
  }

  const lo = Math.min(stop!, entry!, target!);
  const hi = Math.max(stop!, entry!, target!);
  const span = Math.max(hi - lo, 1e-9);
  const yPct = (p: number) => `${((hi - p) / span) * 100}%`;

  return (
    <div className="relative h-[5.5rem] overflow-hidden rounded-xl border border-white/[0.08] bg-[#0F1115] shadow-[inset_0_0_24px_rgba(0,0,0,0.45)]">
      <div className="absolute inset-0 bg-gradient-to-b from-[#00C878]/[0.04] to-transparent pointer-events-none" />
      {/* grid lines */}
      <div className="absolute inset-x-2 top-2 bottom-2 flex flex-col justify-between opacity-25">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-px w-full bg-white/20" />
        ))}
      </div>
      {/* Stop */}
      <div className="absolute left-2 right-2" style={{ top: yPct(stop!) }}>
        <div className="flex items-center gap-2">
          <span className="w-7 shrink-0 text-[8px] font-bold uppercase tracking-wider text-rose-300/90">SL</span>
          <div className="h-px flex-1 bg-rose-400/70 shadow-[0_0_8px_rgba(248,113,113,0.35)]" />
          <span className="shrink-0 font-mono text-[9px] text-rose-200/90">{formatBotPrice(stop)}</span>
        </div>
      </div>
      {/* Entry zone */}
      <div className="absolute left-2 right-2" style={{ top: yPct(entry!) }}>
        <div className="flex items-center gap-2">
          <span className="w-7 shrink-0 text-[8px] font-bold uppercase tracking-wider text-[#00E08A]">Entry</span>
          <div className="h-0.5 flex-1 bg-[#00C878]/80 shadow-[0_0_10px_rgba(0,200,120,0.4)]" />
          <span className="shrink-0 font-mono text-[9px] text-cyan-100">{formatBotPrice(entry)}</span>
        </div>
      </div>
      {/* Target */}
      <div className="absolute left-2 right-2" style={{ top: yPct(target!) }}>
        <div className="flex items-center gap-2">
          <span className="w-7 shrink-0 text-[8px] font-bold uppercase tracking-wider text-emerald-300/90">TP</span>
          <div className="h-px flex-1 bg-emerald-400/70 shadow-[0_0_8px_rgba(52,211,153,0.3)]" />
          <span className="shrink-0 font-mono text-[9px] text-emerald-200/90">{formatBotPrice(target)}</span>
        </div>
      </div>
    </div>
  );
}

export function BotCard({
  bot,
  signal,
  cardStatus,
  isSpotlight = false,
  expanded,
  onToggleExpand,
  onOpenBot,
  onPause,
  onSettings,
  onViewChart,
  onAdjustRisk,
}: BotCardProps) {
  const meta = botCardStatusMeta(cardStatus);
  const paused = cardStatus === 'paused';
  const highAlert = cardStatus === 'in_trade';
  const forming = cardStatus === 'setup_forming';
  const showSpotlight = isSpotlight && !paused && !highAlert;

  const merged = useMemo(() => {
    const d = bot.detail;
    if (!signal) {
      return {
        setupState: d.setupStateLabel,
        bias: d.bias,
        confidence: d.confidencePct,
        entry: d.entry,
        stop: d.stop,
        target: d.target,
        commentary: commentaryLines(d.aiNote, d.commentaryShort),
        setupType: d.setupType,
        context: d.marketContext,
      };
    }
    const liveNote =
      signal.aiExplanation.length > 0
        ? signal.aiExplanation.length > 280
          ? `${signal.aiExplanation.slice(0, 277)}…`
          : signal.aiExplanation
        : d.aiNote;
    return {
      setupState: signal.setupScoreLabel,
      bias: signal.biasLabel,
      confidence: signal.setupScore,
      entry: signal.plannedEntry ?? d.entry,
      stop: signal.plannedStop ?? d.stop,
      target: signal.plannedTarget ?? d.target,
      commentary: commentaryLines(liveNote, d.commentaryShort),
      setupType: setupTypeFromSignal(signal.setupType),
      context: d.marketContext,
    };
  }, [bot.detail, signal]);

  const hasValidSetup =
    !bot.expandedSetupPending && levelsValid(merged.entry, merged.stop, merged.target);

  const lastResult = bot.stats.lastResultPct;
  const lastFmt = `${lastResult >= 0 ? '+' : ''}${lastResult.toFixed(1)}%`;

  const shellClass = [
    'rounded-2xl border text-left',
    'transition-[box-shadow,opacity,border-color,background-color] duration-[280ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
    expanded ? 'sigflo-bot-card--expanded z-[1]' : '',
    paused
      ? 'border-white/[0.06] bg-[#171A20]/80 opacity-[0.72]'
      : highAlert
        ? 'border-[rgba(0,200,120,0.42)] bg-[#171A20] shadow-[0_0_32px_-10px_rgba(0,200,120,0.5),inset_0_1px_0_0_rgba(255,255,255,0.05)] ring-1 ring-[rgba(0,200,120,0.22)]'
        : showSpotlight
          ? 'border-amber-400/55 bg-gradient-to-b from-amber-500/[0.07] to-[#171A20] ring-2 ring-amber-400/35 sigflo-bot-card-spotlight'
          : forming
            ? 'border-amber-400/30 bg-[#171A20] shadow-[0_0_30px_-14px_rgba(251,191,36,0.38)] ring-1 ring-amber-400/22 sigflo-bot-forming-pulse'
            : 'border-[rgba(0,200,120,0.14)] bg-[#171A20] shadow-[0_0_28px_-18px_rgba(0,200,120,0.22)] hover:border-[rgba(0,200,120,0.22)]',
  ].join(' ');

  return (
    <article className={shellClass}>
      {/* ——— Header + collapsed body (tap to expand) ——— */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full flex-col gap-0 rounded-t-2xl p-3.5 text-left transition active:scale-[0.992]"
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-3">
          <BotAvatar name={bot.name} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-base font-bold tracking-tight text-white">{bot.name}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sigflo-muted">
                  {bot.strategy}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${meta.textClass}`}>
                  <span className={`h-2 w-2 rounded-full ${meta.dotClass}`} />
                  {meta.label}
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  className={`shrink-0 text-sigflo-muted transition-transform duration-300 ease-out ${expanded ? 'rotate-180' : ''}`}
                  aria-hidden
                >
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            <p className="mt-2.5 border-l-2 border-[rgba(0,200,120,0.4)] pl-2.5 text-[12px] font-medium leading-snug text-[#E8FDF7]/95">
              {bot.intentLine}
            </p>

            <p className="mt-2 text-[11px] text-sigflo-muted">
              <span className="font-semibold text-white/70">Watching</span>{' '}
              <span className="text-cyan-100/80">{bot.watchedPairs.join(', ')}</span>
            </p>

            <p className="mt-1 text-[11px] leading-snug text-white/85">
              <span className="text-sigflo-muted">Activity · </span>
              {signal ? (
                <>
                  {bot.activityLine}
                  <span className="text-sigflo-muted"> · </span>
                  <span className="text-cyan-200/85">{signal.pair}</span>{' '}
                  <span className="text-sigflo-muted">
                    {uiSignalStateLabel(uiSignalStateFromMarketStatus(deriveMarketStatus(signal))).toLowerCase()}
                  </span>
                </>
              ) : (
                <span className="text-sigflo-muted">No valid setup yet — waiting for feed</span>
              )}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/[0.06] pt-2.5 text-[10px] text-sigflo-muted">
              <span>
                <span className="font-semibold text-white/90">{bot.stats.signalsToday}</span> signals today
              </span>
              <span className="text-white/15">·</span>
              <span>
                <span className="font-semibold text-emerald-200/90">{bot.stats.winRatePct}%</span> win rate
              </span>
              <span className="text-white/15">·</span>
              <span>
                Last:{' '}
                <span className={lastResult >= 0 ? 'font-semibold text-emerald-300/90' : 'font-semibold text-rose-300/90'}>
                  {lastFmt}
                </span>
              </span>
            </div>
          </div>
        </div>
      </button>

      {/* ——— Action row ——— */}
      <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-3 py-2.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenBot();
          }}
          className="text-[12px] font-bold uppercase tracking-wide text-[#00E08A] transition hover:text-[#7fffd4] active:scale-[0.98]"
        >
          Open bot
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPause();
            }}
            className="rounded-lg border border-white/[0.1] bg-white/[0.04] p-2 text-sigflo-muted transition hover:border-[rgba(0,200,120,0.28)] hover:text-cyan-100 active:scale-95"
            aria-label={paused ? 'Resume bot' : 'Pause bot'}
            title={paused ? 'Resume' : 'Pause'}
          >
            {paused ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSettings();
            }}
            className="rounded-lg border border-white/[0.1] bg-white/[0.04] p-2 text-sigflo-muted transition hover:border-[rgba(0,200,120,0.28)] hover:text-cyan-100 active:scale-95"
            aria-label="Bot settings"
            title="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>
        </div>
      </div>

      {/* ——— Expanded: thinking layer ——— */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={`space-y-3 border-t border-[rgba(0,200,120,0.14)] bg-[#0F1115] px-3.5 pb-4 pt-3 transition-opacity duration-300 ease-out ${
              expanded ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-[#00C878]/80">Thinking layer</p>

            {/* 1. Current setup */}
            <section className="rounded-xl border border-white/[0.06] bg-[#171A20] p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-sigflo-muted">Current setup</p>
              {!hasValidSetup ? (
                <div className="mt-2.5">
                  <p className="text-[13px] font-semibold text-white/90">No valid setup yet</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-sigflo-muted">
                    Bot is monitoring structure and waiting for confirmation.
                  </p>
                </div>
              ) : (
                <div className="mt-2.5 space-y-3">
                  <p className="text-[11px] font-medium text-white/55">{merged.setupState}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-sigflo-muted">Bias</p>
                      <p className="mt-0.5 text-sm font-bold text-[#00E08A]">{merged.bias}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-sigflo-muted">Setup type</p>
                      <p className="mt-0.5 text-sm font-bold text-white">{merged.setupType}</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-sigflo-muted">Confidence</p>
                      <span className="font-mono text-[11px] text-cyan-200/90">{merged.confidence}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#008f5a] to-[#00C878]"
                        style={{ width: `${Math.min(100, Math.max(0, merged.confidence))}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-sigflo-muted">Plan levels</p>
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className="rounded-lg border border-white/[0.05] bg-black/30 py-2">
                      <p className="text-[8px] uppercase tracking-wider text-sigflo-muted">Entry</p>
                      <p className="mt-0.5 font-mono text-[11px] font-semibold text-white">{formatBotPrice(merged.entry)}</p>
                    </div>
                    <div className="rounded-lg border border-white/[0.05] bg-black/30 py-2">
                      <p className="text-[8px] uppercase tracking-wider text-sigflo-muted">Stop</p>
                      <p className="mt-0.5 font-mono text-[11px] font-semibold text-rose-200/90">{formatBotPrice(merged.stop)}</p>
                    </div>
                    <div className="rounded-lg border border-white/[0.05] bg-black/30 py-2">
                      <p className="text-[8px] uppercase tracking-wider text-sigflo-muted">Target</p>
                      <p className="mt-0.5 font-mono text-[11px] font-semibold text-emerald-200/90">{formatBotPrice(merged.target)}</p>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* 2. Mini visual */}
            <section>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-sigflo-muted">Signal map</p>
              <MiniPlanVisual entry={merged.entry} stop={merged.stop} target={merged.target} active={hasValidSetup} />
            </section>

            {/* 3. Commentary */}
            <section className="rounded-xl border border-[rgba(0,200,120,0.15)] bg-[rgba(0,200,120,0.05)] px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#7ee8d3]/75">Bot commentary</p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-[#E8FDF7]/88">{merged.commentary}</p>
            </section>

            {/* 4. Context tags */}
            <section>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-sigflo-muted">Market context</p>
              <ContextTagPills ctx={merged.context} />
            </section>

            {/* 5. Quick actions */}
            <section className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewChart?.();
                }}
                disabled={!onViewChart}
                className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-semibold text-cyan-100/90 transition enabled:hover:border-[rgba(0,200,120,0.3)] enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                View on chart
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPause();
                }}
                className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-semibold text-sigflo-muted transition hover:border-rose-400/25 hover:text-rose-200/90 active:scale-[0.98]"
              >
                Force pause
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdjustRisk?.();
                }}
                disabled={!onAdjustRisk}
                className="rounded-lg border border-white/[0.08] bg-transparent px-2.5 py-1.5 text-[10px] font-semibold text-sigflo-muted transition enabled:hover:border-white/15 enabled:hover:text-white/80 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Adjust risk
              </button>
            </section>
          </div>
        </div>
      </div>
    </article>
  );
}
