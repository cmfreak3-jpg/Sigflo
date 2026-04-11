export type AssistedExitConfirmBarProps = {
  headline: string;
  detail: string;
  onConfirm: () => void;
  /** Exit assisted mode without confirming (e.g. position already closed on the exchange). */
  onDismiss?: () => void;
};

export function AssistedExitConfirmBar(props: AssistedExitConfirmBarProps) {
  return (
    <div className="mx-auto w-full max-w-lg rounded-xl border border-amber-400/25 bg-amber-500/[0.08] px-2.5 py-2 shadow-[0_0_20px_-8px_rgba(251,191,36,0.2)]">
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-amber-200/90">Assisted exit ready</p>
      <p className="mt-1 text-[10px] font-semibold text-white">{props.headline}</p>
      <p className="mt-0.5 text-[9px] leading-snug text-white/75">{props.detail}</p>
      <button
        type="button"
        onClick={props.onConfirm}
        className="mt-2 w-full rounded-xl bg-sigflo-accent py-2 text-[11px] font-bold uppercase tracking-wide text-sigflo-bg shadow-glow-sm transition hover:brightness-110 active:scale-[0.99]"
      >
        Confirm prepared exit
      </button>
      {props.onDismiss ? (
        <button
          type="button"
          onClick={props.onDismiss}
          className="mt-2 w-full rounded-lg py-1.5 text-[10px] font-semibold text-sigflo-muted transition hover:bg-white/[0.04] hover:text-white"
        >
          Dismiss — switch Exit AI to Manual
        </button>
      ) : null}
      <p className="mt-1.5 text-center text-[8px] text-sigflo-muted">
        Sends a market reduce-only (futures) or market sell (spot) order on your connected exchange.
      </p>
    </div>
  );
}
