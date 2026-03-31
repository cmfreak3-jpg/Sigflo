import type { MarketRowStatus } from '@/types/markets';
import type { CryptoSignal } from '@/types/signal';

export type AssistantAction = 'explain' | 'watch' | 'entry';

export type AssistantRequest = {
  action: AssistantAction;
  signal: CryptoSignal;
  status: MarketRowStatus;
  tradeScore: number;
};

export type AssistantResponse = {
  headline: string;
  body: string;
  source: 'local' | 'remote';
};

function entryState(status: MarketRowStatus, tradeScore: number): 'Too early' | 'Ready' | 'Too late' | 'Too risky' {
  if (status === 'overextended' || tradeScore < 45) return 'Too risky';
  if (status === 'triggered' && tradeScore >= 65) return 'Ready';
  if (status === 'triggered' && tradeScore < 55) return 'Too late';
  if (status === 'idle') return 'Too early';
  return 'Too early';
}

function watchFallback(signal: CryptoSignal): string {
  if (signal.setupType === 'breakout') return 'breakout or rejection';
  if (signal.setupType === 'pullback') return signal.side === 'long' ? 'hold or fade' : 'reclaim or fail';
  return 'continuation or rollover';
}

function trendCue(signal: CryptoSignal): string {
  const t = signal.scoreBreakdown.trendAlignment;
  if (t >= 17) return 'Trend holding';
  if (t <= 10) return 'Weak trend';
  return 'Trend mixed';
}

function momentumCue(signal: CryptoSignal): string {
  const m = signal.scoreBreakdown.momentumQuality;
  if (m >= 14) return 'Momentum building';
  if (m <= 8) return 'Momentum fading';
  return 'Momentum steady';
}

function entryQualityScoreFromBreakdown(signal: CryptoSignal): number {
  const b = signal.scoreBreakdown;
  return b.trendAlignment + b.momentumQuality + b.structureQuality + b.volumeConfirmation + b.riskConditions;
}

function entryQualityTierLabel(score: number): string {
  if (score >= 70) return 'strong';
  if (score >= 50) return 'moderate';
  return 'weak';
}

function buildLocalResponse(req: AssistantRequest): AssistantResponse {
  const { action, signal, status, tradeScore } = req;
  if (action === 'explain') {
    const bias = signal.side === 'long' ? 'Long' : 'Short';
    return {
      source: 'local',
      headline: `Explain · ${signal.pair}`,
      body: `${signal.pair} — ${bias} ${signal.setupType} setup at ${signal.setupScore}/100. ${trendCue(signal)}. ${momentumCue(signal)}. Scanner phase: ${status}. Risk: ${signal.riskTag}.`,
    };
  }

  if (action === 'watch') {
    const cue = signal.watchCue?.trim();
    const next = signal.watchNext?.trim();
    const fallback = `Watch ${watchFallback(signal)}.`;
    return {
      source: 'local',
      headline: `What to watch · ${signal.pair}`,
      body: cue && next ? `${cue}\n\nNext: ${next}` : cue ? cue : next ? `${fallback}\n\nNext: ${next}` : fallback,
    };
  }

  const eq = entryQualityScoreFromBreakdown(signal);
  const tier = entryQualityTierLabel(eq);
  const timing = entryState(status, tradeScore);
  let coach = 'If price confirms, execution risk is more aligned with the score.';
  if (status === 'overextended') coach = 'Wait for a reset - chasing here usually hurts risk/reward.';
  else if (status === 'developing') coach = 'Wait for confirmation before sizing up.';
  else if (timing === 'Too late') coach = 'Late relative to trigger - reduce size or wait for a fresh structure.';
  else if (timing === 'Too early') coach = 'Still early - let the setup prove itself before committing.';
  else if (timing === 'Too risky') coach = 'Risk posture is elevated - tighten size or skip.';

  return {
    source: 'local',
    headline: `Improve entry · ${signal.pair}`,
    body: `Entry quality is ${tier} (${eq}/100).\n\n${coach}`,
  };
}

export async function requestAssistantSuggestion(req: AssistantRequest): Promise<AssistantResponse> {
  const endpoint = import.meta.env.VITE_AI_ENDPOINT?.trim();
  const apiKey = import.meta.env.VITE_AI_API_KEY?.trim();
  if (!endpoint) return buildLocalResponse(req);

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 9000);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    window.clearTimeout(timeout);
    if (!res.ok) return buildLocalResponse(req);
    const data = (await res.json()) as Partial<AssistantResponse>;
    if (!data.headline || !data.body) return buildLocalResponse(req);
    return { headline: data.headline, body: data.body, source: 'remote' };
  } catch {
    return buildLocalResponse(req);
  }
}
