import { REGIME_TONE_GUIDE, deriveMarketRegimeFromContextLike } from './regime-tone.mjs';

const DEFAULT_OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

function enrichContextWithRegime(ctx) {
  if (!ctx || typeof ctx !== 'object') return ctx;
  const r = deriveMarketRegimeFromContextLike(ctx);
  return { ...ctx, marketRegime: r, regimeToneGuide: REGIME_TONE_GUIDE[r] };
}

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

const GROUNDED_QUICK_SYSTEM = `You are Sigflo's grounded market assistant. You ONLY interpret the JSON "data_package" in the user message. Rules:
- Do NOT invent prices, levels, indicators, or events not present in data_package.
- Do NOT mention MACD, Bollinger, VWAP, Ichimoku, Stochastic, Fibonacci, Elliott, or harmonic patterns unless those exact words appear in data_package.allowedIndicatorTerms.
- Do NOT cite RSI, EMA, ATR, or volume as concepts unless allowed by allowedIndicatorTerms.
- If information is missing for a claim, say "insufficient data in package" for that point instead of guessing.
- levels_used must be a subset of data_package.allowedPriceLevels (exact values only, or empty array).
- You explain the Sigflo signal engine and plan levels; you do not replace execution decisions.

data_package includes marketRegime (trending | range | risk_off | transition) and regimeToneGuide. Use them ONLY to calibrate tone, hedging, and how you phrase confidence in reasoning and notes — still obey every rule above. Never treat regime as external news; it is an internal label from the packaged scores and scanner status.

Return a single JSON object with EXACTLY these keys: bias ("long"|"short"|"neutral"), confidence (0-100), reasoning (string), levels_used (number array), trade_valid (boolean), notes (string). No other keys. No markdown.`;

const GROUNDED_DEEP_SYSTEM = `You are Sigflo's grounded desk analyst. You ONLY use the JSON data_package in the user message.
Rules:
- Do NOT invent prices. Any specific price with 2+ decimal places in body MUST match a value in data_package.allowedPriceLevels (approximately).
- Do NOT reference indicators not in data_package.allowedIndicatorTerms.
- Do NOT use MACD, Bollinger, VWAP, Ichimoku, Stochastic, Fibonacci, Elliott, harmonics.
- If data_package.dataGaps is non-empty, say "insufficient data in package" where gaps block a conclusion.

data_package includes marketRegime and regimeToneGuide. Apply them to voice and emphasis across sections (e.g. continuation vs two-sided vs defensive vs wait-for-confirmation) without adding facts or levels not in the package.

Return strict JSON with keys: headline (string), body (string). body = GitHub Markdown with ## headings in order: Overview, Market structure, Bullish case, Bearish case, Key levels, Momentum and trend, Invalidation, Risk factors, Trade approach. No emojis.`;

function minimalContextFromRequest(req) {
  const s = req.signal;
  const b = s.scoreBreakdown || {};
  return {
    symbol: s.pair,
    market: 'futures',
    timeframe: 'unknown',
    allowedPriceLevels: [],
    scannerStatus: req.status,
    tradeReadinessScore: Math.round(req.tradeScore),
    signal: {
      id: s.id,
      side: s.side,
      setupType: s.setupType,
      setupScore: s.setupScore,
      setupScoreLabel: s.setupScoreLabel ?? '',
      riskTag: s.riskTag,
      setupTags: s.setupTags || [],
      biasLabel: s.biasLabel ?? '',
      scoreBreakdown: {
        trendAlignment: b.trendAlignment ?? 0,
        momentumQuality: b.momentumQuality ?? 0,
        structureQuality: b.structureQuality ?? 0,
        volumeConfirmation: b.volumeConfirmation ?? 0,
        riskConditions: b.riskConditions ?? 0,
      },
    },
    signalNarrative: {
      aiExplanation: s.aiExplanation || '',
      whyThisMatters: s.whyThisMatters || '',
    },
    dataGaps: ['minimal_payload_no_chart_levels'],
    allowedIndicatorTerms: [],
  };
}

function parseStructuredQuickFromOpenAi(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) return null;
  const p = safeJsonParse(content.trim());
  if (!p || !['long', 'short', 'neutral'].includes(p.bias)) return null;
  if (typeof p.confidence !== 'number' || p.confidence < 0 || p.confidence > 100) return null;
  if (typeof p.reasoning !== 'string' || typeof p.notes !== 'string' || typeof p.trade_valid !== 'boolean') return null;
  if (!Array.isArray(p.levels_used)) return null;
  for (const x of p.levels_used) {
    if (typeof x !== 'number' && typeof x !== 'string') return null;
  }
  return p;
}

