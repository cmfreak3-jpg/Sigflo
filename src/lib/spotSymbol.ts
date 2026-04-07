/** Base asset for a Bybit v5 spot symbol (e.g. `BTCUSDT` → `BTC`). */
export function spotBaseAssetFromOrderSymbol(orderSymbol: string): string {
  const u = orderSymbol.trim().toUpperCase();
  if (u.endsWith('USDT')) return u.slice(0, -4);
  if (u.endsWith('USDC')) return u.slice(0, -4);
  return u;
}
