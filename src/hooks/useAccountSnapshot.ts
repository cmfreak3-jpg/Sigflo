import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getAccountSnapshots, getClosedTrades } from '@/services/api/portfolioClient';
import type { ClosedTradeRow, ExchangeSnapshot } from '@/types/integrations';

export type RefreshAccountSnapshotsOptions = {
  /** When true, skip loading spinner (for background poll / tab focus). */
  silent?: boolean;
};

/**
 * Loads `/api/portfolio/*` snapshots. Optional `pollMs` refreshes in the background while the tab is visible.
 *
 * Defers the initial fetch until Supabase auth has finished restoring the session so the
 * `Authorization` header is present on the very first request (avoids a 401 race on page load).
 */
export function useAccountSnapshot(options?: { pollMs?: number }) {
  const pollMs = options?.pollMs ?? 0;
  const { loading: authLoading, session } = useAuth();
  const [items, setItems] = useState<ExchangeSnapshot[]>([]);
  const [closedTrades, setClosedTrades] = useState<ClosedTradeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async (opts?: RefreshAccountSnapshotsOptions): Promise<ExchangeSnapshot[]> => {
    const silent = opts?.silent === true;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    let snapshots: ExchangeSnapshot[] = [];
    try {
      const [snapRes, closedRes] = await Promise.allSettled([getAccountSnapshots(), getClosedTrades()]);
      if (!mountedRef.current) return snapshots;

      const errs: string[] = [];

      if (snapRes.status === 'fulfilled') {
        setItems(snapRes.value);
        snapshots = snapRes.value;
      } else {
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
      if (!silent && mountedRef.current) setLoading(false);
    }
    return snapshots;
  }, []);

  // Fetch once auth has resolved (or immediately when auth is not configured).
  // Re-fetch when the session identity changes (sign-in / sign-out).
  const sessionUid = session?.user?.id ?? null;
  useEffect(() => {
    if (authLoading) return;
    hasFetchedRef.current = true;
    void refresh();
  }, [authLoading, sessionUid, refresh]);

  useEffect(() => {
    if (pollMs <= 0 || !hasFetchedRef.current) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void refresh({ silent: true });
    }, pollMs);
    return () => window.clearInterval(id);
  }, [pollMs, refresh]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && hasFetchedRef.current) void refresh({ silent: true });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refresh]);

  return { items, closedTrades, loading, error, refresh };
}
