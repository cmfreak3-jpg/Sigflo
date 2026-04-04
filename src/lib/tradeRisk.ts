import type { RiskLevel, RiskSummary, TradeSide, TradeViewModel } from '@/types/trade';

export interface TradeInputs {
  amountUsd: number;
  leverage: number;
  side: TradeSide;
  market: 'futures' | 'spot';
  setupScore: number;
}

export interface DerivedTradeMetrics {
  balanceUsd: number;
  amountUsedUsd: number;
  leverage: number;
  positionSizeUsd: number;
  targetProfitUsd: number;
  stopLossUsd: number;
  liquidation: number;
  walletUsedPct: number;
  liquidationRisk: RiskLevel;
  riskSummary: RiskSummary;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function getRiskLevel(walletUsedPct: number, leverage: number, liquidationBufferPct: number): RiskLevel {
  if (walletUsedPct > 35 || leverage > 20 || liquidationBufferPct < 6) return 'High';
  if (walletUsedPct > 20 || leverage > 12 || liquidationBufferPct < 10) return 'Medium';
  return 'Low';
}

function getWalletImpactLabel(walletUsedPct: number): string {
  if (walletUsedPct > 30) return 'Heavy';
  if (walletUsedPct > 20) return 'Above average';
  if (walletUsedPct > 10) return 'Moderate';
  return 'Light';
}

function getPrimaryWarning(
  walletUsedPct: number,
  leverage: number,
  riskLevel: RiskLevel,
  setupScore: number,
  oversizingRelativeToSetup: boolean,
): string {
  if (oversizingRelativeToSetup && setupScore >= 70) {
    return 'Position sizing increases exposure.';
  }
  if (oversizingRelativeToSetup && setupScore < 70) {
    return 'Position sizing is aggressive for this setup.';
  }
  if (setupScore < 70 && leverage > 12) {
    return 'Setup quality is moderate, so high leverage is harder to justify.';
  }
  if (riskLevel === 'High' || walletUsedPct > 30 || leverage > 20) {
    return 'This trade risks a large portion of your wallet.';
  }
  if (riskLevel === 'Medium' || walletUsedPct > 20) {
    return 'This trade uses more capital than your average.';
  }
  return 'Risk is controlled at this size.';
}

function getTradeScore(
  walletUsedPct: number,
  leverage: number,
  riskLevel: RiskLevel,
  setupScore: number,
  oversizingRelativeToSetup: boolean,
  liquidationBufferPct: number,
): number {
  const setupContribution = (setupScore - 60) * 0.55;
  const walletPenalty = walletUsedPct * 0.95;
  const leveragePenalty = Math.max(0, leverage - 1) * 1.7;
  const liquidationPenalty = liquidationBufferPct < 6 ? 16 : liquidationBufferPct < 10 ? 8 : 0;
  const riskPenalty = riskLevel === 'High' ? 18 : riskLevel === 'Medium' ? 8 : 0;
  const oversizePenalty = oversizingRelativeToSetup ? 12 : 0;
  return Math.round(
    clamp(72 + setupContribution - walletPenalty - leveragePenalty - liquidationPenalty - riskPenalty - oversizePenalty, 5, 98),
  );
}

export function deriveTradeMetrics(model: TradeViewModel, inputs: TradeInputs): DerivedTradeMetrics {
  const amountUsedUsd = clamp(inputs.amountUsd, 0, model.balanceUsd);
  const leverage = clamp(inputs.leverage, 1, 200);
  const positionSizeUsd = amountUsedUsd * leverage;
  const walletUsedPct = model.balanceUsd > 0 ? (amountUsedUsd / model.balanceUsd) * 100 : 0;

  const targetMovePct = Math.abs((model.target - model.entry) / model.entry);
  const stopMovePct = Math.abs((model.stop - model.entry) / model.entry);
  const targetProfitUsd = positionSizeUsd * targetMovePct;
  const stopLossUsd = -(positionSizeUsd * stopMovePct);

  const liqDistance = (1 / leverage) * 0.9;
  const liquidation =
    inputs.side === 'long' ? model.entry * (1 - liqDistance) : model.entry * (1 + liqDistance);
  const liquidationBufferPct = Math.abs((model.entry - liquidation) / model.entry) * 100;

  const recommendedUsagePct = clamp(8 + (inputs.setupScore - 40) * 0.25, 8, 22);
  const oversizingRelativeToSetup = walletUsedPct > recommendedUsagePct;
  const liquidationRisk = getRiskLevel(walletUsedPct, leverage, liquidationBufferPct);
  const walletImpactLabel = getWalletImpactLabel(walletUsedPct);
  const primaryMessage = getPrimaryWarning(
    walletUsedPct,
    leverage,
    liquidationRisk,
    inputs.setupScore,
    oversizingRelativeToSetup,
  );
  const tradeScore = getTradeScore(
    walletUsedPct,
    leverage,
    liquidationRisk,
    inputs.setupScore,
    oversizingRelativeToSetup,
    liquidationBufferPct,
  );
  const setupTradeConflictMessage =
    inputs.setupScore >= 70 && tradeScore < 65
      ? 'The setup is strong, but this position reduces trade quality.'
      : undefined;
  const riskMeterPct = Math.round(
    clamp(
      walletUsedPct * 1.3 +
        Math.max(0, leverage - 1) * 1.9 +
        (liquidationBufferPct < 10 ? 10 : 0) +
        (oversizingRelativeToSetup ? 10 : 0),
      2,
      100,
    ),
  );
  /** Supplementary bullets only — `primaryMessage` is shown separately in the UI. */
  const warnings: string[] = [];
  if (walletUsedPct > 20) warnings.push(`Wallet impact is ${walletUsedPct.toFixed(1)}% of available balance.`);
  if (oversizingRelativeToSetup) warnings.push(`Sizing exceeds setup-adjusted range (${recommendedUsagePct.toFixed(1)}%).`);
  if (leverage > 20) warnings.push('Leverage is above the safer operating range for this setup.');
  if (liquidationRisk === 'High') warnings.push('Liquidation sensitivity is elevated at the current size.');

  return {
    balanceUsd: model.balanceUsd,
    amountUsedUsd,
    leverage,
    positionSizeUsd,
    targetProfitUsd,
    stopLossUsd,
    liquidation,
    walletUsedPct,
    liquidationRisk,
    riskSummary: {
      setupScore: inputs.setupScore,
      positionSizeUsd,
      walletUsedPct,
      recommendedUsagePct,
      oversizingRelativeToSetup,
      liquidationBufferPct,
      liquidationRisk,
      riskMeterPct,
      tradeScore,
      setupTradeConflictMessage,
      walletImpactLabel,
      primaryMessage,
      warnings,
    },
  };
}
