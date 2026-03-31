type BotAiAction = 'entry' | 'why' | 'improve' | null;

type BotAiActionRowProps = {
  activeAction: BotAiAction;
  loading: boolean;
  copy: string;
  onRefineEntry: () => void;
  onWhy: () => void;
  onImprove: () => void;
};

export function BotAiActionRow({
  activeAction,
  loading,
  copy,
  onRefineEntry,
  onWhy,
  onImprove,
}: BotAiActionRowProps) {
  return (
    <section className="mt-3 rounded-2xl border border-white/[0.06] bg-sigflo-surface p-3 opacity-0 [animation:fade-in-up_240ms_ease-out_200ms_forwards]">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRefineEntry}
          className={`rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-semibold transition active:scale-[0.98] ${
            activeAction === 'entry' ? 'bg-[#00ffc8]/14 text-[#a8ffed]' : 'bg-white/[0.03] text-sigflo-text'
          }`}
        >
          Refine Entry ✨
        </button>
        <button
          type="button"
          onClick={onWhy}
          className={`rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-semibold transition active:scale-[0.98] ${
            activeAction === 'why' ? 'bg-cyan-500/14 text-cyan-200' : 'bg-white/[0.03] text-sigflo-text'
          }`}
        >
          Why?
        </button>
        <button
          type="button"
          onClick={onImprove}
          className={`rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-semibold transition active:scale-[0.98] ${
            activeAction === 'improve' ? 'bg-emerald-500/14 text-emerald-200' : 'bg-white/[0.03] text-sigflo-text'
          }`}
        >
          Improve
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-sigflo-muted">
        {loading ? 'Assistant refining...' : copy}
      </p>
    </section>
  );
}
