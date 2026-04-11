import { deriveMarketStatus } from '@/lib/marketScannerRows';
import type { UiSignalState } from '@/lib/signalState';
import { uiSignalStateFromMarketStatus, uiSignalStateLabel } from '@/lib/signalState';
import type { CryptoSignal } from '@/types/signal';

/** Bots home “Recent Activity” list (pair + status rows). */
export const BOTS_RECENT_ACTIVITY_MAX = 10;

export type BotStatus = 'active' | 'scanning' | 'paused';

/** Resolved row status for bot cards (includes signal-derived states). */
export type BotCardStatus = 'active' | 'scanning' | 'paused' | 'setup_forming' | 'in_trade';

export type BotRuntimeStats = {
  signalsToday: number;
  winRatePct: number;
  lastResultPct: number;
};

export type BotSetupTypeLabel = 'Breakout' | 'Pullback' | 'Reversal';

export type BotMarketContext = {
  volatility: 'Low' | 'Medium' | 'High';
  structure: 'Trending' | 'Ranging';
  volume: 'Weak' | 'Building' | 'Strong';
};

export type BotExpandDetail = {
  setupStateLabel: string;
  bias: string;
  /** 0–100, shown as confidence */
  confidencePct: number;
  aiNote: string;
  /** Shown in thinking layer; 1–2 short lines. Falls back to trimmed `aiNote` if missing. */
  commentaryShort?: string;
  setupType: BotSetupTypeLabel;
  marketContext: BotMarketContext;
  entry?: number;
  stop?: number;
  target?: number;
};

export type BotAgent = {
  id: string;
  name: string;
  strategy: string;
  status: BotStatus;
  watchedPairs: string[];
  signalId: string;
  riskMode: 'balanced' | 'aggressive' | 'defensive';
  intentLine: string;
  activityLine: string;
  stats: BotRuntimeStats;
  detail: BotExpandDetail;
  /**
   * When true, expanded “current setup” shows the empty waiting state (scanning / no validated plan).
   * Seed: Nova demonstrates this while Kai/Rio show full setup grids.
   */
  expandedSetupPending?: boolean;
};

export const baseBots: BotAgent[] = [
  {
    id: 'bot-kai',
    name: 'Kai',
    strategy: 'Momentum Bot',
    status: 'active',
    watchedPairs: ['BTC', 'ETH', 'SOL'],
    signalId: 'sig-3',
    riskMode: 'balanced',
    intentLine: 'Looking for continuation above resistance',
    activityLine: 'Monitoring LINK momentum follow-through',
    stats: { signalsToday: 3, winRatePct: 71, lastResultPct: 2.4 },
    detail: {
      setupStateLabel: 'Momentum continuation',
      bias: 'Long',
      confidencePct: 72,
      setupType: 'Pullback',
      marketContext: { volatility: 'Medium', structure: 'Trending', volume: 'Building' },
      aiNote: 'Momentum remains intact but confirmation above the local resistance print is still needed before size-up.',
      commentaryShort: 'Momentum remains intact but confirmation above 94,180 is still needed.',
      entry: 94180,
      stop: 92340,
      target: 97880,
    },
  },
  {
    id: 'bot-nova',
    name: 'Nova',
    strategy: 'Breakout Bot',
    status: 'scanning',
    watchedPairs: ['BTC', 'AVAX', 'LINK'],
    signalId: 'sig-1',
    riskMode: 'aggressive',
    expandedSetupPending: true,
    intentLine: 'Scanning for breakout compression',
    activityLine: 'LINK nearing volatility expansion',
    stats: { signalsToday: 2, winRatePct: 64, lastResultPct: 1.3 },
    detail: {
      setupStateLabel: 'Compression watch',
      bias: 'Neutral',
      confidencePct: 58,
      setupType: 'Breakout',
      marketContext: { volatility: 'High', structure: 'Ranging', volume: 'Weak' },
      aiNote: 'Breakout structure is forming, but volume is not yet supportive — waiting for expansion + acceptance.',
      commentaryShort: 'Breakout structure is forming, but volume is not yet supportive.',
      entry: 18.42,
      stop: 17.65,
      target: 20.1,
    },
  },
  {
    id: 'bot-rio',
    name: 'Rio',
    strategy: 'Reversal Bot',
    status: 'active',
    watchedPairs: ['ETH', 'SOL', 'ADA'],
    signalId: 'sig-2',
    riskMode: 'defensive',
    intentLine: 'Waiting for reversal confirmation',
    activityLine: 'SOL rejected from local high, re-evaluating',
    stats: { signalsToday: 1, winRatePct: 67, lastResultPct: -0.8 },
    detail: {
      setupStateLabel: 'Reversal probe',
      bias: 'Short',
      confidencePct: 61,
      setupType: 'Reversal',
      marketContext: { volatility: 'Medium', structure: 'Trending', volume: 'Building' },
      aiNote: 'Rejection at the local high is credible; confirmation needs a lower high fail or breakdown follow-through.',
      commentaryShort: 'Reversal conditions are still weak — waiting for a stronger rejection signal.',
      entry: 142.2,
      stop: 146.8,
      target: 132.5,
    },
  },
];

