import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  TickMarkType,
  type AutoscaleInfo,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { MarketStatsRow } from '@/components/trade/MarketStatsRow';
import { SetupToggle } from '@/components/trade/SetupToggle';
import { TRADE_CHART_PLOT_EXPANDED_PX } from '@/config/tradeChartHeights';
import type { TradeChartInterval } from '@/hooks/useLiveTradeMarket';
import { hexToRgba } from '@/lib/chartColorUtils';
import {
  tradeTimingLineAlpha,
  tradeTimingOverlayVisual,
  type TradeTimingChipState,
} from '@/lib/tradeTimingChip';
import { formatQuoteNumber, formatQuoteUsd } from '@/lib/formatQuote';
import {
  TRADE_CHART_LEVEL_COLORS,
  buildChartOverlayPresetLive,
  chartOverlayPresetSetupLevels,
  type TradeChartAuxLine,
} from '@/lib/tradeChartLevels';
import type { MarketMode, TradeViewModel } from '@/types/trade';

/**
 * Chart surface: Lightweight Charts plot, interval chips, `SetupToggle` (Clean vs Setup overlays).
 * Overlay series use ease-out fade in `SETUP_LINE_ANIM_MS`; line weight/opacity from `tradeTimingOverlayVisual`.
 */
type LevelKey = 'entry' | 'stop' | 'target' | 'liquidation';

const levelStyles: Record<LevelKey, { label: string; stroke: string; labelClass: string }> = {
  entry: { label: 'Entry', stroke: TRADE_CHART_LEVEL_COLORS.entry, labelClass: 'text-teal-300' },
  stop: { label: 'Stop', stroke: TRADE_CHART_LEVEL_COLORS.stop, labelClass: 'text-rose-300' },
  target: { label: 'Target', stroke: TRADE_CHART_LEVEL_COLORS.target, labelClass: 'text-emerald-300' },
  liquidation: {
    label: 'Liq.',
    stroke: TRADE_CHART_LEVEL_COLORS.liquidation,
    labelClass: 'text-amber-200',
  },
};

/** Ease-out fade for setup overlays (entry / stop / target / liq). */
const SETUP_LINE_ANIM_MS = 175;

/**
 * Stop and liquidation are often far below/above the live last/entry/target band. Including them
 * in y-autoscale squashes candles. We anchor the band on last + entry + target (+ aux), then only
 * widen to include stop/liq when within this ratio of that band's span (from the nearest edge).
 */
const SETUP_RISK_OUTSIDE_PRIMARY_RATIO = 0.28;

