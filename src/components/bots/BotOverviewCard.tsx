export type BotOverviewMetrics = {
  activeBots: number;
  scanningBots: number;
  marketsWatched: number;
  signalsToday: number;
};

export type BotOverviewCardProps = {
  metrics: BotOverviewMetrics;
  subline: string;
  onAddBot?: () => void;
};

export function BotOverviewCard({ metrics, subline, onAddBot }: BotOverviewCardProps) {
  const cells: { label: string; value: string; accent?: boolean }[] = [
    { label: 'Active', value: String(metrics.activeBots), accent: metrics.activeBots > 0 },
    { label: 'Scanning', value: String(metrics.scanningBots) },
    { label: 'Markets', value: String(metrics.marketsWatched) },
    { label: 'Signals today', value: String(metrics.signalsToday) },
  ];

  return (
    <header className="relative overflow-hidden rounded-2xl border border-[rgba(0,255,200,0.14)] bg-gradient-to-b from-[#0a1614]/95 to-sigflo-surface shadow-[0_0_40px_-20px_rgba(0,255,200,0.45),inset_0_1px_0_0_rgba(255,255,255,0.04)] ring-1 ring-[rgba(0,255,200,0.08)]">
      <div
        className="pointer-events-none absolute -right-8 -top-12 h-32 w-32 rounded-full bg-[#00ffc8]/[0.07] blur-2xl"
        aria-hidden
      />
      <div className="relative p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">Bots</h1>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-sigflo-muted/90">
              Command center
            </p>
          </div>
          {onAddBot ? (
            <button
              type="button"
              onClick={onAddBot}
              className="shrink-0 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-cyan-100/95 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] transition active:scale-[0.97] hover:border-[rgba(0,255,200,0.25)] hover:bg-[rgba(0,255,200,0.06)] hover:text-[#b8fff0]"
            >
              + Add bot
            </button>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {cells.map((c) => (
            <div
              key={c.label}
              className={`rounded-xl border px-1.5 py-2 text-center ${
                c.accent
                  ? 'border-[rgba(0,255,200,0.22)] bg-[rgba(0,255,200,0.06)] shadow-[0_0_20px_-12px_rgba(0,255,200,0.5)]'
                  : 'border-white/[0.06] bg-black/25'
              }`}
            >
              <p className="text-[8px] font-semibold uppercase tracking-wider text-sigflo-muted">{c.label}</p>
              <p
                className={`mt-0.5 text-base font-bold tabular-nums leading-none ${
                  c.accent ? 'text-[#b8fff0]' : 'text-white'
                }`}
              >
                {c.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/[0.05] bg-black/30 px-3 py-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-[#00ffc8] opacity-40 [animation-duration:2.4s]" />
            <span className="relative inline-flex h-full w-full rounded-full bg-[#00ffc8] shadow-[0_0_10px_rgba(0,255,200,0.5)]" />
          </span>
          <p className="text-[11px] font-medium leading-snug text-cyan-100/85">{subline}</p>
        </div>
      </div>
    </header>
  );
}
