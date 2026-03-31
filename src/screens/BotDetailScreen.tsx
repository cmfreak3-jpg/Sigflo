import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useBotStatuses } from '@/hooks/useBotStatuses';
import { useSignalEngine } from '@/hooks/useSignalEngine';
import { baseBots, shortActionLabel, statusTone } from '@/lib/bots';
import { deriveMarketStatus } from '@/lib/marketScannerRows';
import { uiSignalStateClasses, uiSignalStateFromMarketStatus, uiSignalStateLabel } from '@/lib/signalState';
import { buildTradeQueryString } from '@/lib/tradeNavigation';

export default function BotDetailScreen() {
  const { botId } = useParams<{ botId: string }>();
  const navigate = useNavigate();
  const { signals } = useSignalEngine();
  const { statusMap, togglePause, setBotStatus } = useBotStatuses();

  const bot = useMemo(() => baseBots.find((b) => b.id === botId) ?? null, [botId]);
  const signal = useMemo(() => {
    if (!bot) return null;
    return signals.find((s) => s.id === bot.signalId) ?? signals[0] ?? null;
  }, [bot, signals]);

  if (!bot || !signal) {
    return (
      <div className="space-y-3 pt-4">
        <div className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-4">
          <p className="text-sm text-sigflo-muted">Bot not found.</p>
          <Link to="/bots" className="mt-2 inline-flex text-sm font-semibold text-cyan-200">
            Back to Bots
          </Link>
        </div>
      </div>
    );
  }

  const status = statusMap[bot.id] ?? bot.status;
  const tone = statusTone(status);
  const marketStatus = deriveMarketStatus(signal);
  const uiState = uiSignalStateFromMarketStatus(marketStatus);
  const stateStyle = uiSignalStateClasses(uiState);
  const focusPair = bot.watchedPairs[0] ?? signal.pair;

  const recent = [
    `${signal.pair} ${uiSignalStateLabel(uiState).toLowerCase()}`,
    `${bot.watchedPairs[1] ?? signal.pair} setup scan refreshed`,
    `${bot.watchedPairs[2] ?? signal.pair} momentum check complete`,
  ];

  return (
    <div className="min-h-[100dvh] bg-sigflo-bg pb-6 pt-4">
      <div className="mx-auto w-full max-w-lg space-y-3 px-4">
        <header className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-sigflo-muted">Agent</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">{bot.name}</h1>
          <p className="text-xs uppercase tracking-[0.12em] text-sigflo-muted">{bot.strategy}</p>
          <p className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${tone.className}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status === 'paused' ? 'bg-slate-500' : stateStyle.dot}`} />
            {tone.label}
          </p>
        </header>

        <section className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-3 text-xs text-sigflo-muted">
          <p>Markets watched: {bot.watchedPairs.join(', ')}</p>
          <p className="mt-1">Last action: {shortActionLabel(signal)}</p>
          <p className="mt-1">Current focus: {focusPair}</p>
          <p className="mt-1">Risk mode: {bot.riskMode}</p>
        </section>

        <section className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sigflo-muted">Recent activity</p>
          <div className="mt-2 space-y-1.5">
            {recent.map((item) => (
              <div key={item} className="rounded-lg bg-black/20 px-2.5 py-2 text-xs text-sigflo-text">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className={`rounded-2xl border bg-sigflo-surface p-3 ${stateStyle.card}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sigflo-muted">Current setup</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-base font-bold text-white">{signal.pair} / USDT</p>
            <p className={`inline-flex items-center gap-1 text-xs font-semibold ${stateStyle.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${stateStyle.dot}`} />
              {uiSignalStateLabel(uiState)}
            </p>
          </div>
          <p className="mt-1 text-xs text-sigflo-muted">{signal.biasLabel}</p>
        </section>

        <section className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sigflo-muted">Controls</p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => togglePause(bot.id)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${
                status === 'paused'
                  ? 'border-cyan-300/35 bg-cyan-300/10 text-cyan-100'
                  : 'border-white/20 bg-white/[0.03] text-sigflo-text'
              }`}
            >
              {status === 'paused' ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              onClick={() => setBotStatus(bot.id, status === 'scanning' ? 'active' : 'scanning')}
              className="rounded-full border border-white/20 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-sigflo-text"
            >
              {status === 'scanning' ? 'Set Active' : 'Set Scan'}
            </button>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => navigate('/feed?filter=actionable')}
            className="rounded-2xl border border-white/15 bg-sigflo-surface px-3 py-2 text-sm font-semibold text-sigflo-text"
          >
            View active setup
          </button>
          <button
            type="button"
            onClick={() => navigate(`/trade?${buildTradeQueryString(signal, { marketStatus })}`)}
            className="rounded-2xl border border-sigflo-accent/30 bg-sigflo-accentDim px-3 py-2 text-sm font-semibold text-sigflo-accent"
          >
            Open trade
          </button>
        </section>
      </div>
    </div>
  );
}
