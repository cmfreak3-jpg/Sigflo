type BotRiskSnapshotProps = {
  risk: string;
  rr: string;
  walletPct: string;
};

export function BotRiskSnapshot({ risk, rr, walletPct }: BotRiskSnapshotProps) {
  return (
    <section className="mt-3 rounded-2xl border border-white/[0.06] bg-sigflo-surface p-3 opacity-0 [animation:fade-in-up_220ms_ease-out_320ms_forwards]">
      <div className="flex items-center justify-between text-xs text-sigflo-muted">
        <p>Risk: <span className="font-semibold text-white">{risk}</span></p>
        <p>R:R <span className="font-semibold text-white">{rr}</span></p>
        <p>Wallet: <span className="font-semibold text-white">{walletPct}</span></p>
      </div>
    </section>
  );
}