function buildGroundedQuickRetryUser(request, ctx) {
  const hint = request.groundedRetryHint || 'validation_failed';
  const prev =
    request.previousStructured != null ? JSON.stringify(request.previousStructured) : '(unparseable or missing)';
  return `Your previous JSON failed validation: ${hint}.

Return a corrected JSON object with ONLY these keys: bias, confidence, reasoning, levels_used, trade_valid, notes.

Hard rules:
- levels_used: each number must match a value in allowedPriceLevels exactly: ${JSON.stringify(ctx.allowedPriceLevels)} — or use [].
- Only reference RSI, EMA, ATR, or volume themes if allowedIndicatorTerms permits: ${JSON.stringify(ctx.allowedIndicatorTerms)}.
- No MACD, Bollinger, VWAP, Ichimoku, Stochastic, Fibonacci, Elliott, harmonics.

Action requested: ${request.action}
data_package:
${JSON.stringify(ctx)}

Previous rejected output:
${prev}`;
}

function buildDeepRetryUser(request, ctx) {
  const hint = request.deepRetryHint || 'validation_failed';
  const prevH = request.previousDeep?.headline ?? '';
  const prevB = String(request.previousDeep?.body ?? '').slice(0, 1400);
  return `Your previous headline/body failed client validation: ${hint}.

Return corrected JSON with keys headline (string) and body (string) only.
body = GitHub Markdown with ## sections in order: Overview, Market structure, Bullish case, Bearish case, Key levels, Momentum and trend, Invalidation, Risk factors, Trade approach.

Rules:
- Any price with 2+ decimal places in body must match allowedPriceLevels: ${JSON.stringify(ctx.allowedPriceLevels)}
- Indicators only if allowed in allowedIndicatorTerms: ${JSON.stringify(ctx.allowedIndicatorTerms)}
- No MACD, Bollinger, VWAP, Ichimoku, Stochastic, Fibonacci, Elliott, harmonics.

data_package:
${JSON.stringify(ctx)}

Signal narrative (from app):
aiExplanation: ${request.signal.aiExplanation || ''}
whyThisMatters: ${request.signal.whyThisMatters || ''}

Rejected headline: ${prevH}
Rejected body excerpt:
${prevB}`;
}

async function runGroundedQuickAction(request, ctx, env) {
  ctx = enrichContextWithRegime(ctx);
  const apiKey = env.OPENAI_API_KEY || env.AI_API_KEY;
  const endpoint = env.OPENAI_API_ENDPOINT || env.AI_ENDPOINT || DEFAULT_OPENAI_ENDPOINT;
  const model = env.OPENAI_MODEL || env.AI_MODEL || 'gpt-4o-mini';
  if (!apiKey) {
    return { structured: null };
  }
  try {
    const user = request.groundedRetry
      ? buildGroundedQuickRetryUser(request, ctx)
      : `Action requested: ${request.action}\ndata_package:\n${JSON.stringify(ctx)}`;
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
        temperature: 0.15,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: GROUNDED_QUICK_SYSTEM },
          { role: 'user', content: user },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) {
      return { structured: null };
    }
    const data = await response.json();
    const structured = parseStructuredQuickFromOpenAi(data);
    return { structured: structured || null };
  } catch {
    return { structured: null };
  }
}

function buildDeepLocalResponse(req) {
  const { signal, status, tradeScore } = req;
  const bias = signal.side === 'long' ? 'Long' : 'Short';
  const timing = entryState(status, tradeScore);
  const b = signal.scoreBreakdown || {};
  const excerpt = String(signal.aiExplanation || '').slice(0, 320).trim();
  const why = String(signal.whyThisMatters || '').slice(0, 220).trim();
  const body = `## Overview
${bias} ${signal.setupType} on **${signal.pair}**: setup score ${signal.setupScore}/100, scanner status **${status}**, trade readiness ~${Math.round(tradeScore)}. ${excerpt ? `Scanner context: ${excerpt}` : 'Use the live chart and plan levels as primary context.'}

## Market structure
Internal score mix — trend ${b.trendAlignment ?? 'n/a'}/25, structure ${b.structureQuality ?? 'n/a'}/25, momentum ${b.momentumQuality ?? 'n/a'}/20, volume ${b.volumeConfirmation ?? 'n/a'}/15, risk ${b.riskConditions ?? 'n/a'}/15. Price is ${levelHint(signal)} relative to the active setup type.

## Bullish case
A constructive resolution favors continuation: ${signal.setupType === 'breakout' ? 'acceptance beyond the trigger zone with follow-through' : signal.setupType === 'pullback' ? 'defense of the pullback structure and resumption toward trend' : 'orderly digestion without breaking major swing support'}. ${signal.side === 'long' ? 'Long-bias signals need sustained bids and higher lows on relevant timeframes.' : 'Short-bias signals need supply to remain in control after tests.'}

## Bearish case
The trade thesis weakens if the market rejects the key structure: ${signal.setupType === 'breakout' ? 'false breakout / immediate reclaim into the range' : 'failed reclaim — rotation the other way'}. Choppy two-way trade inside the setup zone argues for standing aside.

## Key levels
Anchor off the trade plan in Sigflo when entry / stop / target are shown; otherwise mark the nearest obvious swing highs and lows from the chart. Treat those as zones, not single ticks.

## Momentum and trend
${trendCue(signal)}; ${momentumCue(signal)}. If momentum is fading into a trigger, require cleaner confirmation before sizing.

## Invalidation
Invalidate when price proves the setup wrong: break and hold beyond the structural level that defines this ${signal.setupType}. Timing label **${timing}** — if you are early or late relative to the trigger, reduce size or wait for a fresh structure.

## Risk factors
Setup risk: **${signal.riskTag}**. ${status === 'overextended' ? 'Status is overextended — chasing hurts expectancy.' : ''} ${why ? `Framing: ${why}` : 'Keep risk per trade modest versus account.'}

## Trade approach
Work the plan in stages: define trigger, size for invalidation distance, add only if follow-through confirms. ${timing === 'Ready' ? 'Readiness is elevated; execution discipline still matters.' : 'Patience: let the scenario prove itself before full commitment.'}`;
  return {
    headline: `${signal.pair} — ${bias} ${signal.setupType} (setup ${signal.setupScore})`,
    body,
  };
}

