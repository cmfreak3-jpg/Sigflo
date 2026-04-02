import { useCallback, useEffect, useState } from 'react';
import { connectExchange, disconnectExchange, listIntegrations } from '@/services/api/integrationClient';
import type { ExchangeId, IntegrationStatus } from '@/types/integrations';

export function useExchangeIntegrations() {
  const [items, setItems] = useState<IntegrationStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listIntegrations());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load integrations.');
    } finally {
      setLoading(false);
    }
  }, []);

  const connect = useCallback(async (exchange: ExchangeId, creds: { apiKey: string; apiSecret: string; passphrase?: string }) => {
    await connectExchange(exchange, creds);
    await refresh();
  }, [refresh]);

  const disconnect = useCallback(async (exchange: ExchangeId) => {
    await disconnectExchange(exchange);
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, error, refresh, connect, disconnect };
}
