import { useCallback, useEffect, useRef, type MouseEvent } from 'react';

const DEFAULT_DELAY_MS = 420;
const DEFAULT_INTERVAL_MS = 52;

type HoldStepperOptions = {
  /** Delay before rapid repeat starts (ms). */
  delayMs?: number;
  /** Interval between steps while holding (ms). */
  intervalMs?: number;
};

/**
 * Pointer hold-to-repeat for +/- steppers: short tap = one step; hold = step after delay then repeat.
 * Suppresses the extra synthetic `click` after pointer so mouse taps do not double-step; keyboard (Space/Enter) still fires one step via `onClick`.
 */
export function useHoldStepper(onStep: () => void, options?: HoldStepperOptions) {
  const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;

  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  const delayTimerRef = useRef<number | null>(null);
  const intervalTimerRef = useRef<number | null>(null);
  const repeatStartedRef = useRef(false);
  const usedPointerRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (delayTimerRef.current != null) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
    if (intervalTimerRef.current != null) {
      clearInterval(intervalTimerRef.current);
      intervalTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const beginHold = useCallback(() => {
    usedPointerRef.current = true;
    clearTimers();
    repeatStartedRef.current = false;
    delayTimerRef.current = window.setTimeout(() => {
      repeatStartedRef.current = true;
      onStepRef.current();
      intervalTimerRef.current = window.setInterval(() => {
        onStepRef.current();
      }, intervalMs);
    }, delayMs);
  }, [clearTimers, delayMs, intervalMs]);

  const endHold = useCallback(() => {
    const hadRepeat = repeatStartedRef.current;
    clearTimers();
    repeatStartedRef.current = false;
    if (!hadRepeat) {
      onStepRef.current();
    }
  }, [clearTimers]);

  const onClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      if (usedPointerRef.current) {
        usedPointerRef.current = false;
        e.preventDefault();
        return;
      }
      onStepRef.current();
    },
    [],
  );

  return {
    onPointerDown: beginHold,
    onPointerUp: endHold,
    onPointerLeave: endHold,
    onPointerCancel: endHold,
    onClick,
  };
}
