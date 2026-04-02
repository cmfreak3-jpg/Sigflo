import { redactUnknown } from './redact.js';

type Level = 'info' | 'warn' | 'error';

export function log(level: Level, message: string, meta?: unknown) {
  const payload = meta === undefined ? undefined : redactUnknown(meta);
  const line = payload ? `${message} ${JSON.stringify(payload)}` : message;
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
}
