type BotHeaderProps = {
  pair: string;
  freshness: string;
  statusLabel: string;
  statusTextClass: string;
  statusDotClass: string;
};

export function BotHeader({ pair, freshness, statusLabel, statusTextClass, statusDotClass }: BotHeaderProps) {
  return (
    <header className="rounded-2xl border border-white/[0.07] bg-sigflo-surface p-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">{pair} / USDT</h1>
          <p className="mt-0.5 text-[10px] text-sigflo-muted">Triggered {freshness}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusTextClass}`}>
          <span className="relative flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full animate-pulse-dot rounded-full ${statusDotClass} [animation-duration:2.2s]`} />
            <span className={`relative inline-flex h-full w-full rounded-full ${statusDotClass}`} />
          </span>
          {statusLabel}
        </span>
      </div>
    </header>
  );
}
