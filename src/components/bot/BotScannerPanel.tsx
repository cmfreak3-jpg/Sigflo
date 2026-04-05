type BotScannerPanelProps = {
  mainRead: string;
  watch: string;
  setupScore: number;
  setupScoreLabel: string;
  entryTiming: string;
  actionLine: string;
};

export function BotScannerPanel({
  mainRead,
  watch,
  setupScore,
  setupScoreLabel,
  entryTiming,
  actionLine,
}: BotScannerPanelProps) {
  return (
    <section className="mt-3 rounded-2xl border border-cyan-400/22 bg-sigflo-surface p-3 opacity-0 [animation:fade-in-up_260ms_ease-out_120ms_forwards]">
      <div className="flex items-center gap-1.5">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300/85 shadow-[0_0_8px_-2px_rgba(34,211,238,0.45)] ring-1 ring-cyan-400/22"
          aria-hidden
        />
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/88">AI Scanner</p>
      </div>
      <p className="mt-1 text-lg font-semibold text-white">{mainRead}</p>
      <p className="mt-1 text-sm font-semibold text-cyan-100">WATCH {watch}</p>
      <div className="mt-2 flex items-center justify-between text-[11px] text-sigflo-muted">
        <p>Setup: <span className="font-semibold text-white">{setupScore}</span> ({setupScoreLabel})</p>
        <p>Entry: <span className="font-semibold text-white">{entryTiming.replace('Entry ', '')}</span></p>
      </div>
      <p className="mt-2 text-[12px] font-semibold text-emerald-300">{actionLine}</p>
    </section>
  );
}
