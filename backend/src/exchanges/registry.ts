import { BybitAdapter } from './bybit.js';
import { MexcAdapter } from './mexc.js';
import type { ExchangeAdapter, ExchangeId } from './types.js';

const adapters: Record<ExchangeId, ExchangeAdapter> = {
  bybit: new BybitAdapter(),
  mexc: new MexcAdapter(),
};

export function getAdapter(exchange: ExchangeId): ExchangeAdapter {
  return adapters[exchange];
}
