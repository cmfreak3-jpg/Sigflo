import type { CryptoSignal } from '@/types/signal';

/** Short decision cue for cards and Trade — custom copy wins, else derived from structure. */
export function resolveWatchCue(signal: CryptoSignal): string {
  const custom = signal.watchCue?.trim();
  if (custom) return custom;

  const long = signal.side === 'long';
  if (signal.setupType === 'overextended') {
    return long ? 'rejection at highs vs continuation higher' : 'failed bounce vs continuation lower';
  }
  if (signal.setupType === 'pullback') {
    return long ? 'buyers holding the pullback zone' : 'sellers capping relief bounces';
  }
  if (signal.setupTags.includes('Breakout')) {
    return long ? 'breakout above range high' : 'breakdown below range low';
  }
  return long ? 'structure confirming higher' : 'structure confirming lower';
}

/** Forward-looking “what happens next” (quiet, analytical). Custom `watchNext` wins. */
export function resolveWatchNextCue(signal: CryptoSignal): string {
  const custom = signal.watchNext?.trim();
  if (custom) return custom;

  const long = signal.side === 'long';
  if (signal.setupType === 'overextended') {
    return long ? 'extension → resistance reaction' : 'extension → support reaction';
  }
  if (signal.setupType === 'pullback') {
    return long ? 'hold at support → continuation' : 'hold at resistance → continuation';
  }
  if (signal.setupType === 'breakout') {
    return 'range break → continuation';
  }
  return 'next structural cue';
}
