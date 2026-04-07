import { tradeTimingChipProps, type TradeTimingChipState } from '@/lib/tradeTimingChip';
import type { MarketRowStatus } from '@/types/markets';
import type { TradeSide } from '@/types/trade';

export type EntryGuidance = {
  timingState: TradeTimingChipState;
  timingLabel: string;
  action: string;
  reason: string;
  confidenceLabel: 'High' | 'Medium' | 'Low';
};

/**
 * Pre-entry (and light in-position) copy for the scenario strip — mirrors exit guidance shape.
 * Uses scanner timing + scores + distance from last to planned entry.
 */
export function computeTradeEntryGuidance(args: {
  marketStatus: MarketRowStatus;
  tradeScore: number;
  setupScore: number;
  side: TradeSide;
  lastPrice: number;
  planEntry: number;
  /** Open position: entry is locked; copy shifts to management framing. */
  hasOpenPosition: boolean;
}): EntryGuidance {
  const { state, label } = tradeTimingChipProps(args.marketStatus, args.tradeScore);
  const blend = (args.setupScore / 100) * 0.45 + (args.tradeScore / 100) * 0.55;
  let confidenceLabel: EntryGuidance['confidenceLabel'] = 'Medium';
  if (blend > 0.62) confidenceLabel = 'High';
  else if (blend < 0.42) confidenceLabel = 'Low';

  if (args.hasOpenPosition) {
    return {
      timingState: state,
      timingLabel: label,
      action: 'Entry is live — risk is now path, size, and invalidation vs your plan.',
      reason:
        'Focus on tape vs stop/target; add size only when structure still matches the thesis and your safeguards allow.',
      confidenceLabel,
    };
  }

  let action: string;
  let reason: string;

  switch (state) {
    case 'ready':
      action = 'Prefer limits or scaled bids near plan entry — avoid chasing spikes.';
      reason = 'Timing and score line up for execution if liquidity and spread stay reasonable.';
      break;
    case 'developing':
      action = 'Let the setup finish — wait for confirmation before committing size.';
      reason = 'Structure is still forming; early size increases variance.';
      break;
    case 'early':
      action = 'Wait for a cleaner trigger or a better price pocket vs your plan.';
      reason = 'Conditions are not yet aligned for new risk on this signal.';
      break;
    case 'invalid':
      action = 'Stand down or cut intended size until risk posture improves.';
      reason =
        args.tradeScore < 45
          ? 'Trade quality or sizing flags elevated risk for fresh exposure.'
          : 'Extension or timing suggests poor risk/reward for new entries here.';
      break;
    default:
      action = 'Watch your levels; size only when your rules are satisfied.';
      reason = 'Patience beats forcing entries.';
  }

  if (args.planEntry > 0 && args.lastPrice > 0) {
    const gapPct =
      ((args.side === 'long' ? args.lastPrice - args.planEntry : args.planEntry - args.lastPrice) /
        args.planEntry) *
      100;
    if (Number.isFinite(gapPct) && Math.abs(gapPct) > 0.08) {
      reason += ` Last is ${gapPct >= 0 ? '+' : ''}${gapPct.toFixed(2)}% vs plan entry.`;
    }
  }

  return {
    timingState: state,
    timingLabel: label,
    action,
    reason,
    confidenceLabel,
  };
}
