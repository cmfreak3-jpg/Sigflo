import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BotCard } from '@/components/bots/BotCard';
import { BotOverviewCard } from '@/components/bots/BotOverviewCard';
import { useBotStatuses } from '@/hooks/useBotStatuses';
import { useSignalEngine } from '@/hooks/useSignalEngine';
import {
  BOTS_RECENT_ACTIVITY_MAX,
  baseBots,
  resolveBotCardStatus,
} from '@/lib/bots';
import { buildBotViewChartTradeQuery } from '@/lib/tradeNavigation';
import { deriveMarketStatus } from '@/lib/marketScannerRows';
import { uiSignalStateClasses, uiSignalStateFromMarketStatus, uiSignalStateLabel } from '@/lib/signalState';
import type { CryptoSignal } from '@/types/signal';

export default function BotsScreen() {
  const navigate = useNavigate();
  const { signals } = useSignalEngine();
  const [tick, setTick] = useState(0);
  const { statusMap, togglePause } = useBotStatuses();
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
  const scanningCount = botsWithSignal.filter((b) => b.status === 'scanning').length;
  const pausedCount = botsWithSignal.filter((b) => b.status === 'paused').length;
  const watchingCount = new Set(botsWithSignal.flatMap((b) => b.watchedPairs)).size;
  const signalsTodayTotal = botsWithSignal.reduce((s, b) => s + b.stats.signalsToday, 0);

  const inTradeCount = useMemo(() => {
    let n = 0;
    for (const b of botsWithSignal) {
      if (b.status === 'paused' || !b.signal) continue;
      const ui = uiSignalStateFromMarketStatus(deriveMarketStatus(b.signal));
      if (ui === 'triggered') n += 1;
    }
    return n;
  }, [botsWithSignal]);

  const overviewSubline = useMemo(() => {
    if (pausedCount === botsWithSignal.length) return 'All agents paused — resume when you want scanning to continue.';
    if (inTradeCount > 0)
      return inTradeCount === 1
        ? '1 agent is in a live position — others are scanning.'
        : `${inTradeCount} agents in live positions — supervise exits on Trade.`;
    if (scanningCount > 0 && activeCount > 0)
      return `${scanningCount} bot${scanningCount > 1 ? 's' : ''} monitoring high-priority conditions.`;
    if (activeCount > 0 && pausedCount === 0) return 'All systems running — agents are scanning and evaluating setups.';
    return 'Agents idle or scanning — open a bot for full detail.';
  }, [activeCount, botsWithSignal.length, inTradeCount, pausedCount, scanningCount]);

  const recentActivity = useMemo(() => {
    if (signals.length === 0) return [];
    const ordered = [...signals].sort((a, b) => b.setupScore - a.setupScore);
    const n = Math.min(BOTS_RECENT_ACTIVITY_MAX, ordered.length);
    return Array.from({ length: n }, (_, offset) => ordered[(tick + offset) % ordered.length]);
  }, [signals, tick]);

  const openBot = useCallback(
    (botId: string) => {
      navigate(`/bots/${botId}`);
    },
    [navigate],
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  /** One focal card: first non-paused “setup forming”, else first available in Nova → Kai → Rio (skipped if paused / in trade). */
  const spotlightBotId = useMemo(() => {
    const cardStatusFor = (b: (typeof botsWithSignal)[0]) => {
      const hasSignal = b.signal != null;
      const marketStatus = hasSignal ? deriveMarketStatus(b.signal) : null;
      const uiState = marketStatus != null ? uiSignalStateFromMarketStatus(marketStatus) : null;
      return resolveBotCardStatus(b.status, uiState);
    };

    for (const b of botsWithSignal) {
      if (b.status === 'paused') continue;
      if (cardStatusFor(b) === 'setup_forming') return b.id;
    }

    for (const id of ['bot-nova', 'bot-kai', 'bot-rio'] as const) {
      const b = botsWithSignal.find((x) => x.id === id);
      if (!b || b.status === 'paused') continue;
      if (cardStatusFor(b) === 'in_trade') continue;
      return b.id;
    }
    return null;
  }, [botsWithSignal]);

  return (
    <div className="min-h-[100dvh] bg-sigflo-bg pb-24 pt-4">
      <div className="mx-auto w-full max-w-lg space-y-4 px-4">
        <BotOverviewCard
          metrics={{
            activeBots: activeCount,
            scanningBots: scanningCount,
            marketsWatched: watchingCount,
            signalsToday: signalsTodayTotal,
          }}
          subline={overviewSubline}
          onAddBot={() => navigate('/feed')}
        />

        <div className="relative overflow-hidden rounded-2xl border border-amber-400/20 bg-gradient-to-r from-amber-500/[0.08] via-[rgba(0,255,200,0.06)] to-amber-500/[0.08] px-4 py-3 text-center shadow-[0_0_32px_-14px_rgba(251,191,36,0.35)] ring-1 ring-amber-400/15">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-amber-100/95">Coming soon</p>
          <p className="mt-1 text-[11px] leading-snug text-sigflo-muted">
            Autonomous bot execution and exchange-linked agents are in development. This screen is a preview of the command
            center.
          </p>
        </div>

        <section className="space-y-3">
          {botsWithSignal.map((bot) => {
            const signal = bot.signal;
            const hasSignal = signal != null;
            const marketStatus = hasSignal ? deriveMarketStatus(signal) : null;
            const uiState = marketStatus != null ? uiSignalStateFromMarketStatus(marketStatus) : null;
            const cardStatus = resolveBotCardStatus(bot.status, uiState);
            const isSpotlight = spotlightBotId != null && bot.id === spotlightBotId;

            return (
              <BotCard
                key={bot.id}
                bot={bot}
                signal={hasSignal ? signal : null}
                cardStatus={cardStatus}
                isSpotlight={isSpotlight}
                expanded={expandedId === bot.id}
                onToggleExpand={() => toggleExpand(bot.id)}
                onOpenBot={() => openBot(bot.id)}
                onPause={() => togglePause(bot.id)}
                onSettings={() => openBot(bot.id)}
                onViewChart={() =>
                  navigate(`/trade?${buildBotViewChartTradeQuery({ id: bot.id, watchedPairs: bot.watchedPairs }, hasSignal ? signal : null)}`)
                }
                onAdjustRisk={() => openBot(bot.id)}
              />
            );
          })}
        </section>

        <section className="rounded-2xl border border-white/[0.06] bg-sigflo-surface/90 p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-sigflo-muted">Recent market activity</p>
          <div className="mt-2 space-y-1.5">
            {recentActivity.map((s) => {
              const state = uiSignalStateFromMarketStatus(deriveMarketStatus(s));
              const stateStyle = uiSignalStateClasses(state);
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-black/25 px-2.5 py-2 text-xs"
                >
                  <p className="font-medium text-sigflo-text">{s.pair}</p>
                  <p className={`inline-flex items-center gap-1 font-semibold ${stateStyle.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${stateStyle.dot}`} />
                    {uiSignalStateLabel(state)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <div className="rounded-2xl border border-dashed border-cyan-400/15 bg-black/25 px-3 py-3 text-center">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-cyan-200/80">Coming soon</p>
          <p className="mt-1 text-[11px] text-sigflo-muted/90">Pro agent slots and custom strategies</p>
        </div>
      </div>
    </div>
  );
}
