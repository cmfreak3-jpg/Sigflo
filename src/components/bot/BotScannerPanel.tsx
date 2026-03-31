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
      <p className="text-[10px] uppercase tracking-[0.14em] text-cyan-200/85">Scanner</p>
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