function padPriceExtent(min: number, max: number): { min: number; max: number } {
  const span = max - min;
  const pad = span > 0 ? span * 0.03 : Math.max(min, max) * 0.002;
  return { min: min - pad, max: max + pad };
}

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
  setupMode,
  onSetupModeToggle,
  onRequestSetupMode,
  tradeTimingState,
  /** When true, chart chrome emphasizes active position context (header metrics, optional proximity). */
  liveTradeMode = false,
  /** Extra horizontal levels (e.g. trim) — not toggled via overlay chips. */
  auxiliaryPriceLines,
  /** Compact R / T / R:R (+ optional badge) under the exchange hero row. */
  liveHeaderMetrics,
  /** When this key changes, refit time scale once so entry/stop/target stay in view. */
  liveTradeRefitKey,
  /** Subtle frame hint when price is near stop or target. */
  chartProximity = null,
  /**
   * When true (open position), apply the Live Trade overlay preset once and auto-enable liq when it becomes
   * available unless the user toggled it. Resets to setup (all off) when false. Manual chip toggles while
   * live are tracked per-level until the position closes.
   */
  liveTradeOverlayPreset = false,
  /**
   * When true, hide last price + 24h change in the exchange hero row (e.g. when a `LiveMarketStrip` above
   * already shows them). Left column becomes “Price chart” + `liveHeaderMetrics` instead.
   */
  suppressExchangeHeroLivePrice = false,
  /** Strip label when `liveTradeMode` (e.g. practice vs exchange-backed). */
  liveActivePositionTitle = 'Practice position',
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
  /** e.g. "PERP · Funding +0.010%" (shown beside chart overlay toggles when `exchangeStyleHero`). */
  metaCaption?: string;
  /** When set, parent controls trade overlays: false = hidden, true = entry/stop/target (+ liq on perps). */
  setupMode?: boolean;
  onSetupModeToggle?: () => void;
  /** Prefer this from overlay chips (Clean → show one level): forces Setup on without toggling off if state drifts. */
  onRequestSetupMode?: () => void;
  /** When Setup overlays are on, scales line alpha / entry emphasis from timing chip state. */
  tradeTimingState?: TradeTimingChipState;
  liveTradeMode?: boolean;
  auxiliaryPriceLines?: TradeChartAuxLine[];
  liveHeaderMetrics?: {
    riskPercent: number;
    rewardPercent: number;
    rrRatio: number;
    badge?: string;
    /** Shown under R/T/R:R when `suppressExchangeHeroLivePrice` (e.g. uPnL — not duplicate last). */
    secondaryLine?: string;
    /** uPnL coloring: green / red / muted when flat. */
    secondaryLineTone?: 'positive' | 'negative' | 'neutral';
  };
  liveTradeRefitKey?: string;
  chartProximity?: 'stop' | 'target' | null;
  liveTradeOverlayPreset?: boolean;
  suppressExchangeHeroLivePrice?: boolean;
  liveActivePositionTitle?: string;
}) {
  const showTimeframeBar =
    Boolean(timeframeOptions?.length && chartInterval != null && onChartIntervalChange);
  /** Exchange trade header: price/TF row should meet the plot with no extra chrome gap. */
  const exchangeTfHero =
    Boolean(exchangeStyleHero && showTimeframeBar && timeframeOptions && chartInterval != null && onChartIntervalChange);
  const showLiquidation = market === 'futures';
  const setupControlled = typeof setupMode === 'boolean';
  /** Latest setup flag for async fade-out (avoid clearing overlays after user re-enters Setup). */
  const setupModeLiveRef = useRef(setupMode === true);
  useEffect(() => {
    setupModeLiveRef.current = setupMode === true;
  }, [setupMode]);
  const prevSetupOnRef = useRef<boolean | undefined>(undefined);
  /** One-shot: animate setup lines in only when entering Setup mode (not when toggling individual levels). */
  const setupFadeInArmRef = useRef(false);
  /** Last timed alpha used for setup lines — so fade-out matches visibility when leaving Setup. */
  const lastSetupAlphaScaleRef = useRef(1);
  const [showVolume, setShowVolume] = useState(true);
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | 'flat'>('flat');
  /** Single plot host — fixed height + overflow-hidden; autoSize tracks this element. */
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  type PriceLineHandle = ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']>;
  const priceLineByKeyRef = useRef<Partial<Record<LevelKey, PriceLineHandle>>>({});
  const auxPriceLineByIdRef = useRef<Record<string, PriceLineHandle>>({});
  /** Which series owns `priceLineByKeyRef` — must match candle vs line fallback in data effect. */
  const priceLineHostModeRef = useRef<'candle' | 'line' | null>(null);
  const [visibleLevels, setVisibleLevels] = useState<Record<LevelKey, boolean>>({
    entry: false,
    stop: false,
    target: false,
    liquidation: false,
  });
  /** Set when leaving Clean via a single overlay chip — next Setup entry shows only that level. */
  const [soloOverlayFromClean, setSoloOverlayFromClean] = useState<LevelKey | null>(null);
  /** Tracks market futures/spot for liq sync (avoid forcing liq on every Setup toggle). */
  const prevShowLiqForSyncRef = useRef(showLiquidation);
  const prevSetupModeForSoloRef = useRef(setupMode);
  const prevLiveOverlayPresetRef = useRef<boolean | undefined>(undefined);
  const liveOverlayTouchedKeysRef = useRef<Set<LevelKey>>(new Set());

  useEffect(() => {
    if (setupControlled && prevSetupModeForSoloRef.current === true && setupMode === false) {
      setSoloOverlayFromClean(null);
    }
    prevSetupModeForSoloRef.current = setupMode;
  }, [setupMode, setupControlled]);

  useEffect(() => {
    if (!setupControlled) return;
    if (!setupMode) {
      prevSetupOnRef.current = false;
      return;
    }
    const wasOn = prevSetupOnRef.current === true;
    prevSetupOnRef.current = true;
    if (wasOn) return;
    setupFadeInArmRef.current = true;

    const solo = soloOverlayFromClean;
    if (solo != null) {
      setSoloOverlayFromClean(null);
      setVisibleLevels({
        entry: solo === 'entry',
        stop: solo === 'stop',
        target: solo === 'target',
        liquidation: solo === 'liquidation' && showLiquidation,
      });
      prevShowLiqForSyncRef.current = showLiquidation;
      return;
    }

    if (liveTradeOverlayPreset) {
      liveOverlayTouchedKeysRef.current.clear();
      setVisibleLevels(buildChartOverlayPresetLive(showLiquidation, model.liquidation));
      prevShowLiqForSyncRef.current = showLiquidation;
      return;
    }

    setVisibleLevels({
      entry: true,
      stop: true,
      target: true,
      liquidation: showLiquidation,
    });
    prevShowLiqForSyncRef.current = showLiquidation;
  }, [setupMode, setupControlled, showLiquidation, soloOverlayFromClean, liveTradeOverlayPreset, model.liquidation]);

  /** Enter / exit live trade: preset overlay toggles; reset touches when the preset boundary changes. */
  useEffect(() => {
    if (!setupControlled) return;
    const prev = prevLiveOverlayPresetRef.current;
    const next = liveTradeOverlayPreset;
    prevLiveOverlayPresetRef.current = next;

    if (next && prev !== true) {
      liveOverlayTouchedKeysRef.current.clear();
      setVisibleLevels(buildChartOverlayPresetLive(showLiquidation, model.liquidation));
      setupFadeInArmRef.current = true;
      prevSetupOnRef.current = true;
      return;
    }
    if (!next && prev === true) {
      liveOverlayTouchedKeysRef.current.clear();
      setVisibleLevels(chartOverlayPresetSetupLevels());
      return;
    }
  }, [liveTradeOverlayPreset, setupControlled, showLiquidation, model.liquidation]);

  /** While live: turn liq on when a valid price appears, unless the user already toggled liq. */
  useEffect(() => {
    if (!setupControlled || !setupMode || !liveTradeOverlayPreset) return;
    if (liveOverlayTouchedKeysRef.current.has('liquidation')) return;
    const liqOn =
      showLiquidation &&
      model.liquidation != null &&
      Number.isFinite(model.liquidation) &&
      model.liquidation > 0;
    if (!liqOn) return;
    setVisibleLevels((prev) => (prev.liquidation ? prev : { ...prev, liquidation: true }));
  }, [liveTradeOverlayPreset, model.liquidation, setupControlled, setupMode, showLiquidation]);

  /** Futures ↔ spot: sync liq row visibility unless user overrode liq during live trade. */
  useEffect(() => {
    if (!setupControlled || !setupMode) {
      prevShowLiqForSyncRef.current = showLiquidation;
      return;
    }
    if (prevShowLiqForSyncRef.current === showLiquidation) return;
    prevShowLiqForSyncRef.current = showLiquidation;
    if (liveTradeOverlayPreset && liveOverlayTouchedKeysRef.current.has('liquidation')) {
      return;
    }
    setVisibleLevels((prev) => ({ ...prev, liquidation: showLiquidation }));
  }, [showLiquidation, setupMode, setupControlled, liveTradeOverlayPreset]);

  const visibleLevelKeys = useMemo(
    () =>
      (Object.keys(levelStyles) as LevelKey[])
        .filter((key) => (key === 'liquidation' ? showLiquidation : true))
        .filter((key) => visibleLevels[key]),
    [showLiquidation, visibleLevels],
  );

  const useTimedSetupOverlays = setupControlled && setupMode && tradeTimingState != null;
  const setupOverlayVisual = useMemo(() => {
    if (!useTimedSetupOverlays || tradeTimingState == null) {
      return { alphaScale: 1, entryLineExtraWidth: 0 };
    }
    return tradeTimingOverlayVisual(tradeTimingState);
  }, [tradeTimingState, useTimedSetupOverlays]);

  useEffect(() => {
    if (useTimedSetupOverlays) {
      lastSetupAlphaScaleRef.current = setupOverlayVisual.alphaScale;
    }
  }, [useTimedSetupOverlays, setupOverlayVisual.alphaScale]);

  const liveTime = liveUpdatedAt
    ? new Date(liveUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;
  const prevPriceRef = useRef<number>(model.lastPrice);
  /** Avoid full setData + fitContent on every tick; update last bar only when same candle. */
  const candleStructRef = useRef<{ len: number; lastTs: number } | null>(null);
  /** Only auto-fit when pair/interval changes or first paint — not on every new candle (preserves zoom). */
  const chartViewKeyRef = useRef<string>('');
  const didFitContentRef = useRef(false);
  /** Last bar logical index (0-based) for live-edge detection — updated when series data changes. */
  const lastBarLogicalIndexRef = useRef(0);
  /** While true, `subscribeVisibleLogicalRangeChange` ignores updates (programmatic fit/scroll). */
  const programmaticViewportRef = useRef(false);
  /**
   * When true, live ticks skip `scrollToRealTime` (viewport stays put). Set when the user pans away from the
   * live edge, leaves the chart plot (`pointerleave`), or the window blurs; cleared when the viewport is
   * back at the live edge (pan or `pointerenter` resync) or on pair/interval / refit.
   */
  const skipScrollToRealTimeRef = useRef(false);
  /** Line fallback (≤10 candles): avoid `Date.now()` per point — shifting times on every tick resets the x-axis. */
  const lineFallbackAnchorSecRef = useRef(Math.floor(Date.now() / 1000));
  const lineFallbackSeriesLenRef = useRef(-1);

  const runProgrammaticViewport = useCallback((fn: () => void) => {
    programmaticViewportRef.current = true;
    try {
      fn();
    } finally {
      requestAnimationFrame(() => {
        programmaticViewportRef.current = false;
      });
    }
  }, []);

  /** After full `setData`, restore horizontal zoom when the user had panned off the live edge. */
  function clampVisibleLogicalRange(
    chart: IChartApi,
    saved: { from: number; to: number } | null,
    lastIdx: number,
  ): void {
    if (!saved || lastIdx < 0) return;
    const from = Math.max(0, Math.min(saved.from, lastIdx));
    const to = Math.max(from, Math.min(saved.to, lastIdx));
    if (to - from < 0.2) return;
    chart.timeScale().setVisibleLogicalRange({ from, to });
  }

  /** Latest viewport→skip logic for subscription + pointer handlers (chart mounts in layout effect). */
  const applySkipScrollFromViewportRef = useRef<() => void>(() => {});
  applySkipScrollFromViewportRef.current = () => {
    if (programmaticViewportRef.current) return;
    const chart = chartRef.current;
    if (!chart) return;
    const range = chart.timeScale().getVisibleLogicalRange();
    if (!range) return;
    const lastIdx = lastBarLogicalIndexRef.current;
    if (lastIdx <= 0) {
      skipScrollToRealTimeRef.current = false;
      return;
    }
    const atLiveEdge = range.to >= lastIdx - 0.5;
    skipScrollToRealTimeRef.current = !atLiveEdge;
  };

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

  /**
   * v5 autoscale only uses bar min/max — custom price lines do not widen the scale. We merge a padded
   * extent so levels stay in view. Risk levels (stop, liq) widen the merge only when close to the
   * last/entry/target band; otherwise they stay off-scale and the line may clip — values remain in chips.
   */
  const overlayPriceAutoscaleExtent = useMemo(() => {
    const primaryBand: number[] = [];
    if (Number.isFinite(model.lastPrice) && model.lastPrice > 0) {
      primaryBand.push(model.lastPrice);
    }
    if (visibleLevels.entry && Number.isFinite(staticLevelPrices.entry) && staticLevelPrices.entry > 0) {
      primaryBand.push(staticLevelPrices.entry);
    }
    if (visibleLevels.target && Number.isFinite(staticLevelPrices.target) && staticLevelPrices.target > 0) {
      primaryBand.push(staticLevelPrices.target);
    }
    for (const aux of auxiliaryPriceLines ?? []) {
      if (Number.isFinite(aux.price) && aux.price > 0) primaryBand.push(aux.price);
    }

    if (primaryBand.length === 0) {
      const fallback: number[] = [];
      if (Number.isFinite(model.lastPrice) && model.lastPrice > 0) fallback.push(model.lastPrice);
      if (visibleLevels.stop && Number.isFinite(staticLevelPrices.stop) && staticLevelPrices.stop > 0) {
        fallback.push(staticLevelPrices.stop);
      }
      if (
        showLiquidation &&
        visibleLevels.liquidation &&
        Number.isFinite(staticLevelPrices.liquidation) &&
        staticLevelPrices.liquidation > 0
      ) {
        fallback.push(staticLevelPrices.liquidation);
      }
      if (fallback.length === 0) return null;
      const lo = Math.min(...fallback);
      const hi = Math.max(...fallback);
      return padPriceExtent(lo, hi);
    }

    const pMin = Math.min(...primaryBand);
    const pMax = Math.max(...primaryBand);
    const pSpan = Math.max(pMax - pMin, pMax * 0.0005, 1);

    let min = pMin;
    let max = pMax;

    const tryIncludeRisk = (price: number, enabled: boolean) => {
      if (!enabled || !Number.isFinite(price) || price <= 0) return;
      if (price >= pMin && price <= pMax) return;
      if (price < pMin) {
        const dist = pMin - price;
        if (dist / pSpan <= SETUP_RISK_OUTSIDE_PRIMARY_RATIO) min = price;
      } else {
        const dist = price - pMax;
        if (dist / pSpan <= SETUP_RISK_OUTSIDE_PRIMARY_RATIO) max = price;
      }
    };

    tryIncludeRisk(
      staticLevelPrices.stop,
      visibleLevels.stop && Number.isFinite(staticLevelPrices.stop) && staticLevelPrices.stop > 0,
    );
    tryIncludeRisk(
      staticLevelPrices.liquidation,
      showLiquidation &&
        visibleLevels.liquidation &&
        Number.isFinite(staticLevelPrices.liquidation) &&
        staticLevelPrices.liquidation > 0,
    );

    return padPriceExtent(min, max);
  }, [visibleLevels, staticLevelPrices, model.lastPrice, showLiquidation, auxiliaryPriceLines]);

  useLayoutEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'rgba(12,12,15,0.9)' },
        textColor: 'rgba(148,163,184,0.9)',
        /** Drives time + price scale label metrics (shared by lightweight-charts). */
        fontSize: 12,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.06)' },
      },
      /** Default is Magnet/MagnetOHLC — snaps to bar OHLC; Normal follows the cursor. */
      crosshair: {
        mode: CrosshairMode.Normal,
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

    /** Default right scale uses ~10% bottom margin — pulls candles away from the time axis. Tighten so time labels sit just under the plot. */
    chart.priceScale('right').applyOptions({
      scaleMargins: {
        top: 0.1,
        bottom: 0.02,
      },
    });

    chartRef.current = chart;
    candleRef.current = candleSeries;
    lineRef.current = lineSeries;
    volRef.current = volSeries;

    const onVisibleLogicalRangeChange = () => applySkipScrollFromViewportRef.current();

    const timeScale = chart.timeScale();
    timeScale.subscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChange);

    return () => {
      timeScale.unsubscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChange);
      priceLineByKeyRef.current = {};
      auxPriceLineByIdRef.current = {};
      priceLineHostModeRef.current = null;
      chartViewKeyRef.current = '';
      didFitContentRef.current = false;
      candleStructRef.current = null;
      skipScrollToRealTimeRef.current = false;
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

  /** Stop live auto-scroll when focus leaves the page (e.g. another tab) — same as leaving the chart. */
  useEffect(() => {
    const onBlur = () => {
      skipScrollToRealTimeRef.current = true;
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, []);

  /** Widen right scale so setup price lines (stop / liq far from last) stay in view. */
  useEffect(() => {
    const candle = candleRef.current;
    const line = lineRef.current;
    const chart = chartRef.current;
    if (!candle || !line || !chart) return;

    const extent = overlayPriceAutoscaleExtent;
    const autoscaleInfoProvider = (original: () => AutoscaleInfo | null): AutoscaleInfo | null => {
      const base = original();
      if (!extent) return base;
      const { min: extMin, max: extMax } = extent;
      if (base?.priceRange) {
        return {
          priceRange: {
            minValue: Math.min(base.priceRange.minValue, extMin),
            maxValue: Math.max(base.priceRange.maxValue, extMax),
          },
          margins: base.margins,
        };
      }
      return {
        priceRange: {
          minValue: extMin,
          maxValue: extMax,
        },
        margins: base?.margins,
      };
    };

    candle.applyOptions({ autoscaleInfoProvider });
    line.applyOptions({ autoscaleInfoProvider });
  }, [overlayPriceAutoscaleExtent]);

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
      skipScrollToRealTimeRef.current = false;
      lineFallbackSeriesLenRef.current = -1;
    }

    const candles = model.chartCandles ?? [];
    if (candles.length > 10) {
      lineFallbackSeriesLenRef.current = -1;
      const last = candles[candles.length - 1];
      const struct = candleStructRef.current;
      const sameCandle =
        last &&
        struct &&
        struct.len === candles.length &&
        struct.lastTs === last.ts;

      lastBarLogicalIndexRef.current = Math.max(0, candles.length - 1);

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
        // Intrabar OHLC updates share the same logical index — do not scroll; avoids viewport drift / “resets”.
      } else {
        const chart = chartRef.current;
        const ts = chart?.timeScale();
        const preserveViewport = skipScrollToRealTimeRef.current;
        const savedLogical =
          preserveViewport && chart && ts ? ts.getVisibleLogicalRange() : null;
        const lastIdx = Math.max(0, candles.length - 1);

        runProgrammaticViewport(() => {
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
          lastBarLogicalIndexRef.current = lastIdx;
          if (!didFitContentRef.current) {
            ts?.fitContent();
            didFitContentRef.current = true;
            if (!preserveViewport && !skipScrollToRealTimeRef.current) {
              ts?.scrollToRealTime();
            }
          } else if (preserveViewport && savedLogical != null && chart) {
            clampVisibleLogicalRange(chart, savedLogical, lastIdx);
            requestAnimationFrame(() => {
              applySkipScrollFromViewportRef.current();
            });
          } else if (!skipScrollToRealTimeRef.current) {
            ts?.scrollToRealTime();
          }
        });
      }
    } else {
      candleStructRef.current = null;
      const chart = chartRef.current;
      const ts = chart?.timeScale();

      const base = model.lastPrice;
      const plen = model.priceSeries.length;
      if (plen !== lineFallbackSeriesLenRef.current) {
        lineFallbackSeriesLenRef.current = plen;
        lineFallbackAnchorSecRef.current = Math.floor(Date.now() / 1000);
      }
      const anchorSec = lineFallbackAnchorSecRef.current;
      const series = model.priceSeries.map((v, i) => ({
        time: (anchorSec - (plen - i) * 60) as Time,
        value: base * (0.985 + v * 0.03),
      }));
      lastBarLogicalIndexRef.current = Math.max(0, series.length - 1);

      const lineIsUp =
        series.length >= 2 ? series[series.length - 1].value >= series[0].value : model.lastPrice >= prevPriceRef.current;
      lineSeries.applyOptions({
        color: lineIsUp ? '#34d399' : '#fb7185',
      });
      const preserveViewport = skipScrollToRealTimeRef.current;
      const savedLogical =
        preserveViewport && chart && ts ? ts.getVisibleLogicalRange() : null;
      const lastIdxLine = Math.max(0, series.length - 1);
      runProgrammaticViewport(() => {
        lineSeries.setData(series);
        candleSeries.setData([]);
        volSeries.setData([]);
        lastBarLogicalIndexRef.current = lastIdxLine;
        if (!didFitContentRef.current) {
          ts?.fitContent();
          didFitContentRef.current = true;
          if (!preserveViewport && !skipScrollToRealTimeRef.current) {
            ts?.scrollToRealTime();
          }
        } else if (preserveViewport && savedLogical != null && chart) {
          clampVisibleLogicalRange(chart, savedLogical, lastIdxLine);
          requestAnimationFrame(() => {
            applySkipScrollFromViewportRef.current();
          });
        } else if (!skipScrollToRealTimeRef.current) {
          ts?.scrollToRealTime();
        }
      });
    }
  }, [intervalLabel, model.chartCandles, model.lastPrice, model.pair, model.priceSeries, runProgrammaticViewport]);

  useEffect(() => {
    const prev = prevPriceRef.current;
    if (model.lastPrice > prev) setPriceDirection('up');
    else if (model.lastPrice < prev) setPriceDirection('down');
    else setPriceDirection('flat');
    prevPriceRef.current = model.lastPrice;
  }, [model.lastPrice]);

  useEffect(() => {
    const candleSeries = candleRef.current;
    const lineSeries = lineRef.current;
    if (!candleSeries || !lineSeries) return;

    const candlesActive = (model.chartCandles?.length ?? 0) > 10;
    const host = candlesActive ? candleSeries : lineSeries;
    const nextHostMode: 'candle' | 'line' = candlesActive ? 'candle' : 'line';
    const prevMode = priceLineHostModeRef.current;
    if (prevMode != null && prevMode !== nextHostMode) {
      const oldHost = prevMode === 'candle' ? candleSeries : lineSeries;
      for (const key of Object.keys(priceLineByKeyRef.current) as LevelKey[]) {
        const pl = priceLineByKeyRef.current[key];
        if (pl) oldHost.removePriceLine(pl);
        delete priceLineByKeyRef.current[key];
      }
      for (const id of Object.keys(auxPriceLineByIdRef.current)) {
        const pl = auxPriceLineByIdRef.current[id];
        if (pl) oldHost.removePriceLine(pl);
        delete auxPriceLineByIdRef.current[id];
      }
    }
    priceLineHostModeRef.current = nextHostMode;

    const want = new Set(visibleLevelKeys);
    for (const key of Object.keys(priceLineByKeyRef.current) as LevelKey[]) {
      if (!want.has(key)) {
        const line = priceLineByKeyRef.current[key];
        if (line) host.removePriceLine(line);
        delete priceLineByKeyRef.current[key];
      }
    }

    const strokeFor = (key: LevelKey) => {
      const style = levelStyles[key];
      if (useTimedSetupOverlays) {
        const a = tradeTimingLineAlpha(key, setupOverlayVisual.alphaScale);
        return hexToRgba(style.stroke, a);
      }
      return style.stroke;
    };
    const widthFor = (key: LevelKey): 1 | 2 | 3 | 4 => {
      if (key !== 'entry') return 1;
      const w = 2 + (useTimedSetupOverlays ? setupOverlayVisual.entryLineExtraWidth : 0);
      return (w <= 4 ? w : 4) as 1 | 2 | 3 | 4;
    };

    for (const key of visibleLevelKeys) {
      const style = levelStyles[key];
      const price = staticLevelPrices[key];
      if (!Number.isFinite(price) || price <= 0) {
        const ghost = priceLineByKeyRef.current[key];
        if (ghost) {
          host.removePriceLine(ghost);
          delete priceLineByKeyRef.current[key];
        }
        continue;
      }
      const existing = priceLineByKeyRef.current[key];
      if (existing) {
        existing.applyOptions({
          price,
          color: strokeFor(key),
          lineWidth: widthFor(key),
          title: style.label,
        });
      } else {
        priceLineByKeyRef.current[key] = host.createPriceLine({
          price,
          color: strokeFor(key),
          lineWidth: widthFor(key),
          axisLabelVisible: true,
          title: style.label,
        });
      }
    }
  }, [model.chartCandles, staticLevelPrices, visibleLevelKeys, useTimedSetupOverlays, setupOverlayVisual]);

  useEffect(() => {
    const candleSeries = candleRef.current;
    const lineSeries = lineRef.current;
    if (!candleSeries || !lineSeries) return;

    const candlesActive = (model.chartCandles?.length ?? 0) > 10;
    const host = candlesActive ? candleSeries : lineSeries;

    const want = new Map((auxiliaryPriceLines ?? []).filter((a) => Number.isFinite(a.price) && a.price > 0).map((a) => [a.id, a]));
    for (const id of Object.keys(auxPriceLineByIdRef.current)) {
      if (!want.has(id)) {
        const pl = auxPriceLineByIdRef.current[id];
        if (pl) host.removePriceLine(pl);
        delete auxPriceLineByIdRef.current[id];
      }
    }
    for (const aux of want.values()) {
      const existing = auxPriceLineByIdRef.current[aux.id];
      if (existing) {
        existing.applyOptions({
          price: aux.price,
          color: aux.color,
          title: aux.title,
        });
      } else {
        auxPriceLineByIdRef.current[aux.id] = host.createPriceLine({
          price: aux.price,
          color: aux.color,
          lineWidth: 1,
          axisLabelVisible: true,
          title: aux.title,
        });
      }
    }
  }, [auxiliaryPriceLines, model.chartCandles, model.lastPrice]);

  const liveRefitSeenKeyRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!liveTradeRefitKey) {
      liveRefitSeenKeyRef.current = undefined;
      return;
    }
    if (liveRefitSeenKeyRef.current === liveTradeRefitKey) return;
    liveRefitSeenKeyRef.current = liveTradeRefitKey;
    didFitContentRef.current = false;
    skipScrollToRealTimeRef.current = false;
    const id = window.requestAnimationFrame(() => {
      const chart = chartRef.current;
      if (!chart) return;
      runProgrammaticViewport(() => {
        const ts = chart.timeScale();
        ts.fitContent();
        didFitContentRef.current = true;
        ts.scrollToRealTime();
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [liveTradeRefitKey, runProgrammaticViewport]);

  useEffect(() => {
    if (!setupControlled || setupMode) return;

    const setupKeys = (
      ['entry', 'stop', 'target', ...(showLiquidation ? (['liquidation'] as const) : [])] as LevelKey[]
    ).filter((k) => priceLineByKeyRef.current[k]);

    const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

    if (setupKeys.length === 0) {
      setVisibleLevels((p) => ({
        ...p,
        entry: false,
        stop: false,
        target: false,
        liquidation: false,
      }));
      return;
    }

    let raf = 0;
    let cancelled = false;
    const start = performance.now();

    const cap = lastSetupAlphaScaleRef.current;
    const step = (now: number) => {
      if (cancelled) return;
      const p = Math.min(1, (now - start) / SETUP_LINE_ANIM_MS);
      const alpha = easeOut(1 - p) * cap;
      for (const key of setupKeys) {
        const line = priceLineByKeyRef.current[key];
        if (line) line.applyOptions({ color: hexToRgba(levelStyles[key].stroke, alpha) });
      }
      if (p < 1) {
        raf = requestAnimationFrame(step);
      } else if (!setupModeLiveRef.current) {
        setVisibleLevels((prev) => ({
          ...prev,
          entry: false,
          stop: false,
          target: false,
          liquidation: false,
        }));
      }
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [setupMode, showLiquidation, setupControlled]);

  useEffect(() => {
    if (!setupControlled || !setupMode) return;
    if (!setupFadeInArmRef.current) return;

    const keys = (
      ['entry', 'stop', 'target', ...(showLiquidation ? (['liquidation'] as const) : [])] as LevelKey[]
    ).filter((k) => visibleLevels[k]);

    if (keys.length === 0) return;

    setupFadeInArmRef.current = false;

    let cancelled = false;
    let raf = 0;
    const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
    const cap = useTimedSetupOverlays ? setupOverlayVisual.alphaScale : 1;

    const run = () => {
      for (const key of keys) {
        const line = priceLineByKeyRef.current[key];
        if (line) line.applyOptions({ color: hexToRgba(levelStyles[key].stroke, 0) });
      }
      const start = performance.now();
      const step = (now: number) => {
        if (cancelled) return;
        const p = Math.min(1, (now - start) / SETUP_LINE_ANIM_MS);
        const t = easeOut(p);
        for (const key of keys) {
          const line = priceLineByKeyRef.current[key];
          if (line) {
            const stroke = levelStyles[key].stroke;
            const peak = !useTimedSetupOverlays ? 1 : tradeTimingLineAlpha(key, cap);
            line.applyOptions({ color: hexToRgba(stroke, t * peak) });
          }
        }
        if (p < 1) {
          raf = requestAnimationFrame(step);
        } else {
          for (const key of keys) {
            const line = priceLineByKeyRef.current[key];
            if (line) {
              const stroke = levelStyles[key].stroke;
              const endAlpha = !useTimedSetupOverlays ? 1 : tradeTimingLineAlpha(key, cap);
              line.applyOptions({
                color: !useTimedSetupOverlays ? stroke : hexToRgba(stroke, endAlpha),
              });
            }
          }
        }
      };
      raf = requestAnimationFrame(step);
    };

    const id = requestAnimationFrame(() => requestAnimationFrame(run));
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(id);
    };
  }, [
    setupMode,
    visibleLevelKeys,
    showLiquidation,
    setupControlled,
    useTimedSetupOverlays,
    setupOverlayVisual.alphaScale,
  ]);

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
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sigflo-muted/90 md:text-[11px]">
          {marketTag}
        </span>
      ) : null}
      {liveTime ? (
        <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-200/90 md:text-[11px]">
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-300" />
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

  /** Clean mode: overlay chips still click — first tap turns on Setup so levels can render. */
  const setupGated = setupControlled && !setupMode;

  const chartFrameToneClass =
    chartProximity === 'stop'
      ? 'shadow-[inset_0_0_20px_-8px_rgba(248,113,113,0.35)]'
      : chartProximity === 'target'
        ? 'shadow-[inset_0_0_20px_-8px_rgba(74,222,128,0.22)]'
        : '';

  return (
    <Card
      className={`overflow-hidden border-white/[0.1] bg-gradient-to-b from-white/[0.06] via-sigflo-surface to-black/35 p-1.5 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.9)] backdrop-blur-md md:p-2 ${
        liveTradeMode ? 'ring-1 ring-[#00ffc8]/14 shadow-[0_0_48px_-28px_rgba(0,255,200,0.12)]' : ''
      }`}
      style={{ ['--chart-h-desktop' as string]: `${chartHeightPx}px` }}
    >
      {exchangeStyleHero && showTimeframeBar && timeframeOptions && chartInterval != null && onChartIntervalChange ? (
        <>
          <div
            className={`mb-0 flex min-w-0 w-full flex-wrap items-end justify-between gap-x-2 gap-y-1 border-b bg-black/20 px-[4.5px] pb-[3px] pt-px md:gap-x-2.5 md:px-[5.5px] md:pb-[3.5px] md:pt-[2px] ${
              suppressExchangeHeroLivePrice && liveTradeMode
                ? 'border-[#00ffc8]/12'
                : 'border-white/[0.06]'
            }`}
          >
            <div className="flex min-w-0 shrink-0 flex-col justify-end gap-0.5">
              {suppressExchangeHeroLivePrice ? (
                <>
                  <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-sigflo-muted/90 md:text-[10px]">
                    Price chart
                  </span>
                  {liveHeaderMetrics?.secondaryLine ? (
                    <p
                      className={`max-w-[min(100%,16rem)] truncate text-[7px] font-semibold tabular-nums md:text-[8px] ${
                        liveHeaderMetrics.secondaryLineTone === 'positive'
                          ? 'text-emerald-300'
                          : liveHeaderMetrics.secondaryLineTone === 'negative'
                            ? 'text-rose-300'
                            : 'text-sigflo-muted'
                      }`}
                    >
                      {liveHeaderMetrics.secondaryLine}
                    </p>
                  ) : null}
                </>
              ) : (
                <div className="flex min-w-0 items-baseline gap-2 md:gap-[4.5px]">
                  <span
                    className={`text-xs font-bold tabular-nums leading-none transition-colors md:text-sm ${
                      priceDirection === 'up' ? 'text-emerald-200' : priceDirection === 'down' ? 'text-rose-200' : 'text-white'
                    }`}
                  >
                    {formatQuoteUsd(model.lastPrice)}
                  </span>
                  <span className={`text-[7px] font-medium tabular-nums leading-tight md:text-[8px] ${changeClass}`}>
                    {change >= 0 ? '+' : '−'}
                    {abs24hFmt} ({change >= 0 ? '+' : ''}
                    {change.toFixed(2)}%)
                  </span>
                </div>
              )}
            </div>
            <div className="ml-auto flex min-w-0 max-w-full shrink-0 items-end justify-end gap-x-1 gap-y-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-x-1.5 md:gap-y-1">
              <div className="flex w-max shrink-0 flex-nowrap items-end justify-end gap-1 md:gap-1.5">
                {timeframeOptions.map((intv) => (
                  <button
                    key={intv.value}
                    type="button"
                    onClick={() => onChartIntervalChange(intv.value)}
                    className={`shrink-0 rounded px-[6px] py-[3px] text-[8px] font-medium uppercase leading-none tracking-wide transition md:px-2 md:py-1 md:text-[9px] ${
                      chartInterval === intv.value
                        ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/25'
                        : 'bg-white/[0.04] text-sigflo-muted hover:bg-white/[0.07] hover:text-sigflo-text'
                    }`}
                  >
                    {intv.label}
                  </button>
                ))}
              </div>
              {onSetupModeToggle ? (
                <div className="shrink-0">
                  <SetupToggle isActive={setupMode === true} onToggle={onSetupModeToggle} />
                </div>
              ) : null}
              <span className="h-3 w-px shrink-0 bg-white/[0.12]" aria-hidden />
              <div className="flex shrink-0 items-end pb-px">{perpTimeCluster}</div>
            </div>
          </div>
          {liveTradeMode && liveHeaderMetrics && !suppressExchangeHeroLivePrice ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[#00ffc8]/12 bg-gradient-to-r from-[#00ffc8]/[0.06] via-black/20 to-transparent px-[4.5px] py-[4px] md:px-[5.5px]">
              <span className="text-[6px] font-extrabold uppercase tracking-[0.14em] text-[#7ee8d3]/90 md:text-[7px]">
                {liveActivePositionTitle}
              </span>
              <span className="text-[7px] font-medium tabular-nums text-sigflo-muted md:text-[8px]">
                Risk{' '}
                <span className="text-rose-200/90">{liveHeaderMetrics.riskPercent.toFixed(1)}%</span>
                <span className="text-sigflo-muted/60"> · </span>
                Target{' '}
                <span className="text-emerald-200/90">{liveHeaderMetrics.rewardPercent.toFixed(1)}%</span>
                <span className="text-sigflo-muted/60"> · </span>
                R:R{' '}
                <span className="text-white/90">
                  {Number.isFinite(liveHeaderMetrics.rrRatio) && liveHeaderMetrics.rrRatio > 0
                    ? liveHeaderMetrics.rrRatio.toFixed(1)
                    : '—'}
                </span>
              </span>
              {liveHeaderMetrics.badge ? (
                <span className="rounded border border-cyan-400/25 bg-cyan-500/10 px-1.5 py-px text-[6px] font-bold uppercase tracking-wide text-cyan-100/95 md:text-[7px]">
                  {liveHeaderMetrics.badge}
                </span>
              ) : null}
            </div>
          ) : null}
        </>
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
              <span className="hidden shrink-0 text-[9px] font-semibold uppercase tracking-[0.16em] text-sigflo-muted/80 sm:inline md:text-[10px]">
                TF
              </span>
              <div className="min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex w-max items-center justify-end gap-1 pr-0.5">
                  {timeframeOptions.map((intv) => (
                    <button
                      key={intv.value}
                      type="button"
                      onClick={() => onChartIntervalChange(intv.value)}
                      className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold leading-none transition md:px-2.5 md:py-1 md:text-[11px] ${
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
      {exchangeStyleHero &&
      metaCaption &&
      !(showTimeframeBar && timeframeOptions && chartInterval != null && onChartIntervalChange) ? (
        <p className="mt-0 border-b border-white/[0.06] bg-black/20 px-2 py-1 text-[9px] font-medium leading-snug tracking-wide text-sigflo-muted/75 md:px-2.5 md:py-1 md:text-[10px]">
          {metaCaption}
        </p>
      ) : null}
      <div
        className={`mt-0 min-h-0 overflow-hidden transition-[box-shadow] duration-500 ${
          exchangeTfHero
            ? 'rounded-t-none rounded-b-lg border border-t-0 border-white/[0.08] bg-black/20 md:rounded-b-xl'
            : 'rounded-lg border border-white/[0.08] bg-black/30 md:rounded-xl'
        } ${chartFrameToneClass}`}
      >
        <div
          ref={chartContainerRef}
          className={
            chartPlotHeightPx != null
              ? 'w-full shrink-0 overflow-hidden bg-black/20 transition-[height] duration-300 ease-out'
              : 'h-[20dvh] min-h-[72px] max-h-[20dvh] w-full shrink-0 overflow-hidden bg-black/20 md:h-[var(--chart-h-desktop)] md:max-h-none md:min-h-[200px]'
          }
          style={chartPlotHeightPx != null ? { height: chartPlotHeightPx } : undefined}
          onPointerLeave={() => {
            skipScrollToRealTimeRef.current = true;
          }}
          onPointerEnter={() => {
            applySkipScrollFromViewportRef.current();
          }}
        />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-white/[0.06] bg-black/20 px-[4.5px] py-[3.5px] md:gap-x-2.5 md:px-[5.5px] md:py-[4.5px]">
          <div className="relative z-10 flex min-w-0 flex-wrap items-center gap-[3.5px] text-[7px] font-medium leading-tight md:gap-[4.5px] md:text-[8px]">
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
                  onClick={() => {
                    if (setupGated) {
                      setSoloOverlayFromClean(key);
                      if (onRequestSetupMode) onRequestSetupMode();
                      else onSetupModeToggle?.();
                      return;
                    }
                    if (liveTradeOverlayPreset) {
                      liveOverlayTouchedKeysRef.current.add(key);
                    }
                    setVisibleLevels((prev) => ({
                      ...prev,
                      [key]: !prev[key],
                    }));
                  }}
                  title={
                    setupGated
                      ? `Clean view — tap to show only ${levelStyles[key].label} in Setup`
                      : undefined
                  }
                  className={`rounded-sm px-[5.5px] py-[3.5px] transition md:px-[7px] md:py-[3px] ${
                    setupGated ? 'opacity-70 ring-1 ring-white/[0.06] hover:opacity-95' : ''
                  } ${
                    visibleLevels[key]
                      ? `${levelStyles[key].labelClass} bg-white/[0.08] ring-1 ring-white/15`
                      : 'bg-white/[0.03] text-sigflo-muted'
                  }`}
                  aria-pressed={visibleLevels[key]}
                  aria-label={
                    setupGated ? `Enable setup overlays (${levelStyles[key].label})` : `Toggle ${levelStyles[key].label} level`
                  }
                >
                  {levelStyles[key].label}
                </button>
              ))}
            {exchangeStyleHero && metaCaption ? (
              <>
                <span className="h-3 w-px shrink-0 self-center bg-white/[0.12]" aria-hidden />
                <span className="shrink-0 whitespace-nowrap text-[7px] font-medium leading-tight text-sigflo-muted md:text-[8px]">
                  {metaCaption}
                </span>
              </>
            ) : null}
          </div>
          <MarketStatsRow model={model} variant="compact" />
        </div>
      </div>
    </Card>
  );
}
