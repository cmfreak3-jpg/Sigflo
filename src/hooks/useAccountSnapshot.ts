import { useCallback, useEffect, useState } from 'react';
import { getAccountSnapshots } from '@/services/api/portfolioClient';
import type { ExchangeSnapshot } from '@/types/integrations';

export function useAccountSnapshot() {
  const [items, setItems] = useState<ExchangeSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await getAccountSnapshots());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load account snapshot.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, error, refresh };
}
