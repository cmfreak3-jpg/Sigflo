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

type OpenAiChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
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

function buildPrompt(req: AssistantRequest): { system: string; user: string } {
  const local = buildLocalResponse(req);
  const system =
    'You are a concise crypto setup assistant for Sigflo. Return strict JSON with keys: headline, body. Keep body under 2 short paragraphs. No markdown.';
  const user = `Action: ${req.action}
Pair: ${req.signal.pair}
Side: ${req.signal.side}
Setup type: ${req.signal.setupType}
Setup score: ${req.signal.setupScore}
Trade score: ${req.tradeScore}
Status: ${req.status}
Risk: ${req.signal.riskTag}
Watch cue: ${req.signal.watchCue ?? 'n/a'}
Watch next: ${req.signal.watchNext ?? 'n/a'}

Reference local style:
headline: ${local.headline}
body: ${local.body}`;
  return { system, user };
}

function parseJsonObject(text: string): Partial<AssistantResponse> | null {
  try {
    const parsed = JSON.parse(text) as Partial<AssistantResponse>;
    return parsed;
  } catch {
    return null;
  }
}

function coerceRemoteResponse(data: unknown): AssistantResponse | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data as Record<string, unknown>;
  if (typeof raw.headline === 'string' && typeof raw.body === 'string') {
    return { headline: raw.headline, body: raw.body, source: 'remote' };
  }
  const choices = (raw as OpenAiChatResponse).choices;
  const content = choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) return null;
  const asJson = parseJsonObject(content.trim());
  if (asJson?.headline && asJson?.body) {
    return { headline: asJson.headline, body: asJson.body, source: 'remote' };
  }
  return { headline: 'AI suggestion', body: content.trim(), source: 'remote' };
}

export async function requestAssistantSuggestion(req: AssistantRequest): Promise<AssistantResponse> {
  // Safe default: frontend calls your own backend/proxy endpoint.
  const proxyEndpoint = import.meta.env.VITE_AI_PROXY_ENDPOINT?.trim() || '/api/ai/suggest';
  // Temporary testing only: allow direct browser -> OpenAI if explicitly enabled.
  const allowBrowserOpenAi = import.meta.env.VITE_AI_ALLOW_BROWSER_OPENAI === 'true';
  const browserOpenAiEndpoint = import.meta.env.VITE_AI_ENDPOINT?.trim();
  const browserOpenAiKey = import.meta.env.VITE_AI_API_KEY?.trim();
  const model = import.meta.env.VITE_AI_MODEL?.trim() || 'gpt-4o-mini';

  try {
    const target = allowBrowserOpenAi && browserOpenAiEndpoint ? browserOpenAiEndpoint : proxyEndpoint;
    const payload =
      allowBrowserOpenAi && browserOpenAiEndpoint
        ? (() => {
            const prompt = buildPrompt(req);
            return {
              model,
              temperature: 0.2,
              response_format: { type: 'json_object' },
              messages: [
                { role: 'system', content: prompt.system },
                { role: 'user', content: prompt.user },
              ],
            };
          })()
        : req;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 9000);
    const res = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(allowBrowserOpenAi && browserOpenAiKey ? { Authorization: `Bearer ${browserOpenAiKey}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    window.clearTimeout(timeout);
    if (!res.ok) return buildLocalResponse(req);
    const data = (await res.json()) as unknown;
    return coerceRemoteResponse(data) ?? buildLocalResponse(req);
  } catch {
    return buildLocalResponse(req);
  }
}
