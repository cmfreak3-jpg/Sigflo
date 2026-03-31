import { useEffect, useRef, useState } from 'react';

/**
 * Returns `true` briefly when state transitions from non-triggered -> triggered.
 * Used for one-shot premium trigger animations (border pulse, dot pop, entry highlight).
 */
export function useTriggeredMotion(isTriggered: boolean, durationMs = 900): boolean {
  const [justTriggered, setJustTriggered] = useState(false);
  const prevTriggeredRef = useRef(isTriggered);

  useEffect(() => {
    const wasTriggered = prevTriggeredRef.current;
    prevTriggeredRef.current = isTriggered;
    if (!isTriggered || wasTriggered) return;
    setJustTriggered(true);
    const t = window.setTimeout(() => setJustTriggered(false), durationMs);
    return () => window.clearTimeout(t);
  }, [durationMs, isTriggered]);

  return justTriggered;
}
