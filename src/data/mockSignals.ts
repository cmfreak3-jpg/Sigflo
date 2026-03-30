import type { CryptoSignal } from '@/types/signal';
import { calculateSetupScore, getSetupScoreLabel } from '@/lib/setupScore';

function withSetupScore(signal: Omit<CryptoSignal, 'setupScore' | 'setupScoreLabel'>): CryptoSignal {
  const setupScore = calculateSetupScore(signal.scoreBreakdown);
  return {
    ...signal,
    setupScore,
    setupScoreLabel: getSetupScoreLabel(setupScore),
  };
}

export const mockSignals: CryptoSignal[] = [
  withSetupScore({
    id: 'sig-1',
    pair: 'BTC',
    side: 'long',
    biasLabel: 'Potential Long',
    setupType: 'breakout',
    scoreBreakdown: {
      trendAlignment: 18,
      momentumQuality: 12,
      structureQuality: 17,
      volumeConfirmation: 10,
      riskConditions: 9,
    },
    riskTag: 'Medium Risk',
    setupTags: ['Breakout'],
    exchange: 'Binance',
    postedAgo: '2m ago',
    aiExplanation: 'Range is compressing with rising volume - breakout pressure building.',
    whyThisMatters: 'If it breaks, price can move quickly due to low resistance above.',
    watchCue: 'breakout above range high',
  }),
  withSetupScore({
    id: 'sig-2',
    pair: 'ETH',
    side: 'short',
    biasLabel: 'Potential Short',
    setupType: 'overextended',
    scoreBreakdown: {
      trendAlignment: 16,
      momentumQuality: 13,
      structureQuality: 14,
      volumeConfirmation: 9,
      riskConditions: 7,
    },
    riskTag: 'High Risk',
    setupTags: ['Overextended'],
    exchange: 'Bybit',
    postedAgo: '14m ago',
    aiExplanation: 'Momentum is fading near resistance; late entries can still get squeezed.',
    whyThisMatters: 'A rejection here can unwind fast, but invalidation is close.',
    watchCue: 'rejection or continuation',
  }),
  withSetupScore({
    id: 'sig-3',
    pair: 'SOL',
    side: 'long',
    biasLabel: 'Potential Long',
    setupType: 'pullback',
    scoreBreakdown: {
      trendAlignment: 20,
      momentumQuality: 15,
      structureQuality: 19,
      volumeConfirmation: 11,
      riskConditions: 10,
    },
    riskTag: 'Low Risk',
    setupTags: ['Pullback'],
    exchange: 'OKX',
    postedAgo: '28m ago',
    aiExplanation: 'Orderflow stabilized after pullback; trend is still holding.',
    whyThisMatters: 'If buyers defend this zone, continuation can reprice the next leg up.',
    watchCue: 'buyers holding pullback zone',
    watchNext: 'continuation above range',
  }),
  withSetupScore({
    id: 'sig-4',
    pair: 'AVAX',
    side: 'long',
    biasLabel: 'Potential Long',
    setupType: 'overextended',
    scoreBreakdown: {
      trendAlignment: 17,
      momentumQuality: 11,
      structureQuality: 12,
      volumeConfirmation: 9,
      riskConditions: 5,
    },
    riskTag: 'High Risk',
    setupTags: ['Breakout', 'Overextended'],
    exchange: 'Binance',
    postedAgo: '1h ago',
    aiExplanation: 'Breakout impulse is strong, but extension now raises mean-reversion risk.',
    whyThisMatters: 'Chasing extension can trap entries if momentum cools near overhead supply.',
    watchCue: 'fade risk vs continuation — size to the next pivot',
  }),
];

export const mockFeedStats = {
  signalsToday: 12,
  strongOrBetter: mockSignals.filter((s) => s.setupScore >= 70).length,
  lastUpdated: 'Just now',
} as const;