/** Map engine setup type to card label (overextended → Reversal). */
export function setupTypeFromSignal(setupType: CryptoSignal['setupType']): BotSetupTypeLabel {
  if (setupType === 'breakout') return 'Breakout';
  if (setupType === 'pullback') return 'Pullback';
  return 'Reversal';
}

export function statusTone(status: BotStatus): { label: string; className: string } {
  if (status === 'active') return { label: 'Active', className: 'text-[#7fffe0]' };
  if (status === 'scanning') return { label: 'Scanning', className: 'text-cyan-200' };
  return { label: 'Paused', className: 'text-slate-400' };
}

export function botCardStatusMeta(status: BotCardStatus): { label: string; dotClass: string; textClass: string } {
  switch (status) {
    case 'in_trade':
      return {
        label: 'In trade',
        dotClass: 'bg-[#00ffc8] shadow-[0_0_10px_rgba(0,255,200,0.55)]',
        textClass: 'text-[#7fffe0]',
      };
    case 'setup_forming':
      return {
        label: 'Setup forming',
        dotClass: 'bg-amber-400/90 shadow-[0_0_8px_rgba(251,191,36,0.35)]',
        textClass: 'text-amber-200/95',
      };
    case 'scanning':
      return {
        label: 'Scanning',
        dotClass: 'bg-cyan-400/90 shadow-[0_0_8px_rgba(34,211,238,0.35)]',
        textClass: 'text-cyan-200',
      };
    case 'paused':
      return {
        label: 'Paused',
        dotClass: 'bg-slate-500',
        textClass: 'text-slate-400',
      };
    default:
      return {
        label: 'Active',
        dotClass: 'bg-emerald-400/90 shadow-[0_0_8px_rgba(52,211,153,0.3)]',
        textClass: 'text-emerald-200/95',
      };
  }
}

/**
 * Live card status: pause wins; then signal “triggered” → in trade; “setup” → setup_forming;
 * else fall back to stored bot mode (active / scanning).
 */
export function resolveBotCardStatus(stored: BotStatus, uiState: UiSignalState | null): BotCardStatus {
  if (stored === 'paused') return 'paused';
  if (uiState === 'triggered') return 'in_trade';
  if (uiState === 'setup_forming') return 'setup_forming';
  if (stored === 'scanning') return 'scanning';
  return 'active';
}

export function shortActionLabel(signal: CryptoSignal): string {
  const marketStatus = deriveMarketStatus(signal);
  const uiState = uiSignalStateFromMarketStatus(marketStatus);
  return `${signal.pair} ${uiSignalStateLabel(uiState).toLowerCase()}`;
}

export function formatBotPrice(n: number | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}
