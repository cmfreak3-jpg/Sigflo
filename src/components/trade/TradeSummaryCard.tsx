import { Card } from '@/components/ui/Card';
import type { MarketMode } from '@/types/trade';
import type { ReactNode } from 'react';

function fmtWholeUsd(n: number) {
  return `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
}

function fmtSignedPnl(n: number) {
  const abs = Math.round(Math.abs(n)).toLocaleString('en-US');
  if (n < 0) return `-$${abs}`;
  if (n > 0) return `+$${abs}`;
  return '$0';
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-sigflo-muted">{label}</span>
      <span className={`text-right font-medium tabular-nums tracking-tight ${valueClass ?? 'text-sigflo-text'}`}>{value}</span>
    </div>
  );
}

function GroupSection({ children }: { children: ReactNode }) {
  return (
    <div className="border-t border-white/[0.04] pt-5 first:border-0 first:pt-0">
      {children}
    </div>
  );
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
  const isFutures = market === 'futures';

  return (
    <Card className="p-4">
      <h2 className="mb-5 text-sm font-semibold text-white">Trade summary</h2>
      <div className="flex flex-col">
        <GroupSection>
          <div className="space-y-1.5">
            <Row label="Balance" value={fmtWholeUsd(model.balanceUsd)} />
            <Row label="Using" value={fmtWholeUsd(model.amountUsedUsd)} />
          </div>
        </GroupSection>

        <GroupSection>
          <div className="space-y-1.5">
            <Row label="Leverage" value={`${model.leverage}×`} />
            <Row label="Position" value={fmtWholeUsd(model.positionSizeUsd)} />
          </div>
        </GroupSection>

        <GroupSection>
          <div className="space-y-1.5">
            <Row label="If target hit" value={fmtSignedPnl(model.targetProfitUsd)} valueClass="text-emerald-300" />
            <Row label="If stop hit" value={fmtSignedPnl(model.stopLossUsd)} valueClass="text-rose-300" />
          </div>
        </GroupSection>

        {isFutures && (
          <GroupSection>
            <div className="space-y-1.5">
              <Row
                label="Liquidation"
                value={`$${model.liquidation.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                valueClass="text-amber-200"
              />
            </div>
          </GroupSection>
        )}

        <GroupSection>
          <div className="space-y-1.5">
            <Row label="Risk/Reward" value={`1 : ${model.riskReward.toFixed(2)}`} valueClass="text-cyan-200" />
          </div>
        </GroupSection>
      </div>
    </Card>
  );
}
