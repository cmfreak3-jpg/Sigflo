/** Base-coin qty string for Bybit linear `qty` (no scientific notation). */
export function linearQtyFromNotionalUsd(notionalUsd: number, priceUsd: number, maxDecimals = 8): string {
  if (!(notionalUsd > 0) || !(priceUsd > 0)) return '0';
  const raw = notionalUsd / priceUsd;
  const s = raw.toFixed(maxDecimals).replace(/\.?0+$/, '');
  return s === '' ? '0' : s;
}

export function linearQtyFromBaseAmount(base: number, maxDecimals = 8): string {
  if (!Number.isFinite(base) || base <= 0) return '0';
  const s = base.toFixed(maxDecimals).replace(/\.?0+$/, '');
  return s === '' ? '0' : s;
}

/** Quote (e.g. USDT) amount for Bybit spot market `Buy` with `marketUnit: quoteCoin`. */
export function spotQuoteQtyFromUsd(usd: number, maxDecimals = 2): string {
  if (!(usd > 0)) return '0';
  const s = usd.toFixed(maxDecimals).replace(/\.?0+$/, '');
  return s === '' ? '0' : s;
}
