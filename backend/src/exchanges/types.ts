export type ExchangeId = 'bybit' | 'mexc';

export type ConnectInput = {
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
};

export type PermissionCheck = {
  /** True when the exchange marks the key as read-only (Bybit: `readOnly === 1`). False = trade-capable key. */
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

export type AccountBucketKind = 'funding' | 'unified' | 'spot' | 'derivatives';

export type AccountBucketMetrics = {
  availableBalance: number | null;
  walletBalance: number | null;
  equity: number | null;
  marginBalance: number | null;
  marginUsed: number | null;
  unrealizedPnl: number | null;
};

export type AccountBucketSnapshot = {
  kind: AccountBucketKind;
  label: string;
  helperText: string;
  metrics: AccountBucketMetrics;
  /** Top non-zero assets in this bucket, sorted by total descending. */
  assets: BalanceItem[];
};

export type AccountOverview = {
  totalEquity: number | null;
  totalWalletBalance: number | null;
  availableToTrade: number | null;
  /** Approx. margin / collateral locked in the unified trading account (USD). */
  unifiedMarginInUseUsd: number | null;
  /** Primary Funding wallet line amount (numeric; pair with `fundingPrimaryAsset`). */
  fundingWalletBalance: number | null;
  /** Asset code for `fundingWalletBalance` (e.g. AUD, USDT). */
  fundingPrimaryAsset: string | null;
};

export type ExchangeAccountBreakdown = {
  overview: AccountOverview;
  buckets: AccountBucketSnapshot[];
};

export type PositionItem = {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice?: number;
  unrealizedPnl?: number;
  /** Initial margin (USD terms) for ROE; from Bybit `positionIM`. */
  positionIM?: number;
  leverage?: number;
  liqPrice?: number;
  positionIdx?: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  /** First open time on symbol (ms), from Bybit `createdTime`. */
  openedAtMs?: number;
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
  /** Optional richer account model (bucketed balances + key metrics) when the venue supports it. */
  fetchAccountBreakdown?(input: ConnectInput): Promise<ExchangeAccountBreakdown | null>;
  fetchPositions(input: ConnectInput): Promise<PositionItem[]>;
  /** Recent closed PnL rows; empty if unsupported for this venue. */
  fetchClosedTrades(input: ConnectInput, opts?: { limit?: number }): Promise<ClosedTradeItem[]>;
}
