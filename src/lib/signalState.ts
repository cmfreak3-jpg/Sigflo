import type { MarketRowStatus } from '@/types/markets';

export type UiSignalState = 'setup_forming' | 'in_play' | 'triggered';

export function uiSignalStateFromMarketStatus(status: MarketRowStatus): UiSignalState {
  if (status === 'triggered') return 'triggered';
  if (status === 'developing' || status === 'overextended') return 'in_play';
  return 'setup_forming';
}

export function uiSignalStateLabel(state: UiSignalState): string {
  if (state === 'triggered') return 'Triggered';
  if (state === 'in_play') return 'In Play';
  return 'Setup forming';
}

export function uiSignalStateClasses(state: UiSignalState): {
  dot: string;
  text: string;
  pill: string;
  card: string;
  pulse: boolean;
} {
  if (state === 'triggered') {
    return {
      dot: 'bg-[#00ffc8] shadow-[0_0_8px_rgba(0,255,200,0.58)]',
      text: 'text-[#7fffe0]',
      pill: 'border-[#00ffc8]/40 bg-[#00ffc8]/16 text-[#7fffe0] shadow-[0_0_16px_-10px_rgba(0,255,200,0.8)]',
      card: 'border-[rgba(0,255,200,0.56)] shadow-[0_18px_38px_-18px_rgba(0,255,200,0.72)] ring-1 ring-[rgba(0,255,200,0.3)]',
      pulse: true,
    };
  }
  if (state === 'in_play') {
    return {
      dot: 'bg-cyan-300/95',
      text: 'text-cyan-200',
      pill: 'border-cyan-300/30 bg-cyan-400/[0.1] text-cyan-100',
      card: 'border-cyan-400/24 ring-1 ring-cyan-400/12 hover:border-cyan-300/30',
      pulse: false,
    };
  }
  return {
    dot: 'bg-slate-500',
    text: 'text-slate-400',
    pill: 'border-slate-400/18 bg-slate-500/[0.07] text-slate-400',
    card: 'border-white/[0.04] opacity-[0.84] hover:border-white/[0.07]',
    pulse: false,
  };
}

export function postedAgoToSeconds(postedAgo: string): number {
  const v = postedAgo.trim().toLowerCase();
  if (v === 'live' || v === 'just now') return 12;
  const s = /^(\d+)\s*s/.exec(v);
  if (s) return Number(s[1]);
  const m = /^(\d+)\s*m/.exec(v);
  if (m) return Number(m[1]) * 60;
  const h = /^(\d+)\s*h/.exec(v);
  if (h) return Number(h[1]) * 3600;
  return 0;
}

export function formatElapsedAgo(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}
