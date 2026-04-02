import { apiJson } from './http';
import type { ClosedTradeRow, ExchangeSnapshot } from '@/types/integrations';

export async function getAccountSnapshots(): Promise<ExchangeSnapshot[]> {
  const data = await apiJson<{ exchanges: ExchangeSnapshot[] }>('/portfolio/accounts');
  return data.exchanges;
}

export async function getClosedTrades(): Promise<ClosedTradeRow[]> {
  const data = await apiJson<{ trades: ClosedTradeRow[] }>('/portfolio/closed-trades');
  return data.trades;
}
