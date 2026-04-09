import type { ResolvedExitGuidanceFlow } from '@/lib/tradeExitGuidanceFlow';

export type ExitFlowDisplayStash = {
  displayed: ResolvedExitGuidanceFlow;
  pendingHoldUntil: number | null;
};

/** How long raw `hold` must persist before we hide a prior trim/exit bar (reduces flicker on threshold chatter). */
export const EXIT_FLOW_HOLD_SETTLE_MS = 900;

export function nextExitFlowForDisplay(
  stash: ExitFlowDisplayStash | null,
  rawNext: ResolvedExitGuidanceFlow,
  nowMs: number,
  holdSettleMs: number = EXIT_FLOW_HOLD_SETTLE_MS,
): ExitFlowDisplayStash {
  if (!stash) {
    return { displayed: rawNext, pendingHoldUntil: null };
  }

  const nextState = rawNext.effective.state;
  if (nextState === 'trim' || nextState === 'exit') {
    return { displayed: rawNext, pendingHoldUntil: null };
  }

  const dispState = stash.displayed.effective.state;
  if (dispState === 'hold') {
    return { displayed: rawNext, pendingHoldUntil: null };
  }

  if (stash.pendingHoldUntil == null) {
    return { displayed: stash.displayed, pendingHoldUntil: nowMs + holdSettleMs };
  }
  if (nowMs < stash.pendingHoldUntil) {
    return { displayed: stash.displayed, pendingHoldUntil: stash.pendingHoldUntil };
  }
  return { displayed: rawNext, pendingHoldUntil: null };
}
