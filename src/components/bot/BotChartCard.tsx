import { formatQuoteNumber } from '@/lib/formatQuote';

type BotChartCardProps = {
  lastPrice: number;
  chartW: number;
  chartH: number;
  area: string;
  path: string;
  lineColor: string;
  showEntry: boolean;
  showStop: boolean;
  showTarget: boolean;
  showLiq: boolean;
  showVol: boolean;
  onToggleVol: () => void;
  onToggleEntry: () => void;
  onToggleStop: () => void;
  onToggleTarget: () => void;
  onToggleLiq: () => void;
};

export function BotChartCard(props: BotChartCardProps) {
  const {
    lastPrice,
    chartW,
    chartH,
    area,
    path,
    lineColor,
    showEntry,
    showStop,
    showTarget,
    showLiq,
    showVol,
    onToggleVol,
    onToggleEntry,
    onToggleStop,
    onToggleTarget,
    onToggleLiq,
  } = props;

  return (
    <section className="mt-3 rounded-2xl border border-white/[0.07] bg-sigflo-surface p-3 opacity-0 [animation:fade-in-up_260ms_ease-out_forwards]">
      <div className="mb-2 flex items-center justify-between text-xs">
        <p className="text-sigflo-muted">Chart</p>
        <p className="font-semibold text-white">${formatQuoteNumber(lastPrice)}</p>
      </div>
      <div className="relative overflow-hidden rounded-lg border border-white/[0.05] bg-black/20 p-2">
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="h-[132px] w-full" aria-hidden>
          <defs>
            <linearGradient id="bot-focus-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.24" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#bot-focus-area)" />
          <path d={path} fill="none" stroke={lineColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {showEntry ? <div className="absolute inset-x-2 top-1/2 border-t border-[#00ffc8]/70 shadow-[0_0_10px_rgba(0,255,200,0.45)]" /> : null}
        {showStop ? <div className="absolute inset-x-2 top-[64%] border-t border-rose-400/45" /> : null}
        {showTarget ? <div className="absolute inset-x-2 top-[33%] border-t border-emerald-300/45" /> : null}
        {showLiq ? <div className="absolute inset-x-2 top-[75%] border-t border-amber-300/35" /> : null}
        <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
          <button type="button" onClick={onToggleVol} className={`rounded px-2 py-0.5 ${showVol ? 'bg-cyan-500/14 text-cyan-200' : 'bg-white/[0.04] text-sigflo-muted'}`}>Vol</button>
          <button type="button" onClick={onToggleEntry} className={`rounded px-2 py-0.5 ${showEntry ? 'bg-[#00ffc8]/14 text-[#a8ffed]' : 'bg-white/[0.04] text-sigflo-muted'}`}>Entry</button>
          <button type="button" onClick={onToggleStop} className={`rounded px-2 py-0.5 ${showStop ? 'bg-rose-500/14 text-rose-200' : 'bg-white/[0.04] text-sigflo-muted'}`}>Stop</button>
          <button type="button" onClick={onToggleTarget} className={`rounded px-2 py-0.5 ${showTarget ? 'bg-emerald-500/14 text-emerald-200' : 'bg-white/[0.04] text-sigflo-muted'}`}>Target</button>
          <button type="button" onClick={onToggleLiq} className={`rounded px-2 py-0.5 ${showLiq ? 'bg-amber-500/14 text-amber-200' : 'bg-white/[0.04] text-sigflo-muted'}`}>Liq</button>
        </div>
      </div>
    </section>
  );
}
