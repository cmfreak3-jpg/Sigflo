import { Link } from 'react-router-dom';

type BotTradeCtaProps = {
  to: string;
  ctaPulse: boolean;
  stopUsd: number;
  targetUsd: number;
  onBack: () => void;
};

export function BotTradeCta({ to, ctaPulse, stopUsd, targetUsd, onBack }: BotTradeCtaProps) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 opacity-0 [animation:fade-in-up_220ms_ease-out_380ms_forwards]">
      <button
        type="button"
        onClick={onBack}
        className="rounded-xl border border-white/[0.08] bg-white/[0.02] py-2.5 text-sm font-semibold text-sigflo-muted transition hover:text-white"
      >
        Back to Markets
      </button>
      <Link
        to={to}
        className={`rounded-xl bg-sigflo-accent px-2 py-2 text-center text-sm font-bold text-sigflo-bg transition ${
          ctaPulse ? '[animation:sigflo-entry-pulse_520ms_ease-out_1]' : ''
        }`}
      >
        <span className="block">Enter Trade</span>
        <span className="block text-[11px] font-semibold text-sigflo-bg/80">
          -${Math.round(Math.abs(stopUsd)).toLocaleString()} / +${Math.round(Math.abs(targetUsd)).toLocaleString()}
        </span>
      </Link>
    </div>
  );
}
