export type ExchangeId = 'bybit' | 'mexc';

export type IntegrationStatus = {
  id: string;
  exchange: ExchangeId;
  status: 'connected' | 'invalid';
  lastValidatedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  assets: BalanceItem[];
};

export type ExchangeAccountBreakdown = {
  overview: {
    totalEquity: number | null;
    totalWalletBalance: number | null;
    availableToTrade: number | null;
    /** UTA margin / collateral in use (USD). */
    unifiedMarginInUseUsd?: number | null;
    /** Primary Funding line amount (see `fundingPrimaryAsset`). */
    fundingWalletBalance?: number | null;
    /** e.g. AUD, USDT — use with `fundingWalletBalance` for display. */
    fundingPrimaryAsset?: string | null;
  };
  buckets: AccountBucketSnapshot[];
};

export type PositionItem = {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice?: number;
  unrealizedPnl?: number;
  positionIM?: number;
  leverage?: number;
  liqPrice?: number;
  positionIdx?: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  openedAtMs?: number;
};

export type ExchangeSnapshot = {
  exchange: ExchangeId;
  status: 'connected' | 'error';
  balances: BalanceItem[];
  positions: PositionItem[];
  accountBreakdown?: ExchangeAccountBreakdown | null;
};

/** Closed linear PnL row from `/api/portfolio/closed-trades`. */
export type ClosedTradeRow = {
  exchange: ExchangeId;
  symbol: string;
  closedPnl: number;
  closedAt: string;
  orderId?: string;
};
