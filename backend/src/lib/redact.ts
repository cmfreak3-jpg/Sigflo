const SECRET_KEYS = ['apikey', 'apisecret', 'passphrase', 'authorization', 'token', 'jwt'];

function redactString(input: string): string {
  if (input.length <= 8) return '[REDACTED]';
  return `${input.slice(0, 3)}***${input.slice(-2)}`;
}

export function redactUnknown(value: unknown): unknown {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(redactUnknown);
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (SECRET_KEYS.some((s) => k.toLowerCase().includes(s))) {
      out[k] = typeof v === 'string' ? redactString(v) : '[REDACTED]';
    } else {
      out[k] = redactUnknown(v);
    }
  }
  return out;
}
