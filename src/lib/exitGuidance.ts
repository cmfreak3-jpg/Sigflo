import { formatQuoteGuidance } from '@/lib/formatQuote';
import type { ExitStrategyPreset, ExitStrategyThresholds } from '@/types/aiExitAutomation';

export type ExitState = 'hold' | 'trim' | 'exit';

export type ExitGuidanceConfidence = 'High' | 'Medium' | 'Low';

export type ExitGuidance = {
  state: ExitState;
  headline: string;
  action: string;
  reason: string;
  confidenceLabel: ExitGuidanceConfidence;
  /** Hint price for copy (TP trim or stop reference). */
  referencePrice: number;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function stopPressure(side: 'long' | 'short', entry: number, stop: number, last: number): number {
  if (!(entry > 0) || !(last > 0)) return 0;
  if (side === 'long') {
    const span = entry - stop;
    if (span <= 0) return 0;
    const buf = last - stop;
    if (buf <= 0) return 1;
    return 1 - clamp(buf / span, 0, 1);
  }
  const span = stop - entry;
  if (span <= 0) return 0;
  const buf = stop - last;
  if (buf <= 0) return 1;
  return 1 - clamp(buf / span, 0, 1);
}

function targetProximity(side: 'long' | 'short', entry: number, target: number, last: number): number {
  if (!(entry > 0) || !(last > 0)) return 0;
  if (side === 'long') {
    const span = target - entry;
    if (span <= 0) return 0;
    return clamp((last - entry) / span, 0, 1);
  }
  const span = entry - target;
  if (span <= 0) return 0;
  return clamp((entry - last) / span, 0, 1);
}

function trendMomentum01(trendAlignment: number, momentumQuality: number): number {
  return (clamp(trendAlignment / 25, 0, 1) + clamp(momentumQuality / 20, 0, 1)) / 2;
}

/** Default weights for the `custom` exit strategy (editable in Exit AI when Custom is selected). */
export const DEFAULT_CUSTOM_STRATEGY_THRESHOLDS: ExitStrategyThresholds = {
  stopMain: 0.74,
  stopMid: 0.48,
  stopPnl: -0.8,
  stopPnlSp: 0.38,
  trimMain: 0.7,
  trimMid: 0.42,
  trimMom: 0.44,
  trimLo: 0.36,
  trimPnl: 0.4,
};

function clampTh(n: number, lo: number, hi: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

/** Merge partial user values with defaults and safe bounds (used for persisted JSON). */
export function sanitizeExitStrategyThresholds(
  partial: Partial<ExitStrategyThresholds> | null | undefined,
): ExitStrategyThresholds {
  const d = DEFAULT_CUSTOM_STRATEGY_THRESHOLDS;
  if (!partial) return { ...d };
  return {
    stopMain: clampTh(partial.stopMain ?? d.stopMain, 0.45, 0.95, d.stopMain),
    stopMid: clampTh(partial.stopMid ?? d.stopMid, 0.2, 0.8, d.stopMid),
    stopPnl: clampTh(partial.stopPnl ?? d.stopPnl, -1.5, -0.2, d.stopPnl),
    stopPnlSp: clampTh(partial.stopPnlSp ?? d.stopPnlSp, 0.12, 0.6, d.stopPnlSp),
    trimMain: clampTh(partial.trimMain ?? d.trimMain, 0.45, 0.95, d.trimMain),
    trimMid: clampTh(partial.trimMid ?? d.trimMid, 0.2, 0.8, d.trimMid),
    trimMom: clampTh(partial.trimMom ?? d.trimMom, 0.15, 0.7, d.trimMom),
    trimLo: clampTh(partial.trimLo ?? d.trimLo, 0.15, 0.7, d.trimLo),
    trimPnl: clampTh(partial.trimPnl ?? d.trimPnl, 0.1, 0.85, d.trimPnl),
  };
}

function presetThresholdsNonCustom(preset: ExitStrategyPreset): ExitStrategyThresholds {
  if (preset === 'protect_profit') {
    return {
      stopMain: 0.66,
      stopMid: 0.42,
      stopPnl: -0.65,
      stopPnlSp: 0.34,
      trimMain: 0.58,
      trimMid: 0.36,
      trimMom: 0.48,
      trimLo: 0.3,
      trimPnl: 0.28,
    };
  }
  if (preset === 'trend_follow') {
    return {
      stopMain: 0.82,
      stopMid: 0.54,
      stopPnl: -0.95,
      stopPnlSp: 0.42,
      trimMain: 0.8,
      trimMid: 0.5,
      trimMom: 0.38,
      trimLo: 0.42,
      trimPnl: 0.52,
    };
  }
  if (preset === 'tight_risk') {
    return {
      stopMain: 0.62,
      stopMid: 0.4,
      stopPnl: -0.55,
      stopPnlSp: 0.32,
      trimMain: 0.64,
      trimMid: 0.38,
      trimMom: 0.48,
      trimLo: 0.34,
      trimPnl: 0.35,
    };
  }
  return { ...DEFAULT_CUSTOM_STRATEGY_THRESHOLDS };
}

export function resolveStrategyThresholds(
  preset: ExitStrategyPreset | undefined,
  customPartial: Partial<ExitStrategyThresholds> | null | undefined,
): ExitStrategyThresholds {
  const p = preset ?? 'custom';
  if (p === 'custom') {
    return sanitizeExitStrategyThresholds(customPartial);
  }
  return presetThresholdsNonCustom(p);
}

/**
 * Heuristic exit guidance from price vs plan, trend, and momentum.
 * Updates whenever inputs change (live price, SL/TP, scores).
 */
export function computeExitGuidance(args: {
  side: 'long' | 'short';
  entry: number;
  lastPrice: number;
  stop: number;
  target: number;
  trendAlignment: number;
  momentumQuality: number;
  pnlPct: number;
  /** Optional preset shifts how aggressively trim / exit triggers fire. */
  strategyPreset?: ExitStrategyPreset;
  /** When `strategyPreset === 'custom'`, merges with defaults; ignored for named presets. */
  customStrategyThresholds?: Partial<ExitStrategyThresholds> | null;
}): ExitGuidance {
  const {
    side,
    entry,
    lastPrice,
    stop,
    target,
    trendAlignment,
    momentumQuality,
    pnlPct,
    strategyPreset,
    customStrategyThresholds,
  } = args;

  const sp = stopPressure(side, entry, stop, lastPrice);
  const tp = targetProximity(side, entry, target, lastPrice);
  const th = resolveStrategyThresholds(strategyPreset, strategyPreset === 'custom' ? customStrategyThresholds : null);
  const tm = trendMomentum01(trendAlignment, momentumQuality);

  let state: ExitState;
  let reason: string;
  let confidenceLabel: ExitGuidanceConfidence;
  let referencePrice: number;

  const nearStop =
    sp > th.stopMain || (sp > th.stopMid && tm < 0.32) || (pnlPct < th.stopPnl && sp > th.stopPnlSp);
  const nearTarget =
    tp > th.trimMain || (tp > th.trimMid && tm < th.trimMom) || (tp > th.trimLo && pnlPct > th.trimPnl);

  if (nearStop) {
    state = 'exit';
    reason =
      sp >= 0.9
        ? 'Price is pressing the invalidation zone — setup at risk.'
        : tm < 0.35
          ? 'Momentum fading while price drifts toward stop.'
          : 'Room to stop is thin — protect capital.';
    confidenceLabel = sp > 0.82 || tm < 0.28 ? 'High' : 'Medium';
    referencePrice = stop;
  } else if (nearTarget) {
    state = 'trim';
    const dynamicTrim =
      side === 'long'
        ? target * (1 - 0.0012 * (1 - tm))
        : target * (1 + 0.0012 * (1 - tm));
    referencePrice = dynamicTrim;
    reason =
      tp > 0.78
        ? 'Planned target zone is close — extension may mean-revert.'
        : tm < 0.45
          ? 'Tape softening into resistance — partial de-risk is reasonable.'
          : 'Favorable move — lock in some profit into liquidity.';
    confidenceLabel = tp > 0.75 ? 'High' : 'Medium';
  } else {
    state = 'hold';
    const nudge =
      side === 'long'
        ? target * (1 + 0.0025 * tm)
        : target * (1 - 0.0025 * tm);
    referencePrice = nudge;
    reason =
      tm > 0.55
        ? 'Trend alignment and momentum still support the thesis.'
        : 'No immediate threat to plan — watch for structure breaks.';
    confidenceLabel = tm > 0.5 ? 'High' : tm > 0.35 ? 'Medium' : 'Low';
  }

  /** Hold is a neutral state — no shouty prefix in UI (strip / micro-row skip it). */
  const headline = state === 'hold' ? '' : state === 'trim' ? 'TRIM' : 'EXIT';

  let action: string;
  if (state === 'exit') {
    action = `Cut or tighten — watch ~$${formatQuoteGuidance(stop)}`;
  } else if (state === 'trim') {
    action = `Take profit near ~$${formatQuoteGuidance(referencePrice)}`;
  } else {
    action = `Let it work toward take-profit ~$${formatQuoteGuidance(target)}`;
  }

  return {
    state,
    headline,
    action,
    reason,
    confidenceLabel,
    referencePrice,
  };
}
