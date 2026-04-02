import { apiJson } from './http';
import type { ExchangeId, IntegrationStatus } from '@/types/integrations';

export async function listIntegrations(): Promise<IntegrationStatus[]> {
  return apiJson<IntegrationStatus[]>('/integrations');
}

export async function connectExchange(exchange: ExchangeId, input: { apiKey: string; apiSecret: string; passphrase?: string }) {
  return apiJson<IntegrationStatus>(`/integrations/${exchange}/connect`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function disconnectExchange(exchange: ExchangeId): Promise<void> {
  await apiJson<void>(`/integrations/${exchange}`, {
    method: 'DELETE',
  });
}
