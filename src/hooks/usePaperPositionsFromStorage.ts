import { useEffect, useState } from 'react';
import { loadPaperPositions, PAPER_POSITIONS_CHANGED_EVENT } from '@/lib/paperPositionsStorage';
import type { SimulatedActivePosition } from '@/types/activePosition';

/**
 * Browser-persisted practice positions (Long/Short on Trade).
 * `useSyncExternalStore` was avoided here: `loadPaperPositions()` returns a new array each call,
 * which must not be used as a snapshot (React would re-render until max depth).
 */
export function usePaperPositionsFromStorage(): SimulatedActivePosition[] {
  const [positions, setPositions] = useState<SimulatedActivePosition[]>(() => loadPaperPositions());

  useEffect(() => {
    const sync = () => {
      setPositions(loadPaperPositions());
    };
    window.addEventListener('storage', sync);
    window.addEventListener(PAPER_POSITIONS_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(PAPER_POSITIONS_CHANGED_EVENT, sync);
    };
  }, []);

  return positions;
}
