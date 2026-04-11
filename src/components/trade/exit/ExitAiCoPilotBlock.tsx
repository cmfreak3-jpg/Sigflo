import type { ExitAiMode } from '@/types/aiExitAutomation';
import type { ExitAiCoPilotModel } from '@/lib/exitAiCoPilot';

export type ExitAiCoPilotBlockProps = {
  model: ExitAiCoPilotModel;
  exitMode: ExitAiMode;
  onExitModeChange: (m: ExitAiMode) => void;
  onCloseNow: () => void;
  actionsDisabled?: boolean;
  /** Dense layout for bot focus / narrow strips */
  compact?: boolean;
};

export function ExitAiCoPilotBlock({
  model,
  exitMode,
  onExitModeChange,
  onCloseNow,
  actionsDisabled = false,
  compact = false,
}: ExitAiCoPilotBlockProps) {
  const aiOn = exitMode !== 'manual';
  const pad = compact ? 'px-3 py-2.5' : 'px-3 py-3';
  const titleSz = compact ? 'text-[9px]' : 'text-[10px]';
  const intentSz = compact ? 'text-[12px]' : 'text-[13px]';

  return (
    <section
      className={`rounded-2xl border bg-landing-surface/90 ${pad} ${model.panelToneClass}`}
      aria-label="Exit AI co-pilot"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`${titleSz} font-bold uppercase tracking-[0.16em] text-landing-muted`}>Exit AI</p>
          <p className="mt-1 text-sm font-bold tracking-tight text-landing-text">{model.statusTitle}</p>
        </div>
        {aiOn ? (
          <span className="shrink-0 rounded-full border border-landing-accent/35 bg-landing-accent-dim/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-landing-accent-hi">
            Active
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-white/[0.1] bg-black/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-landing-muted">
            Manual
          </span>
        )}
      </div>

      <p className={`mt-2 leading-snug text-landing-text/95 ${intentSz}`}>{model.intentLine}</p>

      {model.confidenceLine ? (
        <p className="mt-2 text-[11px] leading-relaxed text-landing-muted">{model.confidenceLine}</p>
      ) : null}

      <p className="mt-2 border-t border-white/[0.06] pt-2 text-[11px] leading-relaxed text-landing-text/88">
        <span className="font-semibold text-landing-accent-hi/95">Next if conditions shift · </span>
        {model.actionPreview}
      </p>

      {model.contextLine ? (
        <p className="mt-2 text-[11px] leading-relaxed text-landing-muted">{model.contextLine}</p>
      ) : null}

      <div className={`mt-3 flex flex-wrap gap-2 ${compact ? '' : ''}`}>
        <button
          type="button"
          disabled={actionsDisabled}
          onClick={onCloseNow}
          className="rounded-xl border border-rose-400/35 bg-rose-500/12 px-3 py-2 text-[11px] font-bold text-rose-100 transition hover:bg-rose-500/18 active:scale-[0.99] disabled:opacity-45"
        >
          Close now
        </button>
        {aiOn ? (
          <button
            type="button"
            disabled={actionsDisabled}
            onClick={() => onExitModeChange('manual')}
            className="rounded-xl border border-white/[0.1] bg-black/25 px-3 py-2 text-[11px] font-bold text-landing-text transition hover:border-white/[0.14] active:scale-[0.99] disabled:opacity-45"
          >
            Use static SL/TP
          </button>
        ) : (
          <button
            type="button"
            disabled={actionsDisabled}
            onClick={() => onExitModeChange('assisted')}
            className="rounded-xl border border-landing-accent/35 bg-landing-accent-dim/50 px-3 py-2 text-[11px] font-bold text-landing-accent-hi transition hover:border-landing-accent/45 active:scale-[0.99] disabled:opacity-45"
          >
            Enable exit AI
          </button>
        )}
      </div>
    </section>
  );
}
