import { useCallback, useEffect, useState } from 'react';
import { getAccountSnapshots, getClosedTrades } from '@/services/api/portfolioClient';
import type { ClosedTradeRow, ExchangeSnapshot } from '@/types/integrations';

export function useAccountSnapshot() {
  const [items, setItems] = useState<ExchangeSnapshot[]>([]);
  const [closedTrades, setClosedTrades] = useState<ClosedTradeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [snapRes, closedRes] = await Promise.allSettled([getAccountSnapshots(), getClosedTrades()]);
      const errs: string[] = [];

      if (snapRes.status === 'fulfilled') setItems(snapRes.value);
      else {
        setItems([]);
        errs.push(snapRes.reason instanceof Error ? snapRes.reason.message : 'Failed to load account snapshot.');
      }

      if (closedRes.status === 'fulfilled') setClosedTrades(closedRes.value);
      else {
        setClosedTrades([]);
        errs.push(closedRes.reason instanceof Error ? closedRes.reason.message : 'Failed to load closed trades.');
      }

      setError(errs.length > 0 ? errs.join(' · ') : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, closedTrades, loading, error, refresh };
}
