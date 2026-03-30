import { Card } from '@/components/ui/Card';
import type { RiskLevel, TradeSide } from '@/types/trade';

function money(n: number) {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

const riskTone: Record<RiskLevel, string> = {
  Low: 'text-emerald-300 bg-emerald-500/10 border-emerald-400/20',
  Medium: 'text-amber-200 bg-amber-500/10 border-amber-400/20',
  High: 'text-rose-200 bg-rose-500/10 border-rose-400/20',
};

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
    balanceUsd,
    amountUsd,
    leverage,
    side,
    positionSizeUsd,
    walletUsedPct,
    liquidationRisk,
    onAmountChange,
    onLeverageChange,
    onSideChange,
  } = props;

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Order setup</h2>
        <span className="text-xs text-sigflo-muted">Available {money(balanceUsd)}</span>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs uppercase tracking-wide text-sigflo-muted">Amount (USD)</span>
        <input
          type="number"
          min={0}
          step={50}
          value={amountUsd}
          onChange={(e) => onAmountChange(Number(e.target.value || 0))}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none ring-cyan-400/30 placeholder:text-sigflo-muted focus:ring"
          placeholder="0"
        />
      </label>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-sigflo-muted">Leverage</span>
          <span className="text-sm font-semibold text-cyan-200">{leverage}x</span>
        </div>
        <input
          type="range"
          min={1}
          max={30}
          step={1}
          value={leverage}
          onChange={(e) => onLeverageChange(Number(e.target.value))}
          className="w-full accent-cyan-400"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onSideChange('long')}
          className={`rounded-xl py-2.5 text-sm font-semibold transition ${
            side === 'long'
              ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-sigflo-bg'
              : 'border border-white/10 bg-white/[0.03] text-sigflo-text'
          }`}
        >
          Long
        </button>
        <button
          type="button"
          onClick={() => onSideChange('short')}
          className={`rounded-xl py-2.5 text-sm font-semibold transition ${
            side === 'short'
              ? 'bg-gradient-to-r from-rose-500 to-cyan-500 text-white'
              : 'border border-white/10 bg-white/[0.03] text-sigflo-text'
          }`}
        >
          Short
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-sigflo-muted">Position size</span>
          <span className="font-semibold text-white">{money(positionSizeUsd)}</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-xs">
          <span className="text-sigflo-muted">{walletUsedPct.toFixed(1)}% of wallet used</span>
          <span className={`rounded-full border px-2 py-0.5 ${riskTone[liquidationRisk]}`}>
            Liq risk: {liquidationRisk}
          </span>
        </div>
      </div>
    </Card>
  );
}
