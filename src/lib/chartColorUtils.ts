/** Apply alpha to a 6-digit hex color for lightweight-charts price lines. */
export function hexToRgba(hex: string, alpha: number): string {
  const x = hex.replace('#', '').trim();
  if (x.length !== 6) return hex;
  const r = Number.parseInt(x.slice(0, 2), 16);
  const g = Number.parseInt(x.slice(2, 4), 16);
  const b = Number.parseInt(x.slice(4, 6), 16);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r},${g},${b},${a})`;
}
