export type ExchangeId = 'bybit' | 'mexc';

export type ConnectInput = {
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
};

export type PermissionCheck = {
  readOnly: boolean;
  withdrawalsEnabled: boolean;
  canReadBalances: boolean;
  canReadPositions: boolean;
  raw: unknown;
};

export type ValidationResult = {
  ok: boolean;
  message: string;
  permission: PermissionCheck;
};

export type BalanceItem = {
  asset: string;
  free: number;
  locked: number;
  total: number;
};

export type PositionItem = {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice?: number;
  unrealizedPnl?: number;
};

/** One closed position PnL row from the exchange (e.g. Bybit linear closed-pnl). */
export type ClosedTradeItem = {
  symbol: string;
  closedPnl: number;
  /** ISO 8601 */
  closedAt: string;
  orderId?: string;
};

export interface ExchangeAdapter {
  readonly id: ExchangeId;
  validateReadOnly(input: ConnectInput): Promise<ValidationResult>;
  fetchBalances(input: ConnectInput): Promise<BalanceItem[]>;
  fetchPositions(input: ConnectInput): Promise<PositionItem[]>;
  /** Recent closed PnL rows; empty if unsupported for this venue. */
  fetchClosedTrades(input: ConnectInput, opts?: { limit?: number }): Promise<ClosedTradeItem[]>;
}
