import {
  applySafeguardsToGuidance,
  nextPlannedAutomationLine,
} from '@/lib/aiExitAutomation';
import { computeExitGuidance, type ExitGuidance } from '@/lib/exitGuidance';
import type { AutomationSafeguards, ExitAiMode, ExitStrategyPreset } from '@/types/aiExitAutomation';
import type { TradeSide } from '@/types/trade';

export type ResolveExitGuidanceInput =
  | {
      variant: 'trade';
      side: TradeSide;
      entry: number;
      estimatedPnlPct: number;
      stop: number;
      target: number;
      trendAlignment: number;
      momentumQuality: number;
      strategyPreset: ExitStrategyPreset;
      safeguards: AutomationSafeguards;
      exitAiMode: ExitAiMode;
    }
  | {
      variant: 'manage';
      side: 'long' | 'short';
      entry: number;
      mark: number;
      stop: number;
      target: number;
      trendAlignment: number;
      momentumQuality: number;
      pnlPct: number;
      strategyPreset: ExitStrategyPreset;
      safeguards: AutomationSafeguards;
      exitAiMode: ExitAiMode;
    };

export type ResolvedExitGuidanceFlow = {
  raw: ExitGuidance;
  effective: ExitGuidance;
  nextPlanned: string;
  pnlPct: number;
  lastPrice: number;
};

export function resolveExitGuidanceFlow(input: ResolveExitGuidanceInput): ResolvedExitGuidanceFlow {
  let lastPrice: number;
  let pnlPct: number;

  if (input.variant === 'trade') {
    pnlPct = input.estimatedPnlPct;
    lastPrice =
      input.side === 'long'
        ? input.entry * (1 + input.estimatedPnlPct / 100)
        : input.entry * (1 - input.estimatedPnlPct / 100);
  } else {
    pnlPct = input.pnlPct;
    lastPrice = input.mark;
  }

  const raw = computeExitGuidance({
    side: input.side,
    entry: input.entry,
    lastPrice,
    stop: input.stop,
    target: input.target,
    trendAlignment: input.trendAlignment,
    momentumQuality: input.momentumQuality,
    pnlPct,
    strategyPreset: input.strategyPreset,
  });

  const effective = applySafeguardsToGuidance(
    raw,
    pnlPct,
    input.safeguards,
    input.stop,
    input.target,
    input.side,
  );

  const nextPlanned = nextPlannedAutomationLine({
    mode: input.exitAiMode,
    guidance: effective,
    safeguards: input.safeguards,
    pnlPct,
  });

  return { raw, effective, nextPlanned, pnlPct, lastPrice };
}
