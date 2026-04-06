import { formatQuoteNumber } from '@/lib/formatQuote';
import type { ExitGuidance } from '@/lib/exitGuidance';
import type {
  AutomationSafeguards,
  ExitAiMode,
  ExitAutomationActivityEntry,
  ExitStrategyPreset,
} from '@/types/aiExitAutomation';

export const DEFAULT_AUTOMATION_SAFEGUARDS: AutomationSafeguards = {
  maxLossPct: 5,
  minProfitBeforeTrimPct: 0.35,
  allowPartialExits: true,
  allowFullAutoClose: true,
};

export const EXIT_AI_MODE_LABEL: Record<ExitAiMode, string> = {
  manual: 'Manual',
  assisted: 'Assisted',
  auto: 'Auto',
};

export const EXIT_STRATEGY_LABEL: Record<ExitStrategyPreset, string> = {
  protect_profit: 'Protect Profit',
  trend_follow: 'Trend Follow',
  tight_risk: 'Tight Risk',
  custom: 'Custom',
};

export const EXIT_STRATEGY_BLURB: Record<ExitStrategyPreset, string> = {
  protect_profit: 'Lock gains quickly when momentum weakens',
  trend_follow: 'Let winners run longer and tighten exits gradually',
  tight_risk: 'Exit earlier when weakness appears',
  custom: 'User-defined automation rules',
};

export const EXIT_AI_MODE_HELPER: Record<ExitAiMode, string> = {
  manual: 'You control all exits',
  assisted: 'AI recommends and prepares exits',
  auto: 'AI can automatically manage exits',
};

export function newActivityId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatActivityTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Apply safeguard rules on top of model exit guidance (display + automation). */
export function applySafeguardsToGuidance(
  g: ExitGuidance,
  pnlPct: number,
  safeguards: AutomationSafeguards,
  stop: number,
  target: number,
  side: 'long' | 'short',
): ExitGuidance {
  const maxLoss = Math.abs(safeguards.maxLossPct);
  if (pnlPct <= -maxLoss) {
    return {
      ...g,
      state: 'exit',
      headline: 'EXIT',
      confidenceLabel: 'High',
      reason: 'Unrealized loss reached your max-loss safeguard.',
      action: `Exit toward $${formatQuoteNumber(stop)}`,
      referencePrice: stop,
    };
  }

  if (g.state === 'trim' && pnlPct < safeguards.minProfitBeforeTrimPct) {
    const nudge =
      side === 'long'
        ? target * (1 + 0.002)
        : target * (1 - 0.002);
    return {
      ...g,
      state: 'hold',
      headline: '',
      confidenceLabel: 'Medium',
      reason: 'Below your minimum profit threshold for automated trims.',
      action: `Let it work toward $${formatQuoteNumber(target)}`,
      referencePrice: nudge,
    };
  }

  return g;
}

export function nextPlannedAutomationLine(args: {
  mode: ExitAiMode;
  guidance: ExitGuidance;
  safeguards: AutomationSafeguards;
  pnlPct: number;
}): string {
  const { mode, guidance: g, safeguards, pnlPct } = args;

  if (mode === 'manual') {
    return 'You control exits — AI shows guidance only.';
  }

  if (pnlPct <= -Math.abs(safeguards.maxLossPct)) {
    return safeguards.allowFullAutoClose
      ? 'Will close fully — max loss safeguard.'
      : 'Max loss hit — auto full close off; exit manually.';
  }

  if (mode === 'assisted') {
    if (g.state === 'hold') return 'No prepared exit — review guidance when state changes.';
    return `${g.action} — tap Confirm below when ready.`;
  }

  // auto
  if (g.state === 'exit' && !safeguards.allowFullAutoClose) {
    return `Suggests full exit near $${formatQuoteNumber(g.referencePrice)} — auto close off.`;
  }
  if (g.state === 'trim' && !safeguards.allowPartialExits) {
    return `Near target — partial auto off; watching only.`;
  }
  if (g.state === 'trim') {
    return `Will trim ~50% near $${formatQuoteNumber(g.referencePrice)}`;
  }
  if (g.state === 'exit') {
    return `Will close fully near $${formatQuoteNumber(g.referencePrice)}`;
  }
  return 'Automation watching trend and risk.';
}

export function parseActivityLogJson(raw: string | null): ExitAutomationActivityEntry[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (e): e is ExitAutomationActivityEntry =>
          e != null &&
          typeof e === 'object' &&
          typeof (e as ExitAutomationActivityEntry).id === 'string' &&
          typeof (e as ExitAutomationActivityEntry).ts === 'number' &&
          typeof (e as ExitAutomationActivityEntry).message === 'string',
      )
      .slice(-80);
  } catch {
    return [];
  }
}

export function appendActivityEntry(
  prev: ExitAutomationActivityEntry[],
  entry: Omit<ExitAutomationActivityEntry, 'id' | 'ts'> & { id?: string; ts?: number },
): ExitAutomationActivityEntry[] {
  const next: ExitAutomationActivityEntry = {
    id: entry.id ?? newActivityId(),
    ts: entry.ts ?? Date.now(),
    kind: entry.kind,
    message: entry.message,
  };
  return [...prev, next].slice(-80);
}
