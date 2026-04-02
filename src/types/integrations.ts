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

export type PositionItem = {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice?: number;
  unrealizedPnl?: number;
};

export type ExchangeSnapshot = {
  exchange: ExchangeId;
  status: 'connected' | 'error';
  balances: BalanceItem[];
  positions: PositionItem[];
};

/** Closed linear PnL row from `/api/portfolio/closed-trades`. */
export type ClosedTradeRow = {
  exchange: ExchangeId;
  symbol: string;
  closedPnl: number;
  closedAt: string;
  orderId?: string;
};
