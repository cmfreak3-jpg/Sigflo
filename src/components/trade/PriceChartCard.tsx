import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { formatQuoteUsd } from '@/lib/formatQuote';
import type { MarketMode, TradeViewModel } from '@/types/trade';

type LevelKey = 'last' | 'entry' | 'stop' | 'target' | 'liquidation';

const levelStyles: Record<
  LevelKey,
  { label: string; stroke: string; labelClass: string }
> = {
  last: { label: 'Last', stroke: '#22d3ee', labelClass: 'text-cyan-300' },
  entry: { label: 'Entry', stroke: '#34d399', labelClass: 'text-emerald-300' },
  stop: { label: 'Stop', stroke: '#f87171', labelClass: 'text-rose-300' },
  target: { label: 'Target', stroke: '#a7f3d0', labelClass: 'text-emerald-200' },
  liquidation: { label: 'Liq.', stroke: '#fbbf24', labelClass: 'text-amber-200' },
};

function toUtcTime(tsMs: number): UTCTimestamp {
  return Math.floor(tsMs / 1000) as UTCTimestamp;
}

export function PriceChartCard({
  model,
  market,
  intervalLabel,
  loadingInterval,
  liveUpdatedAt,
}: {
  model: TradeViewModel;
  market: MarketMode;
  intervalLabel?: string;
  loadingInterval?: boolean;
  liveUpdatedAt?: number;
}) {
  const showLiquidation = market === 'futures';
  const [showVolume, setShowVolume] = useState(true);
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | 'flat'>('flat');
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const priceLineByKeyRef = useRef<Partial<Record<LevelKey, ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']>>>>({});
  const [visibleLevels, setVisibleLevels] = useState<Record<LevelKey, boolean>>({
    last: false,
    entry: false,
    stop: false,
    target: false,
    liquidation: false,
  });

  const visibleLevelKeys = useMemo(
    () =>
      (Object.keys(levelStyles) as LevelKey[])
        .filter((key) => (key === 'liquidation' ? showLiquidation : true))
        .filter((key) => visibleLevels[key]),
    [showLiquidation, visibleLevels],
  );

  const liveTime = liveUpdatedAt
    ? new Date(liveUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;
  const prevPriceRef = useRef<number>(model.lastPrice);
  /** Avoid full setData + fitContent on every tick; update last bar only when same candle. */
  const candleStructRef = useRef<{ len: number; lastTs: number } | null>(null);
  /** Only auto-fit when pair/interval changes or first paint — not on every new candle (preserves zoom). */
  const chartViewKeyRef = useRef<string>('');
  const didFitContentRef = useRef(false);

  const staticLevelPrices = useMemo(
    () =>
      ({
        entry: model.entry,
        stop: model.stop,
        target: model.target,
        liquidation: model.liquidation,
      }) as const,
    [model.entry, model.liquidation, model.stop, model.target],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const chart = createChart(host, {
      autoSize: true,
      height: 220,
      layout: {
        background: { type: ColorType.Solid, color: 'rgba(12,12,15,0.9)' },
        textColor: 'rgba(148,163,184,0.9)',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.06)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.12)',
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.12)',
        rightOffset: 1,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#34d399',
      downColor: '#f87171',
      borderUpColor: '#34d399',
      borderDownColor: '#f87171',
      wickUpColor: '#34d399',
      wickDownColor: '#f87171',
      lastValueVisible: true,
      priceLineVisible: true,
    });
    const lineSeries = chart.addSeries(LineSeries, {
      color: '#22d3ee',
      lineWidth: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: true,
      priceLineVisible: true,
    });
    const volSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: '',
      priceFormat: { type: 'volume' },
      lastValueVisible: false,
      priceLineVisible: false,
    });
    volSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    chartRef.current = chart;
    candleRef.current = candleSeries;
    lineRef.current = lineSeries;
    volRef.current = volSeries;

    return () => {
      priceLineByKeyRef.current = {};
      chartViewKeyRef.current = '';
      didFitContentRef.current = false;
      candleStructRef.current = null;
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      lineRef.current = null;
      volRef.current = null;
    };
  }, []);

  useEffect(() => {
    const candleSeries = candleRef.current;
    const lineSeries = lineRef.current;
    const volSeries = volRef.current;
    if (!candleSeries || !lineSeries || !volSeries) return;

    const viewKey = `${model.pair}|${intervalLabel ?? ''}`;
    if (chartViewKeyRef.current !== viewKey) {
      chartViewKeyRef.current = viewKey;
      didFitContentRef.current = false;
      candleStructRef.current = null;
    }

    const candles = model.chartCandles ?? [];
    if (candles.length > 10) {
      const last = candles[candles.length - 1];
      const struct = candleStructRef.current;
      const sameCandle =
        last &&
        struct &&
        struct.len === candles.length &&
        struct.lastTs === last.ts;

      if (sameCandle && last) {
        const t = toUtcTime(last.ts) as Time;
        candleSeries.update({
          time: t,
          open: last.open,
          high: last.high,
          low: last.low,
          close: last.close,
        });
        volSeries.update({
          time: t,
          value: last.volume ?? 0,
          color: last.close >= last.open ? 'rgba(52,211,153,0.30)' : 'rgba(248,113,113,0.30)',
        });
        chartRef.current?.timeScale().scrollToRealTime();
      } else {
        const chart = chartRef.current;
        const ts = chart?.timeScale();

        candleSeries.setData(
          candles.map((c) => ({
            time: toUtcTime(c.ts) as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          })),
        );
        volSeries.setData(
          candles.map((c) => ({
            time: toUtcTime(c.ts) as Time,
            value: c.volume ?? 0,
            color: c.close >= c.open ? 'rgba(52,211,153,0.30)' : 'rgba(248,113,113,0.30)',
          })),
        );
        lineSeries.setData([]);
        if (last) {
          candleStructRef.current = { len: candles.length, lastTs: last.ts };
        }
        if (!didFitContentRef.current) {
          ts?.fitContent();
          didFitContentRef.current = true;
        }
        ts?.scrollToRealTime();
      }
    } else {
      candleStructRef.current = null;
      const chart = chartRef.current;
      const ts = chart?.timeScale();

      const base = model.lastPrice;
      const series = model.priceSeries.map((v, i) => ({
        time: (Math.floor(Date.now() / 1000) - (model.priceSeries.length - i) * 60) as Time,
        value: base * (0.985 + v * 0.03),
      }));
      lineSeries.setData(series);
      candleSeries.setData([]);
      volSeries.setData([]);
      if (!didFitContentRef.current) {
        ts?.fitContent();
        didFitContentRef.current = true;
      }
      ts?.scrollToRealTime();
    }
  }, [intervalLabel, model.chartCandles, model.lastPrice, model.pair, model.priceSeries]);

  useEffect(() => {
    const prev = prevPriceRef.current;
    if (model.lastPrice > prev) setPriceDirection('up');
    else if (model.lastPrice < prev) setPriceDirection('down');
    else setPriceDirection('flat');
    prevPriceRef.current = model.lastPrice;
  }, [model.lastPrice]);

  useEffect(() => {
    const candleSeries = candleRef.current;
    if (!candleSeries) return;

    const want = new Set(visibleLevelKeys);
    for (const key of Object.keys(priceLineByKeyRef.current) as LevelKey[]) {
      if (!want.has(key)) {
        const line = priceLineByKeyRef.current[key];
        if (line) candleSeries.removePriceLine(line);
        delete priceLineByKeyRef.current[key];
      }
    }

    for (const key of visibleLevelKeys) {
      if (key === 'last') {
        if (!priceLineByKeyRef.current.last) {
          const style = levelStyles.last;
          priceLineByKeyRef.current.last = candleSeries.createPriceLine({
            price: model.lastPrice,
            color: style.stroke,
            lineWidth: 1,
            axisLabelVisible: true,
            title: style.label,
          });
        }
        continue;
      }
      const style = levelStyles[key];
      const price = staticLevelPrices[key];
      const existing = priceLineByKeyRef.current[key];
      if (existing) {
        existing.applyOptions({
          price,
          color: style.stroke,
          lineWidth: key === 'entry' ? 2 : 1,
          title: style.label,
        });
      } else {
        priceLineByKeyRef.current[key] = candleSeries.createPriceLine({
          price,
          color: style.stroke,
          lineWidth: key === 'entry' ? 2 : 1,
          axisLabelVisible: true,
          title: style.label,
        });
      }
    }
  }, [staticLevelPrices, visibleLevelKeys]);

  useEffect(() => {
    const line = priceLineByKeyRef.current.last;
    if (!line || !visibleLevels.last) return;
    line.applyOptions({ price: model.lastPrice });
  }, [model.lastPrice, visibleLevels.last]);

  useEffect(() => {
    const vol = volRef.current;
    if (!vol) return;
    vol.applyOptions({ visible: showVolume });
  }, [showVolume]);

  return (
    <Card className="overflow-hidden p-4">
      <div className="flex items-center justify-between">
        <h2
          className={`text-sm font-semibold transition-colors ${
            priceDirection === 'up' ? 'text-emerald-300' : priceDirection === 'down' ? 'text-rose-300' : 'text-white'
          }`}
        >
          {formatQuoteUsd(model.lastPrice)}
        </h2>
        <div className="inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] text-sigflo-muted">
            Live {intervalLabel ?? '5m'} + overlays
            {liveTime ? (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-emerald-200">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                {liveTime}
              </span>
            ) : null}
            {loadingInterval ? (
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-cyan-400/35 bg-cyan-500/10 text-cyan-200">
                <svg viewBox="0 0 24 24" className="h-3 w-3 animate-spin" fill="none" aria-label="Loading interval">
                  <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" opacity="0.35" />
                  <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
            ) : null}
          </span>
        </div>
      </div>
      <div
        ref={hostRef}
        className="mt-3 h-[220px] w-full overflow-hidden rounded-xl border border-white/5"
      />
      <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
        <button
          type="button"
          onClick={() => setShowVolume((v) => !v)}
          className={`rounded-md px-2 py-0.5 transition ${
            showVolume
              ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/30'
              : 'bg-white/[0.04] text-sigflo-muted'
          }`}
          aria-pressed={showVolume}
          aria-label="Toggle volume bars"
        >
          Vol
        </button>
        {(Object.keys(levelStyles) as LevelKey[])
          .filter((key) => (key === 'liquidation' ? showLiquidation : true))
          .map((key) => (
            <button
              key={key}
              type="button"
              onClick={() =>
                setVisibleLevels((prev) => ({
                  ...prev,
                  [key]: !prev[key],
                }))
              }
              className={`rounded-md px-2 py-0.5 transition ${
                visibleLevels[key]
                  ? `${levelStyles[key].labelClass} bg-white/[0.08] ring-1 ring-white/15`
                  : 'bg-white/[0.03] text-sigflo-muted'
              }`}
              aria-pressed={visibleLevels[key]}
              aria-label={`Toggle ${levelStyles[key].label} level`}
            >
              {levelStyles[key].label}
            </button>
          ))}
      </div>
    </Card>
  );
}
