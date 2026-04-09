type WsTopicInterval = '1' | '5' | '15' | '60' | '240' | 'D' | 'W';
type WsConnection = 'connected' | 'reconnecting' | 'disconnected';

export type BybitWsKline = {
  symbol: string;
  interval: WsTopicInterval;
  start: number;
  end: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  confirm: boolean;
  timestamp: number;
};

export type BybitWsTicker = {
  symbol: string;
  lastPrice: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  turnover24h: number;
  price24hPcnt: number;
};

/** Latest print from `publicTrade.{symbol}` — pushes on each trade batch (faster than ticker for last price). */
export type BybitWsPublicTrade = {
  symbol: string;
  price: number;
  /** Exchange trade time (ms). */
  ts: number;
};

export type BybitWsClientOptions = {
  /** Kline topics (detectors / charts). Prefer this over `symbols`. */
  klineSymbols?: string[];
  /**
   * Ticker topics (live last price, 24h stats). Defaults to `klineSymbols` when omitted.
   * Can be a superset (e.g. Movers not in the kline set).
   */
  tickerSymbols?: string[];
  /** @deprecated Use `klineSymbols` */
  symbols?: string[];
  klineIntervals?: WsTopicInterval[];
  includeTickers?: boolean;
  /** `publicTrade.{symbol}` for each `klineSymbols` entry — tick-level last prints. */
  includePublicTrades?: boolean;
  onKline?: (kline: BybitWsKline) => void;
  onTicker?: (ticker: BybitWsTicker) => void;
  onPublicTrade?: (trade: BybitWsPublicTrade) => void;
  onConnectionChange?: (state: WsConnection) => void;
  onLog?: (msg: string) => void;
};

const WS_URL = 'wss://stream.bybit.com/v5/public/linear';

function toNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v);
  return 0;
}

export class BybitWsClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private running = false;
  private readonly options: BybitWsClientOptions;
  private readonly klineSymbols: string[];
  private tickerSymbols: string[];

  constructor(options: BybitWsClientOptions) {
    this.options = options;
    const kline = options.klineSymbols ?? options.symbols;
    if (!kline || kline.length === 0) {
      throw new Error('BybitWsClient: provide klineSymbols or symbols');
    }
    this.klineSymbols = [...kline];
    this.tickerSymbols = [...(options.tickerSymbols ?? kline)];
  }

  /** Add/remove ticker-only subscriptions while keeping kline topics unchanged. */
  updateTickerSymbols(next: string[]) {
    const merged = [...new Set(next)];
    const prev = this.tickerSymbols;
    this.tickerSymbols = merged;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (!this.options.includeTickers) return;
    const toUnsub = prev.filter((s) => !merged.includes(s)).map((s) => `ticker.${s}`);
    const toSub = merged.filter((s) => !prev.includes(s)).map((s) => `ticker.${s}`);
    if (toUnsub.length) {
      this.ws.send(JSON.stringify({ op: 'unsubscribe', args: toUnsub }));
      this.log(`[WS] ticker unsubscribe: ${toUnsub.join(', ')}`);
    }
    if (toSub.length) {
      this.ws.send(JSON.stringify({ op: 'subscribe', args: toSub }));
      this.log(`[WS] ticker subscribe: ${toSub.join(', ')}`);
    }
  }

  connect() {
    this.running = true;
    this.openSocket();
  }

  disconnect() {
    this.running = false;
    if (this.reconnectTimer != null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.options.onConnectionChange?.('disconnected');
    this.ws?.close();
    this.ws = null;
  }

  private log(msg: string) {
    this.options.onLog?.(msg);
  }

  private openSocket() {
    this.log('[WS] connecting');
    const ws = new WebSocket(WS_URL);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.options.onConnectionChange?.('connected');
      this.log('[WS] connected');
      this.subscribe();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as Record<string, unknown>;
        const topic = String(msg.topic ?? '');
        const data = msg.data;
        if (!topic || !data) return;
        if (topic.startsWith('kline.')) this.handleKline(topic, data);
        if (topic.startsWith('ticker.')) this.handleTicker(topic, data);
        if (topic.startsWith('publicTrade.')) this.handlePublicTrade(topic, data);
      } catch {
        // Ignore malformed payloads.
      }
    };

    ws.onclose = () => {
      this.ws = null;
      if (!this.running) return;
      this.options.onConnectionChange?.('reconnecting');
      this.reconnectAttempt += 1;
      const wait = Math.min(30_000, 1_000 * 2 ** Math.min(5, this.reconnectAttempt));
      this.log(`[WS] reconnect attempt ${this.reconnectAttempt} in ${wait}ms`);
      this.reconnectTimer = window.setTimeout(() => this.openSocket(), wait);
    };

    ws.onerror = () => {
      this.log('[WS] error');
    };
  }

  private subscribe() {
    if (!this.ws) return;
    const intervals = this.options.klineIntervals ?? ['5', '15'];
    const klineTopics = this.klineSymbols.flatMap((symbol) => intervals.map((i) => `kline.${i}.${symbol}`));
    const tickerTopics = this.options.includeTickers ? this.tickerSymbols.map((symbol) => `ticker.${symbol}`) : [];
    const tradeTopics = this.options.includePublicTrades
      ? this.klineSymbols.map((symbol) => `publicTrade.${symbol}`)
      : [];
    const args = [...klineTopics, ...tickerTopics, ...tradeTopics];
    this.ws.send(JSON.stringify({ op: 'subscribe', args }));
    this.log(`[WS] subscriptions active: ${args.length} topics`);
  }

  private handleKline(topic: string, data: unknown) {
    const parts = topic.split('.');
    const interval = parts[1] as WsTopicInterval;
    const symbol = parts[2];
    const rows = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
    for (const row of rows) {
      const kline: BybitWsKline = {
        symbol,
        interval,
        start: toNum(row.start),
        end: toNum(row.end),
        open: toNum(row.open),
        high: toNum(row.high),
        low: toNum(row.low),
        close: toNum(row.close),
        volume: toNum(row.volume),
        confirm: Boolean(row.confirm),
        timestamp: toNum(row.timestamp),
      };
      this.options.onKline?.(kline);
    }
  }

  private handleTicker(topic: string, data: unknown) {
    const symbol = topic.split('.')[1] ?? '';
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
    if (!row) return;
    this.options.onTicker?.({
      symbol,
      lastPrice: toNum(row.lastPrice),
      high24h: toNum(row.highPrice24h),
      low24h: toNum(row.lowPrice24h),
      volume24h: toNum(row.volume24h),
      turnover24h: toNum(row.turnover24h),
      price24hPcnt: toNum(row.price24hPcnt),
    });
  }

  /** One callback per WS message using the newest trade in the batch (`data` sorted ascending by time). */
  private handlePublicTrade(topic: string, data: unknown) {
    const symbol = topic.startsWith('publicTrade.') ? topic.slice('publicTrade.'.length) : '';
    if (!symbol) return;
    const rows = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
    if (rows.length === 0) return;
    const last = rows[rows.length - 1];
    const price = toNum(last.p);
    if (!(price > 0)) return;
    const ts = toNum(last.T);
    this.options.onPublicTrade?.({ symbol, price, ts });
  }
}

