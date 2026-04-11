import { useMemo, useState } from 'react';
import { baseBots } from '@/lib/bots';
import type { BotStatus } from '@/lib/bots';

const STORAGE_KEY = 'sigflo.botStatusMap.v1';

function readStoredMap(): Record<string, BotStatus> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, BotStatus>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export function useBotStatuses() {
  const [statusMap, setStatusMap] = useState<Record<string, BotStatus>>(() => readStoredMap());

  const resolvedMap = useMemo(() => {
    const out: Record<string, BotStatus> = {};
    for (const bot of baseBots) out[bot.id] = statusMap[bot.id] ?? bot.status;
    return out;
  }, [statusMap]);

  const setBotStatus = (botId: string, next: BotStatus) => {
    setStatusMap((prev) => {
      const updated = { ...prev, [botId]: next };
      if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const togglePause = (botId: string) => {
    const curr = resolvedMap[botId] ?? 'active';
    const base = baseBots.find((b) => b.id === botId);
    const resumeAs = base?.status ?? 'active';
    setBotStatus(botId, curr === 'paused' ? resumeAs : 'paused');
  };

  return { statusMap: resolvedMap, setBotStatus, togglePause };
}
