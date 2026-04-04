const DEFAULT_OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function watchFallback(signal) {
  if (signal.setupType === 'breakout') return 'breakout or rejection';
  if (signal.setupType === 'pullback') return signal.side === 'long' ? 'hold or fade' : 'reclaim or fail';
  return 'continuation or rollover';
}

function trendCue(signal) {
  const t = signal?.scoreBreakdown?.trendAlignment ?? 0;
  if (t >= 17) return 'Trend holding';
  if (t <= 10) return 'Weak trend';
  return 'Trend mixed';
}

function momentumCue(signal) {
  const m = signal?.scoreBreakdown?.momentumQuality ?? 0;
  if (m >= 14) return 'Momentum building';
  if (m <= 8) return 'Momentum fading';
  return 'Momentum steady';
}

function entryQualityScoreFromBreakdown(signal) {
  const b = signal?.scoreBreakdown;
  if (!b) return 0;
  return (b.trendAlignment ?? 0) + (b.momentumQuality ?? 0) + (b.structureQuality ?? 0) + (b.volumeConfirmation ?? 0) + (b.riskConditions ?? 0);
}

function entryQualityTierLabel(score) {
  if (score >= 70) return 'strong';
  if (score >= 50) return 'moderate';
  return 'weak';
}

function levelHint(signal) {
  const facts = signal?.facts;
  if (typeof facts?.distanceToBreakoutAtr === 'number') {
    if (facts.distanceToBreakoutAtr <= 0.2) return 'near trigger';
    if (facts.distanceToBreakoutAtr >= 0.8) return 'far from trigger';
  }
  if (typeof facts?.pullbackDepthAtr === 'number') {
    if (facts.pullbackDepthAtr >= 1.2) return 'deep pullback';
    if (facts.pullbackDepthAtr <= 0.5) return 'shallow pullback';
  }
  if (typeof facts?.extensionAtr === 'number' && facts.extensionAtr >= 1.4) return 'extended from base';
  return 'at a key level';
}

function actionFormatHint(action) {
  if (action === 'explain') {
    return 'Format body as 4 short lines: Thesis, Trigger, Invalidation, Execution.';
  }
  if (action === 'watch') {
    return 'Format body as a checklist with 3-5 short lines prefixed by [ ] focusing on what to monitor now.';
  }
  return 'Format body as 4 short numbered steps (1-4): setup quality, trigger plan, sizing, invalidation.';
}

function entryState(status, tradeScore) {
  if (status === 'overextended' || tradeScore < 45) return 'Too risky';
  if (status === 'triggered' && tradeScore >= 65) return 'Ready';
  if (status === 'triggered' && tradeScore < 55) return 'Too late';
  if (status === 'idle') return 'Too early';
  return 'Too early';
}

function buildLocalResponse(req) {
  const { action, signal, status, tradeScore } = req;
  if (action === 'explain') {
    const bias = signal.side === 'long' ? 'Long' : 'Short';
    return {
      headline: `Explain - ${signal.pair}`,
      body: `${bias} ${signal.setupType} setup (${signal.setupScore}/100), ${levelHint(signal)}.\nTrigger: require clean confirmation with volume before entry.\nInvalidation: break back through setup structure.\nContext: ${trendCue(signal)}; ${momentumCue(signal)}; status ${status}; risk ${signal.riskTag}.`,
    };
  }

  if (action === 'watch') {
    const cue = signal.watchCue?.trim();
    const next = signal.watchNext?.trim();
    const fallback = `Watch ${watchFallback(signal)}.`;
    return {
      headline: `What to watch - ${signal.pair}`,
      body: cue && next ? `Primary: ${cue}\nNext: ${next}\nExecution: enter only on confirmation, not anticipation.` : cue ? `Primary: ${cue}\nExecution: wait for confirmation candle and volume support.` : next ? `Primary: ${fallback}\nNext: ${next}\nExecution: avoid entries in chop.` : `Primary: ${fallback}\nExecution: wait for clean reaction at level.`,
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
    headline: `Improve entry - ${signal.pair}`,
    body: `Entry quality: ${tier} (${eq}/100), timing: ${timing}.\nPlan: ${coach}\nExecution: size down until confirmation, then scale only if structure holds.`,
  };
}

function buildPrompt(req) {
  const local = buildLocalResponse(req);
  const system =
    'You are a tactical crypto execution assistant for Sigflo. Return strict JSON only with keys: headline, body. Tone: direct, trader-like, actionable. Keep body to 3-5 short lines. Include specific fields when relevant: Trigger, Invalidation, Execution. No markdown, no disclaimers, no emojis.';
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
Output format hint: ${actionFormatHint(req.action)}

Reference local style:
headline: ${local.headline}
body: ${local.body}`;
  return { system, user };
}

function extractAssistantResponse(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) return null;
  const parsed = safeJsonParse(content.trim());
  if (parsed && typeof parsed.headline === 'string' && typeof parsed.body === 'string') {
    return { headline: parsed.headline, body: parsed.body };
  }
  return { headline: 'AI suggestion', body: content.trim() };
}

/**
 * @param {string | undefined} rawBody
 * @param {NodeJS.ProcessEnv} env
 * @returns {Promise<{ headline: string; body: string } | { error: string }>}
 */
export async function runAiSuggest(rawBody, env) {
  const request = safeJsonParse(rawBody || '');
  if (!request || !request.action || !request.signal) {
    return { error: 'Invalid payload' };
  }

  const fallback = buildLocalResponse(request);
  const apiKey = env.OPENAI_API_KEY || env.AI_API_KEY;
  const endpoint = env.OPENAI_API_ENDPOINT || env.AI_ENDPOINT || DEFAULT_OPENAI_ENDPOINT;
  const model = env.OPENAI_MODEL || env.AI_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    return fallback;
  }

  try {
    const prompt = buildPrompt(request);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return fallback;
    }

    const data = await response.json();
    return extractAssistantResponse(data) || fallback;
  } catch {
    return fallback;
  }
}
