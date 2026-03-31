import type { RiskLevel, TradeSide } from '@/types/trade';

function money(n: number) {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

export function OrderInputsCard(props: {
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
    balanceUsd, amountUsd, leverage, side, positionSizeUsd, walletUsedPct,
    liquidationRisk, onAmountChange, onLeverageChange, onSideChange,
  } = props;

  const riskColor = liquidationRisk === 'High' ? 'text-rose-400' : liquidationRisk === 'Medium' ? 'text-amber-300' : 'text-emerald-400';

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-4 space-y-4">
      <div className="flex items-center justify-between text-xs text-sigflo-muted">
        <span className="font-semibold text-white text-sm">Order</span>
        <span>Balance {money(balanceUsd)}</span>
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] uppercase tracking-widest text-sigflo-muted">Amount (USD)</span>
        <input
          type="number"
          min={0}
          step={50}
          value={amountUsd}
          onChange={(e) => onAmountChange(Number(e.target.value || 0))}
          className="w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5 text-sm text-white outline-none ring-sigflo-accent/30 placeholder:text-sigflo-muted focus:ring"
          placeholder="0"
        />
      </label>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-sigflo-muted">Leverage</span>
          <span className="font-bold text-white">{leverage}x</span>
        </div>
        <input
          type="range" min={1} max={30} step={1} value={leverage}
          onChange={(e) => onLeverageChange(Number(e.target.value))}
          className="w-full accent-sigflo-accent"
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
          Long
        </button>
        <button
          type="button"
          onClick={() => onSideChange('short')}
          className={`rounded-xl py-2.5 text-sm font-bold transition ${
            side === 'short' ? 'bg-rose-500 text-white' : 'border border-white/[0.08] text-sigflo-text'
          }`}
        >
          Short
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
