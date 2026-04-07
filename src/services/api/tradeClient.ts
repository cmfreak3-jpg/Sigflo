import { apiJson } from './http';

export type BybitLinearOrderResponse = {
  ok: true;
  exchange: string;
  orderId: string;
  orderLinkId: string | null;
  note?: string;
};

export async function postBybitLinearOrder(body: {
  symbol: string;
  side: 'Buy' | 'Sell';
  orderType?: 'Market' | 'Limit';
  qty: string;
  reduceOnly?: boolean;
  price?: string;
  positionIdx?: number;
  leverage?: number;
  /** Linear perps: attached TP/SL (market exit when hit). Omitted when unset. */
  takeProfit?: string;
  stopLoss?: string;
}): Promise<BybitLinearOrderResponse> {
  return apiJson<BybitLinearOrderResponse>('/trade/bybit/linear-order', {
    method: 'POST',
    body: JSON.stringify({
      orderType: 'Market',
      ...body,
    }),
  });
}

export async function postBybitSpotOrder(body: {
  symbol: string;
  side: 'Buy' | 'Sell';
  orderType?: 'Market' | 'Limit';
  qty: string;
  marketUnit: 'baseCoin' | 'quoteCoin';
  price?: string;
}): Promise<BybitLinearOrderResponse> {
  return apiJson<BybitLinearOrderResponse>('/trade/bybit/spot-order', {
    method: 'POST',
    body: JSON.stringify({
      orderType: 'Market',
      ...body,
    }),
  });
}
