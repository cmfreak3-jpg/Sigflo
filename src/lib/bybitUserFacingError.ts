/**
 * Maps Bybit `retMsg` (and our backend `Bybit error: …` wrappers) to short, actionable toast copy.
 * Unknown messages pass through unchanged.
 */
export function formatBybitTradeErrorMessage(err: unknown, fallback = 'Request failed'): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  const s = raw.trim();
  if (!s) return fallback;

  const stripped = s
    .replace(/^Bybit error:\s*/i, '')
    .replace(/^Bybit HTTP \d+:\s*/i, '')
    .replace(/^Request failed: HTTP \d+ —\s*/i, '')
    .trim();
  const low = stripped.toLowerCase();

  if (
    low.includes('ab not enough') ||
    low.includes('not enough for new order') ||
    low.includes('available balance not enough') ||
    (low.includes('insufficient') && low.includes('margin'))
  ) {
    return 'Not enough available margin on Bybit for this order. Try a smaller size or lower leverage, or free margin (other positions/orders lock collateral). Available is what remains for new orders.';
  }

  if (low.includes('insufficient balance')) {
    return 'Insufficient balance on Bybit for this order. Check unified trading available funds, not only total equity.';
  }

  if (low.includes('qty') && (low.includes('invalid') || low.includes('too large') || low.includes('too small'))) {
    return 'Order size did not meet Bybit rules (min, max, or step). Adjust size and try again.';
  }

  if (low.includes('position idx') || low.includes('positionidx') || low.includes('position mode')) {
    return 'Bybit rejected this for your position mode (one-way vs hedge). Check hedge settings on the exchange.';
  }

  if (low.includes('read only') || low.includes('readonly') || low.includes('permission denied')) {
    return 'This API key cannot trade on Bybit. Connect a read/write key in Account.';
  }

  if (low.includes('leverage') && (low.includes('not modified') || low.includes('invalid'))) {
    return 'Bybit could not apply that leverage for this symbol. Lower leverage or set it on the exchange, then retry.';
  }

  if (low.includes('reduce only') && low.includes('reject')) {
    return 'Bybit rejected a reduce-only constraint. Confirm you are closing/reducing the correct side.';
  }

  if (low.includes('tp') && low.includes('sl') && (low.includes('invalid') || low.includes('reject'))) {
    return 'Take-profit or stop-loss did not pass Bybit checks (price side vs position). Adjust levels and try again.';
  }

  if (low.includes('rate limit') || low.includes('too many requests')) {
    return 'Bybit rate limit — wait a few seconds and try again.';
  }

  return s;
}
