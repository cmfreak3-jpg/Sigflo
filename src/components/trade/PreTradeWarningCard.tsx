import { RiskMeter } from '@/components/ui/RiskMeter';
import type { RiskLevel } from '@/types/trade';

function actionHint(tradeScore: number): string {
  if (tradeScore >= 75) return 'Good execution — entry active';
  if (tradeScore >= 60) return 'Acceptable — keep size controlled';
  if (tradeScore >= 45) return 'Too aggressive — reduce size';
  return 'Risk high — lower leverage';
}

export function PreTradeWarningCard(props: {
  walletUsedPct: number;
  leverage: number;
  riskLevel: RiskLevel;
  riskMeterPct: number;
  tradeScore: number;
  setupTradeConflictMessage?: string;
  walletImpactLabel: string;
  primaryMessage: string;
  warnings: string[];
}) {
  const { walletUsedPct, riskLevel, riskMeterPct, tradeScore } = props;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-white">{actionHint(tradeScore)}</span>
        <span className="text-xs font-semibold text-sigflo-muted">Score {tradeScore}</span>
      </div>

      <RiskMeter pct={riskMeterPct} level={riskLevel} />

      <p className="text-xs text-sigflo-muted">
        Risking: <span className="font-semibold text-white">{walletUsedPct.toFixed(1)}%</span>
      </p>
    </div>
  );
}
