import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_AUTOMATION_SAFEGUARDS,
  appendActivityEntry,
  parseActivityLogJson,
} from '@/lib/aiExitAutomation';
import type {
  AutomationSafeguards,
  ExitAiMode,
  ExitAutomationActivityEntry,
  ExitStrategyPreset,
} from '@/types/aiExitAutomation';

const LS_MODE = 'sigflo.exitAi.mode';
const LS_STRATEGY = 'sigflo.exitAi.strategy';
const LS_SAFEGUARDS = 'sigflo.exitAi.safeguards';

function loadMode(): ExitAiMode {
  const v = window.localStorage.getItem(LS_MODE);
  if (v === 'manual' || v === 'assisted' || v === 'auto') return v;
  return 'manual';
}

function loadStrategy(): ExitStrategyPreset {
  const v = window.localStorage.getItem(LS_STRATEGY);
  if (v === 'protect_profit' || v === 'trend_follow' || v === 'tight_risk' || v === 'custom') return v;
  return 'protect_profit';
}

function loadSafeguards(): AutomationSafeguards {
  try {
    const raw = window.localStorage.getItem(LS_SAFEGUARDS);
    if (!raw) return { ...DEFAULT_AUTOMATION_SAFEGUARDS };
    const p = JSON.parse(raw) as Partial<AutomationSafeguards>;
    return {
      maxLossPct:
        typeof p.maxLossPct === 'number' && Number.isFinite(p.maxLossPct)
          ? Math.min(50, Math.max(0.5, p.maxLossPct))
          : DEFAULT_AUTOMATION_SAFEGUARDS.maxLossPct,
      minProfitBeforeTrimPct:
        typeof p.minProfitBeforeTrimPct === 'number' && Number.isFinite(p.minProfitBeforeTrimPct)
          ? Math.min(25, Math.max(0, p.minProfitBeforeTrimPct))
          : DEFAULT_AUTOMATION_SAFEGUARDS.minProfitBeforeTrimPct,
      allowPartialExits: p.allowPartialExits !== false,
      allowFullAutoClose: p.allowFullAutoClose !== false,
    };
  } catch {
    return { ...DEFAULT_AUTOMATION_SAFEGUARDS };
  }
}

function activityStorageKey(scopeKey: string) {
  return `sigflo.exitAi.activity.${scopeKey}`;
}

export function useExitAutomation(scopeKey: string) {
  const [mode, setMode] = useState<ExitAiMode>(loadMode);
  const [strategy, setStrategy] = useState<ExitStrategyPreset>(loadStrategy);
  const [safeguards, setSafeguards] = useState<AutomationSafeguards>(loadSafeguards);
  const [activity, setActivity] = useState<ExitAutomationActivityEntry[]>([]);

  useEffect(() => {
    setActivity(parseActivityLogJson(window.localStorage.getItem(activityStorageKey(scopeKey))));
  }, [scopeKey]);

  useEffect(() => {
    window.localStorage.setItem(LS_MODE, mode);
  }, [mode]);

  useEffect(() => {
    window.localStorage.setItem(LS_STRATEGY, strategy);
  }, [strategy]);

  useEffect(() => {
    window.localStorage.setItem(LS_SAFEGUARDS, JSON.stringify(safeguards));
  }, [safeguards]);

  const persistActivity = useCallback((next: ExitAutomationActivityEntry[]) => {
    window.localStorage.setItem(activityStorageKey(scopeKey), JSON.stringify(next));
  }, [scopeKey]);

  const pushActivity = useCallback(
    (entry: Omit<ExitAutomationActivityEntry, 'id' | 'ts'> & { id?: string; ts?: number }) => {
      setActivity((prev) => {
        const next = appendActivityEntry(prev, entry);
        persistActivity(next);
        return next;
      });
    },
    [persistActivity],
  );

  const clearActivity = useCallback(() => {
    setActivity([]);
    window.localStorage.removeItem(activityStorageKey(scopeKey));
  }, [scopeKey]);

  return useMemo(
    () => ({
      mode,
      setMode,
      strategy,
      setStrategy,
      safeguards,
      setSafeguards,
      activity,
      pushActivity,
      clearActivity,
    }),
    [mode, strategy, safeguards, activity, pushActivity, clearActivity],
  );
}
