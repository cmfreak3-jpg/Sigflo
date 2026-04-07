/**
 * Format a Funding / wallet line without assuming USD (e.g. Bybit Funding can be AUD, EUR, USDT, …).
 */
export function formatFundingBalance(amount: number, asset: string | null | undefined): string {
  if (!Number.isFinite(amount)) return '—';
  const a = (asset ?? 'USDT').toUpperCase();
  if (a === 'USDT' || a === 'USDC' || a === 'USD' || a === 'BUSD') {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (a === 'AUD') {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
  }
  if (a === 'EUR') {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
  }
  if (a === 'GBP') {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
  }
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${a}`;
}
