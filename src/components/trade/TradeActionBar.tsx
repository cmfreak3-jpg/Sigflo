import type { MarketMode } from '@/types/trade';

export function TradeActionBar(props: {
  market: MarketMode;
  canExecute: boolean;
  onSellShort: () => void;
  onBuyLong: () => void;
  /** Brief glow after tap (instant execution feedback). */
  flashSide?: 'long' | 'short' | null;
}) {
  const { market, canExecute, onSellShort, onBuyLong, flashSide } = props;

  return (
    <div className="pointer-events-auto border-t border-white/10 bg-black/75 px-3 pt-3 backdrop-blur-xl">
      <div className="mx-auto grid max-w-lg grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!canExecute}
          onClick={onSellShort}
          className={`flex min-h-[3.5rem] flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-rose-500 to-rose-600 px-2 py-2 text-[15px] font-bold text-white shadow-[0_10px_32px_-10px_rgba(239,68,68,0.55)] transition enabled:active:scale-[0.98] enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 ${
            flashSide === 'short' ? 'ring-2 ring-red-200/90 shadow-[0_0_28px_-4px_rgba(248,113,113,0.55)]' : ''
          }`}
        >
          <span className="inline-flex items-center gap-1">
            <span aria-hidden>↓</span>
            {market === 'spot' ? 'Sell' : 'Sell Short'}
          </span>
          <span className="mt-0.5 text-[10px] font-semibold text-white/85">Market · Instant</span>
        </button>
        <button
          type="button"
          disabled={!canExecute}
          onClick={onBuyLong}
          className={`flex min-h-[3.5rem] flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-2 py-2 text-[15px] font-bold text-white shadow-[0_10px_32px_-10px_rgba(34,197,94,0.5)] transition enabled:active:scale-[0.98] enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 ${
            flashSide === 'long' ? 'ring-2 ring-emerald-200/90 shadow-[0_0_28px_-4px_rgba(0,255,200,0.45)]' : ''
          }`}
        >
          <span className="inline-flex items-center gap-1">
            <span aria-hidden>↑</span>
            {market === 'spot' ? 'Buy' : 'Buy Long'}
          </span>
          <span className="mt-0.5 text-[10px] font-semibold text-white/85">Market · Instant</span>
        </button>
      </div>
      <p className="mx-auto mt-2 flex max-w-lg items-center justify-center gap-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-[10px] text-sigflo-muted">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0 text-emerald-400/80" aria-hidden>
          <path
            d="M12 3l7 4v5c0 5-3 9-7 10-4-1-7-5-7-10V7l7-4z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        Trades execute instantly — plan size and risk before you tap.
      </p>
    </div>
  );
}
