import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  TickMarkType,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { TRADE_CHART_PLOT_EXPANDED_PX } from '@/config/tradeChartHeights';
import type { TradeChartInterval } from '@/hooks/useLiveTradeMarket';
import { formatQuoteNumber, formatQuoteUsd } from '@/lib/formatQuote';
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

function timePointToLocalDate(time: Time): Date {
  let utc: Date;
  if (typeof time === 'number') {
    utc = new Date(time * 1000);
  } else if (typeof time === 'string') {
    utc = new Date(`${time}T00:00:00Z`);
  } else {
    utc = new Date(Date.UTC(time.year, time.month - 1, time.day));
  }
  return new Date(
    utc.getUTCFullYear(),
    utc.getUTCMonth(),
    utc.getUTCDate(),
    utc.getUTCHours(),
    utc.getUTCMinutes(),
    utc.getUTCSeconds(),
    utc.getUTCMilliseconds(),
  );
}

/** Compact time-axis labels; smaller glyph strings help LC fit ticks in short plot heights. */
function formatTimeScaleTick(time: Time, tickMarkType: TickMarkType, locale: string): string | null {
  const d = timePointToLocalDate(time);
  switch (tickMarkType) {
    case TickMarkType.Year:
      return d.toLocaleString(locale, { year: 'numeric' });
    case TickMarkType.Month:
      return d.toLocaleString(locale, { month: 'short' });
    case TickMarkType.DayOfMonth:
      return d.toLocaleString(locale, { month: 'short', day: 'numeric' });
    case TickMarkType.Time:
      return d.toLocaleString(locale, { hour: 'numeric', minute: '2-digit', hour12: false });
    case TickMarkType.TimeWithSeconds:
      return d.toLocaleString(locale, {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    default:
      return null;
  }
}

export function PriceChartCard({
  model,
  market,
  intervalLabel,
  loadingInterval,
  liveUpdatedAt,
  /** When set, shows a chart-hero title row (pair) above the live price. */
  heroPairLabel,
  change24hPct,
  chartHeightPx = TRADE_CHART_PLOT_EXPANDED_PX,
  timeframeOptions,
  chartInterval,
  onChartIntervalChange,
  /** Fixed plot height (px). When set, overrides dvh / --chart-h-desktop (e.g. collapsible trade header). */
  chartPlotHeightPx,
  exchangeStyleHero = false,
  metaCaption,
}: {
  model: TradeViewModel;
  market: MarketMode;
  intervalLabel?: string;
  loadingInterval?: boolean;
  liveUpdatedAt?: number;
  heroPairLabel?: string;
  change24hPct?: number;
  /** Fallback desktop height when `chartPlotHeightPx` is not set. */
  chartHeightPx?: number;
  /** When set, timeframe chips render at the top of this panel. */
  timeframeOptions?: { value: TradeChartInterval; label: string }[];
  chartInterval?: TradeChartInterval;
  onChartIntervalChange?: (value: TradeChartInterval) => void;
  chartPlotHeightPx?: number;
  /** Exchange-style layout: caption, large price + 24h delta, underline timeframe tabs (pair title omitted). */
  exchangeStyleHero?: boolean;
  /** e.g. "Perpetual · Funding +0.010%" */
  metaCaption?: string;
}) {
  const showTimeframeBar =
    Boolean(timeframeOptions?.length && chartInterval != null && onChartIntervalChange);
  const showLiquidation = market === 'futures';
  const [showVolume, setShowVolume] = useState(true);
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | 'flat'>('flat');
  /** Single plot host — fixed height + overflow-hidden; autoSize tracks this element. */
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
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

  useLayoutEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'rgba(12,12,15,0.9)' },
        textColor: 'rgba(148,163,184,0.9)',
        /** Drives time + price scale label metrics; primary lever for a shorter time-scale band. */
        fontSize: 7,
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
        borderVisible: false,
        /** Default is false: intraday ticks use day-of-month only → "4" repeated on one calendar day. */
        timeVisible: true,
        secondsVisible: false,
        allowBoldLabels: false,
        tickMarkFormatter: formatTimeScaleTick,
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
    /** Larger `top` = thinner volume band at bottom of pane (frees height for candles + time row feels shorter). */
    volSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.91, bottom: 0 },
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
    const el = chartContainerRef.current;
    const c = chartRef.current;
    if (!el || !c) return;
    const w = Math.max(1, Math.floor(el.clientWidth));
    const h = Math.max(1, Math.floor(el.clientHeight));
    c.resize(w, h);
  }, [chartPlotHeightPx]);

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
      const lineIsUp =
        series.length >= 2 ? series[series.length - 1].value >= series[0].value : model.lastPrice >= prevPriceRef.current;
      lineSeries.applyOptions({
        color: lineIsUp ? '#34d399' : '#fb7185',
      });
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

  const change =
    change24hPct != null && Number.isFinite(change24hPct) ? change24hPct : model.change24hPct ?? 0;
  const changeClass = change >= 0 ? 'text-emerald-400' : 'text-rose-400';
  const abs24hUsd =
    change !== 0 && Number.isFinite(model.lastPrice) ? (model.lastPrice * change) / (100 + change) : 0;
  const abs24hFmt = formatQuoteNumber(Math.abs(abs24hUsd));

  const marketTag =
    market === 'spot'
      ? `Spot${showTimeframeBar ? '' : ` · ${intervalLabel ?? '5m'}`}`
      : showTimeframeBar
        ? null
        : (intervalLabel ?? '5m');

  const perpTimeCluster = (
    <span className="inline-flex shrink-0 flex-col items-end gap-0 leading-none">
      {marketTag ? (
        <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-sigflo-muted/90 md:text-[9px]">
          {marketTag}
        </span>
      ) : null}
      {liveTime ? (
        <span className="mt-0.5 inline-flex items-center gap-0.5 text-[8px] font-medium text-emerald-200/90 md:text-[9px]">
          <span className="h-1 w-1 shrink-0 animate-pulse rounded-full bg-emerald-300" />
          <span className="tabular-nums leading-tight">{liveTime}</span>
        </span>
      ) : null}
      {loadingInterval ? (
        <span className="mt-0.5 inline-flex h-3 w-3 items-center justify-center rounded-full border border-cyan-400/35 bg-cyan-500/10 text-cyan-200">
          <svg viewBox="0 0 24 24" className="h-2 w-2 animate-spin" fill="none" aria-label="Loading interval">
            <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" opacity="0.35" />
            <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      ) : null}
    </span>
  );

  return (
    <Card
      className="overflow-hidden border-white/[0.1] bg-gradient-to-b from-white/[0.06] via-sigflo-surface to-black/35 p-1.5 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.9)] backdrop-blur-md md:p-2"
      style={{ ['--chart-h-desktop' as string]: `${chartHeightPx}px` }}
    >
      {exchangeStyleHero && showTimeframeBar && timeframeOptions && chartInterval != null && onChartIntervalChange ? (
        <div className="mb-0 space-y-0">
          <div className="flex min-w-0 flex-wrap items-end justify-between gap-2">
            <div className="min-w-0">
              <p
                className={`text-xl font-bold tabular-nums tracking-tight transition-colors md:text-2xl ${
                  priceDirection === 'up' ? 'text-emerald-200' : priceDirection === 'down' ? 'text-rose-200' : 'text-white'
                }`}
              >
                {formatQuoteUsd(model.lastPrice)}
              </p>
              <p className={`mt-0.5 text-xs font-semibold tabular-nums leading-tight md:text-sm ${changeClass}`}>
                {change >= 0 ? '+' : '−'}
                {abs24hFmt} ({change >= 0 ? '+' : ''}
                {change.toFixed(2)}%)
              </p>
            </div>
            <div className="shrink-0 border-l border-white/[0.08] pl-2">{perpTimeCluster}</div>
          </div>
        </div>
      ) : heroPairLabel ? (
        showTimeframeBar && timeframeOptions && chartInterval != null && onChartIntervalChange ? (
          <div className="mb-0.5 flex min-w-0 items-center gap-1.5 border-b border-white/[0.06] pb-1 md:mb-1.5 md:gap-2 md:pb-1.5">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xs font-bold tracking-tight text-white md:text-xl">{heroPairLabel}</h2>
              <div className="mt-0 flex flex-wrap items-baseline gap-1 md:mt-1 md:gap-2">
                <span
                  className={`text-sm font-bold tabular-nums leading-tight transition-colors md:text-2xl ${
                    priceDirection === 'up' ? 'text-emerald-200' : priceDirection === 'down' ? 'text-rose-200' : 'text-white'
                  }`}
                >
                  {formatQuoteUsd(model.lastPrice)}
                </span>
                <span className={`text-[11px] font-bold tabular-nums md:text-sm ${changeClass}`}>
                  {change >= 0 ? '+' : ''}
                  {change.toFixed(2)}%
                </span>
              </div>
            </div>
            <div className="flex min-w-0 max-w-[58%] shrink-0 items-center gap-1 sm:max-w-[62%] md:max-w-[55%] md:gap-1.5">
              <span className="hidden shrink-0 text-[7px] font-semibold uppercase tracking-[0.16em] text-sigflo-muted/80 sm:inline md:text-[8px]">
                TF
              </span>
              <div className="min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex w-max items-center justify-end gap-0.5 pr-0.5">
                  {timeframeOptions.map((intv) => (
                    <button
                      key={intv.value}
                      type="button"
                      onClick={() => onChartIntervalChange(intv.value)}
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold leading-none transition md:px-2 md:py-0.5 md:text-[9px] ${
                        chartInterval === intv.value
                          ? 'bg-sigflo-accent/18 text-sigflo-accent ring-1 ring-sigflo-accent/35'
                          : 'border border-white/[0.06] bg-white/[0.04] text-sigflo-muted hover:border-white/[0.1] hover:text-sigflo-text'
                      }`}
                    >
                      {intv.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="shrink-0 border-l border-white/[0.08] pl-1.5 md:pl-2">{perpTimeCluster}</div>
            </div>
          </div>
        ) : (
          <div className="mb-1 flex items-start justify-between gap-1.5 md:mb-3 md:gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-xs font-bold tracking-tight text-white md:text-xl">{heroPairLabel}</h2>
              <div className="mt-0 flex flex-wrap items-baseline gap-1 md:mt-1 md:gap-2">
                <span
                  className={`text-sm font-bold tabular-nums leading-tight transition-colors md:text-2xl ${
                    priceDirection === 'up' ? 'text-emerald-200' : priceDirection === 'down' ? 'text-rose-200' : 'text-white'
                  }`}
                >
                  {formatQuoteUsd(model.lastPrice)}
                </span>
                <span className={`text-[11px] font-bold tabular-nums md:text-sm ${changeClass}`}>
                  {change >= 0 ? '+' : ''}
                  {change.toFixed(2)}%
                </span>
              </div>
            </div>
            <div className="shrink-0 text-right">{perpTimeCluster}</div>
          </div>
        )
      ) : exchangeStyleHero && metaCaption ? (
        <div className="mb-0 space-y-0">
          <p
            className={`text-xl font-bold tabular-nums md:text-2xl ${
              priceDirection === 'up' ? 'text-emerald-200' : priceDirection === 'down' ? 'text-rose-200' : 'text-white'
            }`}
          >
            {formatQuoteUsd(model.lastPrice)}
          </p>
          <p className={`mt-0.5 text-xs font-semibold tabular-nums leading-tight md:text-sm ${changeClass}`}>
            {change >= 0 ? '+' : '−'}
            {abs24hFmt} ({change >= 0 ? '+' : ''}
            {change.toFixed(2)}%)
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between md:py-0">
          <h2
            className={`text-xs font-semibold transition-colors md:text-sm ${
              priceDirection === 'up' ? 'text-emerald-300' : priceDirection === 'down' ? 'text-rose-300' : 'text-white'
            }`}
          >
            {formatQuoteUsd(model.lastPrice)}
          </h2>
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[9px] text-sigflo-muted md:text-[11px]">
              Live{showTimeframeBar ? '' : ` ${intervalLabel ?? '5m'}`} + overlays
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
      )}
      {exchangeStyleHero && showTimeframeBar && timeframeOptions && chartInterval != null && onChartIntervalChange ? (
        <div className="mt-0 flex min-w-0 items-center justify-between gap-2 border-b border-white/[0.06] bg-black/20 px-2 py-1 md:px-2.5 md:py-1">
          <div className="min-w-0 flex-1">
            {metaCaption ? (
              <p className="min-w-0 text-[9px] font-medium leading-snug tracking-wide text-sigflo-muted/75 md:text-[10px]">
                {metaCaption}
              </p>
            ) : null}
          </div>
          <div className="max-w-[min(100%,14rem)] shrink-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="ml-auto flex w-max items-center justify-end gap-2">
              {timeframeOptions.map((intv) => (
                <button
                  key={intv.value}
                  type="button"
                  onClick={() => onChartIntervalChange(intv.value)}
                  className={`shrink-0 border-b pb-0.5 text-[8px] font-medium uppercase tracking-wider text-sigflo-muted/55 transition hover:text-sigflo-muted/90 md:text-[9px] ${
                    chartInterval === intv.value
                      ? 'border-emerald-500/35 text-sigflo-muted/95'
                      : 'border-transparent'
                  }`}
                >
                  {intv.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : exchangeStyleHero && metaCaption ? (
        <p className="mt-0 border-b border-white/[0.06] bg-black/20 px-2 py-1 text-[9px] font-medium leading-snug tracking-wide text-sigflo-muted/75 md:px-2.5 md:py-1 md:text-[10px]">
          {metaCaption}
        </p>
      ) : null}
      <div className="mt-0 min-h-0 overflow-hidden rounded-lg border border-white/[0.08] bg-black/30 md:rounded-xl">
        <div
          ref={chartContainerRef}
          className={
            chartPlotHeightPx != null
              ? 'w-full shrink-0 overflow-hidden bg-black/20 transition-[height] duration-300 ease-out'
              : 'h-[20dvh] min-h-[72px] max-h-[20dvh] w-full shrink-0 overflow-hidden bg-black/20 md:h-[var(--chart-h-desktop)] md:max-h-none md:min-h-[200px]'
          }
          style={chartPlotHeightPx != null ? { height: chartPlotHeightPx } : undefined}
        />
        <div className="flex flex-wrap items-center gap-[3.5px] border-t border-white/[0.06] bg-black/20 px-[4.5px] py-[3.5px] text-[7px] font-medium leading-tight md:gap-[4.5px] md:px-[5.5px] md:py-[4.5px] md:text-[8px]">
          <button
            type="button"
            onClick={() => setShowVolume((v) => !v)}
            className={`rounded-sm px-[5.5px] py-[3.5px] transition md:px-[7px] md:py-[3px] ${
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
                className={`rounded-sm px-[5.5px] py-[3.5px] transition md:px-[7px] md:py-[3px] ${
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
      </div>
    </Card>
  );
}
