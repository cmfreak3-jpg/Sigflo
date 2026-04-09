import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { runScannerDeterminismCheck } from '@/engine/scannerDeterminism';
import { BybitWsClient } from '@/lib/bybitWsClient';
import { buildSignalFromMarket, inferMarketRegime } from '@/lib/signalDetectors';
import { atr } from '@/lib/indicators';
import {
  fetchKlines,
  fetchTickers,
} from '@/services/bybit/client';
import { TRACKED_SYMBOLS } from '@/lib/marketScannerRows';
import type { BybitWsTicker } from '@/lib/bybitWsClient';
import type { Candle, KlineInterval, SymbolTicker } from '@/types/market';
import type { CryptoSignal } from '@/types/signal';

export type SignalEngineState = {
  signals: CryptoSignal[];
  loading: boolean;
  mode: 'REST' | 'WS' | 'OFFLINE';
  connection: 'connected' | 'reconnecting' | 'disconnected';
  error?: string;
  /** WS-backed last prices for streamed symbols (Markets / Feed overlay). */
  liveTickersBySymbol: Record<string, SymbolTicker>;
  /** Top Movers symbols (not in Tracked) get live ticker WS subscriptions. */
  setScannerTickerExtras: (symbols: string[]) => void;
};

const COOLDOWN_MS = 45 * 60 * 1000;
const SCORE_IMPROVE_BYPASS = 8;
const ATR_MOVE_BYPASS = 0.8;
/** Same as Markets Tracked list — WS klines + tickers for live scanner + detectors. */
const STREAM_SYMBOLS: string[] = [...TRACKED_SYMBOLS];

function wsTickerToSymbolTicker(t: BybitWsTicker): SymbolTicker {
  return {
    symbol: t.symbol,
    lastPrice: t.lastPrice,
    high24h: t.high24h,
    low24h: t.low24h,
    volume24h: t.volume24h,
    turnover24h: t.turnover24h,
    price24hPcnt: t.price24hPcnt,
  };
}

type CandleStore = Record<string, Record<KlineInterval, Candle[]>>;

function emptyIntervalCandles(): Record<KlineInterval, Candle[]> {
  return {
    '1': [],
    '5': [],
    '15': [],
    '60': [],
    '240': [],
    D: [],
    W: [],
  };
}

function upsertCandle(store: Candle[], next: Candle): Candle[] {
  const out = [...store];
  const last = out.at(-1);
  if (!last || next.ts > last.ts) out.push(next);
  else if (next.ts === last.ts) out[out.length - 1] = next;
  return out.slice(-240);
}

