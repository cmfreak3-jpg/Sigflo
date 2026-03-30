import { Card } from '@/components/ui/Card';
import { useEffect, useMemo, useState } from 'react';

type Props = {
  symbol: string; // e.g. BTCUSDT
  interval: '5' | '15' | '60' | '240' | 'D' | 'W';
};

function tvInterval(interval: Props['interval']): string {
  if (interval === '5') return '5';
  if (interval === '15') return '15';
  if (interval === '60') return '60';
  if (interval === '240') return '240';
  if (interval === 'D') return 'D';
  return 'W';
}

export function TradingViewChartCard({ symbol, interval }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const tvSymbol = `BYBIT:${symbol}`;
  const src = useMemo(
    () =>
      `https://www.tradingview.com/widgetembed/?` +
      `symbol=${encodeURIComponent(tvSymbol)}` +
      `&interval=${encodeURIComponent(tvInterval(interval))}` +
      `&theme=dark&style=1&timezone=Etc/UTC` +
      `&withdateranges=1&hide_side_toolbar=1&allow_symbol_change=0&save_image=0&details=0&hotlist=0&calendar=0`,
    [interval, tvSymbol]
  );

  useEffect(() => {
    setLoaded(false);
    setTimedOut(false);
    const t = window.setTimeout(() => {
      setTimedOut(true);
    }, 7000);
    return () => window.clearTimeout(t);
  }, [src]);

  return (
    <Card className="overflow-hidden p-2">
      <div className="mb-2 flex items-center justify-between px-2">
        <h2 className="text-sm font-semibold text-white">TradingView</h2>
        <span className="text-[11px] text-sigflo-muted">{tvSymbol}</span>
      </div>
      <div className="relative h-[320px] w-full overflow-hidden rounded-xl border border-white/10 bg-sigflo-bg">
        {!loaded && !timedOut ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-sigflo-muted">
            Loading TradingView...
          </div>
        ) : null}
        {timedOut ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-sigflo-bg/95 px-4 text-center">
            <p className="text-xs text-sigflo-muted">
              Embed is blocked in this environment. Open TradingView in a new tab instead.
            </p>
            <a
              href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-cyan-400/35 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200"
            >
              Open TradingView
            </a>
          </div>
        ) : null}
        <iframe
          title="TradingView Chart"
          src={src}
          className="h-full w-full bg-sigflo-bg"
          onLoad={() => setLoaded(true)}
        />
      </div>
      <a
        href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block px-2 text-[11px] text-cyan-300 hover:text-cyan-200"
      >
        Open in TradingView
      </a>
    </Card>
  );
}

