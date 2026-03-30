/**
 * Format a live quote (last / OHLC) without a currency prefix.
 * Sub-dollar assets use enough fraction digits so values like 0.00334 are not rounded to "0".
 */
export function formatQuoteNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 10_000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (n >= 1) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 0.01) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
}

export function formatQuoteUsd(n: number): string {
  return `$${formatQuoteNumber(n)}`;
}