export function useSignalEngine(): SignalEngineState {
  const [state, setState] = useState<Omit<SignalEngineState, 'liveTickersBySymbol' | 'setScannerTickerExtras'>>({
    signals: [],
    loading: true,
    mode: 'REST',
    connection: 'disconnected',
  });
  const [liveTickersBySymbol, setLiveTickersBySymbol] = useState<Record<string, SymbolTicker>>({});
  const [scannerTickerExtras, setScannerTickerExtras] = useState<string[]>([]);
  const mergedTickerSymbols = useMemo(
    () => [...new Set([...STREAM_SYMBOLS, ...scannerTickerExtras])],
    [scannerTickerExtras],
  );
  const setScannerTickerExtrasStable = useCallback((symbols: string[]) => {
    setScannerTickerExtras(symbols);
  }, []);
  const lastSignalRef = useRef<Record<string, { emittedAt: number; setupScore: number; refPrice: number; atr: number }>>({});
  const signalBookRef = useRef<Record<string, CryptoSignal>>({});
  const candlesRef = useRef<CandleStore>({});
  const tickersRef = useRef<Record<string, SymbolTicker>>({});
  const wsConnectedRef = useRef(false);
  const streamReadyRef = useRef(false);
  const didPrintDeterminismRef = useRef(false);
  const tickerFlushRafRef = useRef<number | null>(null);
  const wsClientRef = useRef<BybitWsClient | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (import.meta.env.DEV && !didPrintDeterminismRef.current) {
      didPrintDeterminismRef.current = true;
      const check = runScannerDeterminismCheck();
      // Dev-only visibility: verifies deterministic first pass and cooldown/dedup on second pass.
      console.log('[Sigflo][Engine] determinism pass 1', check.firstPass);
      console.log('[Sigflo][Engine] determinism pass 2', check.secondPass);
    }

    function pushState(mode: SignalEngineState['mode'], connection: SignalEngineState['connection'], error?: string) {
      const ranked = Object.values(signalBookRef.current).sort((a, b) => b.setupScore - a.setupScore);
      setState({
        signals: ranked,
        loading: false,
        // Reflect transport/data source truth even when no setups are currently emitted.
        mode,
        connection,
        error,
      });
    }

    // REST bootstrap / reconnect catch-up:
    // - backfill candles and tickers
    // - refresh in-memory stores
    // - run detector pipeline against fresh snapshots
    async function backfillFromRest(reason: 'startup' | 'reconnect') {
      console.log(`[Sigflo][Engine] REST bootstrap (${reason})`);
      streamReadyRef.current = false;
      try {
        const tickers = await fetchTickers(STREAM_SYMBOLS);
        for (const ticker of tickers) tickersRef.current[ticker.symbol] = ticker;
        for (const symbol of STREAM_SYMBOLS) {
          const [candles5m, candles15m] = await Promise.all([
            fetchKlines(symbol, '5', 240),
            fetchKlines(symbol, '15', 240),
          ]);
          candlesRef.current[symbol] = {
            ...emptyIntervalCandles(),
            ...candlesRef.current[symbol],
            '5': candles5m,
            '15': candles15m,
          };
        }
        recomputeAllFromStore('REST');
        if (cancelled) return;
        streamReadyRef.current = true;
        setLiveTickersBySymbol({ ...tickersRef.current });
        pushState('REST', wsConnectedRef.current ? 'connected' : 'disconnected');
      } catch (err) {
        if (cancelled) return;
        pushState('OFFLINE', wsConnectedRef.current ? 'reconnecting' : 'disconnected', err instanceof Error ? err.message : 'Signal engine failed');
      }
    }

    function recomputeForSymbol(symbol: string, mode: SignalEngineState['mode']) {
      const symbolCandles = candlesRef.current[symbol];
      const ticker = tickersRef.current[symbol];
      if (!symbolCandles || !ticker || symbolCandles['15'].length < 60) return;
      const btc15 = candlesRef.current.BTCUSDT?.['15'] ?? [];
      const eth15 = candlesRef.current.ETHUSDT?.['15'] ?? [];
      if (btc15.length < 60 || eth15.length < 60) return;
      const regime = inferMarketRegime({ btc15m: btc15, eth15m: eth15 });
      const signal = buildSignalFromMarket({
        symbol,
        exchange: 'Bybit',
        ticker,
        candles15m: symbolCandles['15'],
        regime,
      });
      if (!signal) return;
      const key = `${symbol}:${signal.setupType}`;
      const now = Date.now();
      const prev = lastSignalRef.current[key];
      const atrNow = Math.max(0.000001, atr(symbolCandles['15'], 14).at(-1) ?? 1);
      const priceNow = ticker.lastPrice;
      const scoreImproved = prev ? signal.setupScore - prev.setupScore >= SCORE_IMPROVE_BYPASS : false;
      const priceMoved = prev ? Math.abs(priceNow - prev.refPrice) / Math.max(prev.atr, 0.000001) >= ATR_MOVE_BYPASS : false;
      const cooldownPassed = !prev || now - prev.emittedAt >= COOLDOWN_MS;
      if (!(cooldownPassed || scoreImproved || priceMoved)) return;
      lastSignalRef.current[key] = { emittedAt: now, setupScore: signal.setupScore, refPrice: priceNow, atr: atrNow };
      signalBookRef.current[key] = signal;
      console.log(`[Sigflo][Engine] detector triggered ${symbol} ${signal.setupType} ${signal.setupScore}`);
      pushState(mode, wsConnectedRef.current ? 'connected' : 'disconnected');
    }

    function recomputeAllFromStore(mode: SignalEngineState['mode']) {
      for (const symbol of STREAM_SYMBOLS) recomputeForSymbol(symbol, mode);
    }

    // WS stream:
    // - keep tickers fresh
    // - process closed candles only
    // - feed 15m closed bars through detector pipeline
    const ws = new BybitWsClient({
      klineSymbols: STREAM_SYMBOLS,
      tickerSymbols: STREAM_SYMBOLS,
      includeTickers: true,
      onLog: (msg) => console.log(`[Sigflo][Engine] ${msg}`),
      onConnectionChange: (connection) => {
        wsConnectedRef.current = connection === 'connected';
        if (connection === 'connected') {
          void backfillFromRest('reconnect');
          pushState('WS', 'connected');
          return;
        }
        pushState(streamReadyRef.current ? 'REST' : 'OFFLINE', connection);
      },
      onTicker: (ticker) => {
        const mapped = wsTickerToSymbolTicker(ticker);
        tickersRef.current[ticker.symbol] = mapped;
        if (tickerFlushRafRef.current != null) return;
        tickerFlushRafRef.current = window.requestAnimationFrame(() => {
          tickerFlushRafRef.current = null;
          setLiveTickersBySymbol({ ...tickersRef.current });
        });
      },
      onKline: (kline) => {
        const interval = kline.interval as KlineInterval;
        const symbol = kline.symbol;
        if (!candlesRef.current[symbol]) candlesRef.current[symbol] = emptyIntervalCandles();
        candlesRef.current[symbol][interval] = upsertCandle(candlesRef.current[symbol][interval], {
          ts: kline.start,
          open: kline.open,
          high: kline.high,
          low: kline.low,
          close: kline.close,
          volume: kline.volume,
          isClosed: kline.confirm,
        });
        // Closed-candle event is the only trigger input for signal generation.
        if (!kline.confirm) return;
        console.log(`[Sigflo][Engine] closed candle received ${symbol} ${interval}`);
        if (!streamReadyRef.current) return;
        if (interval === '15') recomputeForSymbol(symbol, 'WS');
      },
    });
    wsClientRef.current = ws;

    void backfillFromRest('startup').then(() => {
      ws.connect();
    });

    return () => {
      cancelled = true;
      if (tickerFlushRafRef.current != null) {
        window.cancelAnimationFrame(tickerFlushRafRef.current);
        tickerFlushRafRef.current = null;
      }
      ws.disconnect();
      wsClientRef.current = null;
    };
  }, []);

  useEffect(() => {
    wsClientRef.current?.updateTickerSymbols(mergedTickerSymbols);
  }, [mergedTickerSymbols]);

  return useMemo(
    () => ({
      ...state,
      liveTickersBySymbol,
      setScannerTickerExtras: setScannerTickerExtrasStable,
    }),
    [state, liveTickersBySymbol, setScannerTickerExtrasStable],
  );
}
