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
  walletUsedPct: number;
  leverage: number;
  positionSizeUsd: number;
  livePnlUsd: number;
  livePnlPct: number;
  targetProfitUsd: number;
  stopLossUsd: number;
  liquidation: number;
  riskReward: number;
};

export function TradeSummaryCard({ model, market }: { model: TradeSummaryModel; market: MarketMode }) {
  const livePnlClass = model.livePnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400';
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-4 space-y-2">
      <div className="grid grid-cols-3 gap-2 pb-1">
        <div className="rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5">
          <p className="text-[10px] text-sigflo-muted">Position</p>
          <p className="mt-0.5 text-xs font-semibold text-white">${Math.round(model.positionSizeUsd).toLocaleString('en-US')}</p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5">
          <p className="text-[10px] text-sigflo-muted">Used</p>
          <p className="mt-0.5 text-xs font-semibold text-white">${Math.round(model.amountUsedUsd).toLocaleString('en-US')}</p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5">
          <p className="text-[10px] text-sigflo-muted">Wallet</p>
          <p className="mt-0.5 text-xs font-semibold text-white">{model.walletUsedPct.toFixed(1)}%</p>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-sigflo-muted">Now (PnL)</span>
        <span className={`font-bold tabular-nums ${livePnlClass}`}>
          {fmtSignedPnl(model.livePnlUsd)} ({model.livePnlPct >= 0 ? '+' : ''}
          {model.livePnlPct.toFixed(2)}%)
        </span>
      </div>
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
