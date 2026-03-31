import { deriveMarketStatus } from '@/lib/marketScannerRows';
import { uiSignalStateFromMarketStatus, uiSignalStateLabel } from '@/lib/signalState';
import type { CryptoSignal } from '@/types/signal';

export type BotStatus = 'active' | 'scanning' | 'paused';

export type BotAgent = {
  id: string;
  name: string;
  strategy: string;
  status: BotStatus;
  watchedPairs: string[];
  signalId: string;
  riskMode: 'balanced' | 'aggressive' | 'defensive';
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
  },
  {
    id: 'bot-nova',
    name: 'Nova',
    strategy: 'Breakout Bot',
    status: 'scanning',
    watchedPairs: ['BTC', 'AVAX', 'LINK'],
    signalId: 'sig-1',
    riskMode: 'aggressive',
  },
  {
    id: 'bot-rio',
    name: 'Rio',
    strategy: 'Reversal Bot',
    status: 'active',
    watchedPairs: ['ETH', 'SOL', 'ADA'],
    signalId: 'sig-2',
    riskMode: 'defensive',
  },
];

export function statusTone(status: BotStatus): { label: string; className: string } {
  if (status === 'active') return { label: 'Active', className: 'text-[#7fffe0]' };
  if (status === 'scanning') return { label: 'Scanning', className: 'text-cyan-200' };
  return { label: 'Paused', className: 'text-slate-400' };
}

export function shortActionLabel(signal: CryptoSignal): string {
  const marketStatus = deriveMarketStatus(signal);
  const uiState = uiSignalStateFromMarketStatus(marketStatus);
  return `${signal.pair} ${uiSignalStateLabel(uiState).toLowerCase()}`;
}
