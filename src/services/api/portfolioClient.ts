import { apiJson } from './http';
import type { ExchangeSnapshot } from '@/types/integrations';

export async function getAccountSnapshots(): Promise<ExchangeSnapshot[]> {
  const data = await apiJson<{ exchanges: ExchangeSnapshot[] }>('/portfolio/accounts');
  return data.exchanges;
}
