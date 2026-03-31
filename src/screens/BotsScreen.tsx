import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBotStatuses } from '@/hooks/useBotStatuses';
import { useSignalEngine } from '@/hooks/useSignalEngine';
import { baseBots, shortActionLabel, statusTone } from '@/lib/bots';
import { deriveMarketStatus } from '@/lib/marketScannerRows';
import { uiSignalStateClasses, uiSignalStateFromMarketStatus, uiSignalStateLabel } from '@/lib/signalState';
import type { CryptoSignal } from '@/types/signal';

export default function BotsScreen() {
  const navigate = useNavigate();
  const { signals } = useSignalEngine();
  const [tick, setTick] = useState(0);
  const { statusMap, togglePause } = useBotStatuses();

  useEffect(() => {
    const id = window.setInterval(() => setTick((v) => v + 1), 1800);
    return () => window.clearInterval(id);
  }, []);

  const signalById = useMemo(() => {
    const map = new Map<string, CryptoSignal>();
    for (const s of signals) map.set(s.id, s);
    return map;
  }, [signals]);

  const botsWithSignal = useMemo(
    () =>
      baseBots.map((b) => ({
        ...b,
        status: statusMap[b.id] ?? b.status,
        signal: signalById.get(b.signalId) ?? signals[0],
      })),
    [statusMap, signalById, signals],
  );

  const activeCount = botsWithSignal.filter((b) => b.status === 'active').length;
  const watchingCount = new Set(botsWithSignal.flatMap((b) => b.watchedPairs)).size;
  const allRunning = activeCount > 0 && botsWithSignal.every((b) => b.status !== 'paused');

  const recentActivity = useMemo(() => {
    if (signals.length === 0) return [];
    const ordered = [...signals].sort((a, b) => b.setupScore - a.setupScore);
    return [0, 1, 2].map((offset) => ordered[(tick + offset) % ordered.length]).filter(Boolean);
  }, [signals, tick]);

  const openBot = (botId: string) => {
    navigate(`/bots/${botId}`);
  };

  return (
    <div className="min-h-[100dvh] bg-sigflo-bg pb-6 pt-4">
      <div className="mx-auto w-full max-w-lg space-y-3 px-4">
        <header className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-sigflo-muted">Bots</p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-pulse-dot rounded-full bg-sigflo-accent [animation-duration:2.6s]" />
              <span className="relative inline-flex h-full w-full rounded-full bg-sigflo-accent" />
            </span>
            {activeCount} active
          </p>
          <p className="mt-0.5 text-sm text-sigflo-muted">Watching {watchingCount} markets</p>
          {allRunning ? <p className="mt-1 text-xs text-cyan-200">All systems running</p> : null}
        </header>

        <section className="space-y-2">
          {botsWithSignal.map((bot) => {
            const signal = bot.signal;
            if (!signal) return null;
            const marketStatus = deriveMarketStatus(signal);
            const uiState = uiSignalStateFromMarketStatus(marketStatus);
            const stateStyle = uiSignalStateClasses(uiState);
            const tone = statusTone(bot.status);
            const paused = bot.status === 'paused';

            return (
              <div
                key={bot.id}
                onClick={() => openBot(bot.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openBot(bot.id);
                  }
                }}
                role="button"
                tabIndex={0}
                className={`group w-full rounded-2xl border bg-sigflo-surface p-3 text-left transition-all hover:-translate-y-[1px] active:scale-[0.985] ${
                  paused
                    ? 'border-white/[0.08] opacity-75'
                    : `${stateStyle.card} ${bot.status === 'active' ? 'shadow-[0_0_18px_-12px_rgba(0,255,200,0.6)]' : ''}`
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-bold text-white">{bot.name}</p>
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-sigflo-muted">{bot.strategy}</p>
                  </div>
                  <p className={`inline-flex items-center gap-1 text-[11px] font-semibold ${tone.className}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${paused ? 'bg-slate-500' : stateStyle.dot}`} />
                    {tone.label}
                  </p>
                </div>

                <p className="mt-2 text-xs text-sigflo-muted">Watching: {bot.watchedPairs.join(', ')}</p>
                <p className="mt-0.5 text-xs text-sigflo-muted">Last action: {shortActionLabel(signal)}</p>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-cyan-200 transition-transform group-hover:translate-x-0.5">Open →</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePause(bot.id);
                    }}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition ${
                      paused
                        ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100 hover:border-cyan-300/50'
                        : 'border-white/15 bg-white/[0.03] text-sigflo-text hover:border-white/25'
                    }`}
                  >
                    {paused ? 'Resume' : 'Pause'}
                  </button>
                </div>
              </div>
            );
          })}
        </section>

        <section className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sigflo-muted">Recent Activity</p>
          <div className="mt-2 space-y-1.5">
            {recentActivity.map((s) => {
              const state = uiSignalStateFromMarketStatus(deriveMarketStatus(s));
              const stateStyle = uiSignalStateClasses(state);
              return (
                <div key={`activity-${s.id}`} className="flex items-center justify-between rounded-lg bg-black/20 px-2.5 py-2 text-xs">
                  <p className="text-sigflo-text">{s.pair}</p>
                  <p className={`inline-flex items-center gap-1 font-semibold ${stateStyle.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${stateStyle.dot}`} />
                    {uiSignalStateLabel(state)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <button
          type="button"
          className="w-full rounded-2xl border border-sigflo-accent/28 bg-sigflo-accentDim px-4 py-3 text-sm font-semibold text-sigflo-accent transition hover:border-sigflo-accent/40 hover:bg-sigflo-accent/15 active:scale-[0.99]"
        >
          + Add Bot
        </button>
      </div>
    </div>
  );
}