function buildDeepPrompt(req) {
  const signal = req.signal;
  const local = buildDeepLocalResponse(req);
  const system = `You are a senior market analyst writing Sigflo's optional long-form "Full thesis" (not execution orders). Return strict JSON with keys: headline, body only.
body must be GitHub-flavored Markdown using these exact level-2 headings in order:
## Overview
## Market structure
## Bullish case
## Bearish case
## Key levels
## Momentum and trend
## Invalidation
## Risk factors
## Trade approach
Write substantive paragraphs (often 2–4 sentences each); avoid bullet-stuffed outlines unless a section truly needs a list. Be specific to the pair, scores, and status — no generic crypto platitudes, no repeated stock phrases across sections, no "not financial advice", no emojis. Tone: premium terminal / desk note.`;

  const facts = JSON.stringify(signal.facts || {});
  const planned =
    signal.plannedEntry != null
      ? `plannedEntry: ${signal.plannedEntry}, plannedStop: ${signal.plannedStop ?? 'n/a'}, plannedTarget: ${signal.plannedTarget ?? 'n/a'}`
      : 'Planned levels: use app / chart (not provided in payload).';

  const user = `Pair: ${signal.pair}
Side: ${signal.side}
Setup type: ${signal.setupType}
Setup score: ${signal.setupScore} (label: ${signal.setupScoreLabel ?? 'n/a'})
Trade readiness score: ${req.tradeScore}
Scanner status: ${req.status}
Risk tag: ${signal.riskTag}
Setup tags: ${(signal.setupTags || []).join(', ')}
Facts: ${facts}
${planned}
Watch cue: ${signal.watchCue ?? 'n/a'}
Watch next: ${signal.watchNext ?? 'n/a'}

Signal explanation:
${signal.aiExplanation || 'n/a'}

Why it matters:
${signal.whyThisMatters || 'n/a'}

Reference structure and density (your output should be more insightful than this fallback, not shorter):
headline: ${local.headline}
body:
${local.body}`;

  return { system, user };
}

/**
 * @param {Record<string, unknown>} request
 * @param {NodeJS.ProcessEnv} env
 */
async function runDeepAnalysis(request, env) {
  const fallback = buildDeepLocalResponse(request);
  const apiKey = env.OPENAI_API_KEY || env.AI_API_KEY;
  const endpoint = env.OPENAI_API_ENDPOINT || env.AI_ENDPOINT || DEFAULT_OPENAI_ENDPOINT;
  const model = env.OPENAI_MODEL || env.AI_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    return fallback;
  }

  const ctx = enrichContextWithRegime(request.context || minimalContextFromRequest(request));
  const user = request.deepRetry
    ? buildDeepRetryUser(request, ctx)
    : `data_package:\n${JSON.stringify(ctx)}\n\nSignal narrative (from app):\naiExplanation: ${request.signal.aiExplanation || ''}\nwhyThisMatters: ${request.signal.whyThisMatters || ''}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50_000);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.32,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: GROUNDED_DEEP_SYSTEM },
          { role: 'user', content: user },
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

  if (request.action === 'deep') {
    if (typeof request.tradeScore !== 'number' || typeof request.status !== 'string') {
      return { error: 'Invalid payload' };
    }
    return runDeepAnalysis(request, env);
  }

  const useGrounded = request.context != null || request.grounded === true;
  if (useGrounded && ['explain', 'watch', 'entry'].includes(request.action)) {
    const ctx = request.context || minimalContextFromRequest(request);
    return runGroundedQuickAction(request, ctx, env);
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
