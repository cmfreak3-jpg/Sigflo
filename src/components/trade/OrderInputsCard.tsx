import type { MarketMode, RiskLevel, TradeSide } from '@/types/trade';

function money(n: number) {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

export function OrderInputsCard(props: {
  market: MarketMode;
  balanceUsd: number;
  amountUsd: number;
  leverage: number;
  side: TradeSide;
  positionSizeUsd: number;
  walletUsedPct: number;
  liquidationRisk: RiskLevel;
  onAmountChange: (v: number) => void;
  onLeverageChange: (v: number) => void;
  onSideChange: (s: TradeSide) => void;
}) {
  const {
    market, balanceUsd, amountUsd, leverage, side, positionSizeUsd, walletUsedPct,
    liquidationRisk, onAmountChange, onLeverageChange, onSideChange,
  } = props;
  const amountMax = Math.max(0, Math.round(balanceUsd));

  const riskColor = liquidationRisk === 'High' ? 'text-rose-400' : liquidationRisk === 'Medium' ? 'text-amber-300' : 'text-emerald-400';

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-4 space-y-4">
      <div className="flex items-center justify-between text-xs text-sigflo-muted">
        <span className="font-semibold text-white text-sm">Order</span>
        <span>Balance {money(balanceUsd)}</span>
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] uppercase tracking-widest text-sigflo-muted">Amount (USD)</span>
        <div className="group relative">
          <input
            type="number"
            min={0}
            max={amountMax}
            step={50}
            value={amountUsd}
            onChange={(e) => onAmountChange(Number(e.target.value || 0))}
            className="sigflo-number-input w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5 pr-11 text-sm text-white outline-none ring-sigflo-accent/30 placeholder:text-sigflo-muted focus:ring"
            placeholder="0"
          />
          <div className="pointer-events-none absolute inset-y-1.5 right-1 flex w-7 flex-col gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
            <button
              type="button"
              onClick={() => onAmountChange(Math.min(amountMax, Math.max(0, amountUsd + 50)))}
              className="flex h-1/2 items-center justify-center rounded border border-white/[0.08] bg-white/[0.06] text-[9px] leading-none text-sigflo-text transition hover:bg-white/[0.12]"
              aria-label="Increase amount"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => onAmountChange(Math.max(0, amountUsd - 50))}
              className="flex h-1/2 items-center justify-center rounded border border-white/[0.08] bg-white/[0.06] text-[9px] leading-none text-sigflo-text transition hover:bg-white/[0.12]"
              aria-label="Decrease amount"
            >
              -
            </button>
          </div>
        </div>
      </label>
      <div className="space-y-1.5">
        <input
          type="range"
          min={0}
          max={amountMax}
          step={25}
          value={Math.min(Math.max(0, amountUsd), amountMax)}
          onChange={(e) => onAmountChange(Number(e.target.value))}
          className="w-full accent-sigflo-accent"
          aria-label="Amount slider"
        />
        <div className="flex items-center justify-end gap-1.5">
          {[
            { id: '25', label: '25%', v: 0.25 },
            { id: '50', label: '50%', v: 0.5 },
            { id: '75', label: '75%', v: 0.75 },
            { id: 'max', label: 'Max', v: 1 },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => onAmountChange(Math.round(amountMax * chip.v))}
              className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] font-semibold text-sigflo-muted transition hover:bg-white/[0.08] hover:text-sigflo-text"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-sigflo-muted">Leverage</span>
          <span className="font-bold text-white">{leverage}x</span>
        </div>
        <input
          type="range" min={1} max={30} step={1} value={leverage}
          onChange={(e) => onLeverageChange(Number(e.target.value))}
          className="w-full accent-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onSideChange('long')}
          className={`rounded-xl py-2.5 text-sm font-bold transition ${
            side === 'long' ? 'bg-sigflo-accent text-sigflo-bg' : 'border border-white/[0.08] text-sigflo-text'
          }`}
        >
          {market === 'spot' ? 'Buy' : 'Long'}
        </button>
        <button
          type="button"
          onClick={() => onSideChange('short')}
          className={`rounded-xl py-2.5 text-sm font-bold transition ${
            side === 'short' ? 'bg-rose-500 text-white' : 'border border-white/[0.08] text-sigflo-text'
          }`}
        >
          {market === 'spot' ? 'Sell' : 'Short'}
        </button>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-sigflo-muted">
          {money(positionSizeUsd)} position · {walletUsedPct.toFixed(1)}% wallet
        </span>
        <span className={`font-semibold ${riskColor}`}>Liq: {liquidationRisk}</span>
      </div>
    </div>
  );
}
