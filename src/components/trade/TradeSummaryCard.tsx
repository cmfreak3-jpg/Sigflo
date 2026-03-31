import type { MarketMode } from '@/types/trade';

function fmtSignedPnl(n: number) {
  const abs = Math.round(Math.abs(n)).toLocaleString('en-US');
  if (n < 0) return `-$${abs}`;
  if (n > 0) return `+$${abs}`;
  return '$0';
}

export type TradeSummaryModel = {
  balanceUsd: number;
  amountUsedUsd: number;
  leverage: number;
  positionSizeUsd: number;
  targetProfitUsd: number;
  stopLossUsd: number;
  liquidation: number;
  riskReward: number;
};

export function TradeSummaryCard({ model, market }: { model: TradeSummaryModel; market: MarketMode }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-4 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-sigflo-muted">If target</span>
        <span className="font-bold text-emerald-400">{fmtSignedPnl(model.targetProfitUsd)}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-sigflo-muted">If stop</span>
        <span className="font-bold text-rose-400">{fmtSignedPnl(model.stopLossUsd)}</span>
      </div>
      {market === 'futures' && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-sigflo-muted">Liquidation</span>
          <span className="font-bold text-amber-300">${model.liquidation.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
        </div>
      )}
      <div className="flex items-center justify-between text-xs">
        <span className="text-sigflo-muted">R:R</span>
        <span className="font-bold text-sigflo-accent">1 : {model.riskReward.toFixed(2)}</span>
      </div>
    </div>
  );
}
