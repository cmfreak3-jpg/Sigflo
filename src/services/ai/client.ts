import { buildDeepAnalysisFallback } from '@/lib/deepAnalysisFallback';
import {
  parseAiStructuredAnalysis,
  validateDeepMarkdownGrounded,
  validateGroundedStructuredAnalysis,
} from '@/lib/aiAnalysisValidation';
import { buildLocalStructuredAnalysis, expandStructuredToQuickNarrative } from '@/lib/aiStructuredNarrative';
import type {
  AiQuickAction,
  AiStructuredAnalysis,
  AssistantResponseGrounded,
  GroundedMarketContext,
} from '@/types/aiGrounded';
import type { MarketRowStatus } from '@/types/markets';
import { resolveAppApiPath } from '@/lib/appBasePath';
import type { CryptoSignal } from '@/types/signal';

export type AssistantAction = AiQuickAction;

export type AssistantRequest = {
  action: AssistantAction;
  signal: CryptoSignal;
  status: MarketRowStatus;
  tradeScore: number;
  context: GroundedMarketContext;
};

export type AssistantResponse = AssistantResponseGrounded;

type OpenAiChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const GROUNDED_QUICK_SYSTEM = `You are Sigflo's grounded market assistant. You ONLY interpret the JSON "data_package" in the user message. Rules:
- Do NOT invent prices, levels, indicators, or events not present in data_package.
- Do NOT mention MACD, Bollinger, VWAP, Ichimoku, Stochastic, Fibonacci, Elliott, or harmonic patterns unless those exact words appear in data_package.allowedIndicatorTerms.
- Do NOT cite RSI, EMA, ATR, or volume as concepts unless allowed by allowedIndicatorTerms (case-insensitive match to those themes).
- If information is missing for a claim, say "insufficient data in package" for that point instead of guessing.
- levels_used must be a subset of data_package.allowedPriceLevels (use exact values from the list only, or an empty array).
- You explain the Sigflo signal engine and plan levels; you do not replace execution decisions.

data_package includes marketRegime (trending | range | risk_off | transition) and regimeToneGuide. Use them ONLY to calibrate tone, hedging, and how you phrase confidence in reasoning and notes — still obey every rule above. Never treat regime as external news; it is an internal label from the packaged scores and scanner status.

Return a single JSON object with EXACTLY these keys and no others:
bias (string: "long" | "short" | "neutral"),
confidence (number 0-100, aligned with tradeReadinessScore when unsure),
reasoning (string, 2-6 sentences, only package facts),
levels_used (array of numbers from allowedPriceLevels only),
trade_valid (boolean: whether the packaged setup supports a new trade per scannerStatus and scores),
notes (string, one or two sentences on gaps or caution).

No markdown. No headline or body fields.`;

const allowGroundedValidationRetry = import.meta.env.VITE_AI_GROUNDED_RETRY_ON_INVALID !== 'false';

function buildGroundedUserPayload(action: AssistantAction, req: AssistantRequest): string {
  return `Action requested: ${action}
data_package:
${JSON.stringify(req.context)}`;
}

function buildGroundedQuickRetryUserContent(
  req: AssistantRequest,
  hint: string,
  previous: unknown | null,
): string {
  const prev = previous != null ? JSON.stringify(previous) : '(unparseable or missing)';
  return `Your previous JSON failed validation: ${hint}.

Return a corrected JSON object with ONLY these keys: bias, confidence, reasoning, levels_used, trade_valid, notes.

Hard rules:
- levels_used: each number must match a value in allowedPriceLevels exactly: ${JSON.stringify(req.context.allowedPriceLevels)} — or use [].
- Only reference RSI, EMA, ATR, or volume themes if allowedIndicatorTerms permits: ${JSON.stringify(req.context.allowedIndicatorTerms)}.
- No MACD, Bollinger, VWAP, Ichimoku, Stochastic, Fibonacci, Elliott, harmonics.

Action requested: ${req.action}
data_package:
${JSON.stringify(req.context)}

Previous rejected output:
${prev}`;
}

function extractStructuredFromRemotePayload(data: unknown): AiStructuredAnalysis | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data as Record<string, unknown>;
  if (raw.structured != null) {
    return parseAiStructuredAnalysis(raw.structured);
  }
  if (typeof raw.bias === 'string') {
    return parseAiStructuredAnalysis(raw);
  }
  const choices = (raw as OpenAiChatResponse).choices;
  const content = choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) return null;
  try {
    const parsed = JSON.parse(content.trim()) as unknown;
    return parseAiStructuredAnalysis(parsed);
  } catch {
    return null;
  }
}

function validateAndBuildRemoteQuickResponse(
  req: AssistantRequest,
  structured: AiStructuredAnalysis,
): AssistantResponseGrounded | null {
  const v = validateGroundedStructuredAnalysis(structured, req.context);
  if (!v.ok) return null;
  const { headline, body } = expandStructuredToQuickNarrative(req.action, structured, req.context);
  return { structured, headline, body, source: 'remote' };
}

export async function requestAssistantSuggestion(req: AssistantRequest): Promise<AssistantResponseGrounded> {
  const local = buildLocalStructuredAnalysis(req.action, req.signal, req.status, req.tradeScore, req.context);

  const proxyEndpoint = resolveAppApiPath(import.meta.env.VITE_AI_PROXY_ENDPOINT, '/api/ai/suggest');
  const allowBrowserOpenAi = import.meta.env.VITE_AI_ALLOW_BROWSER_OPENAI === 'true';
  const browserOpenAiEndpoint = import.meta.env.VITE_AI_ENDPOINT?.trim();
  const browserOpenAiKey = import.meta.env.VITE_AI_API_KEY?.trim();
  const model = import.meta.env.VITE_AI_MODEL?.trim() || 'gpt-4o-mini';

  const buildQuickPayload = (retry: boolean, hint: string, previousStructured: unknown | null) => {
    if (allowBrowserOpenAi && browserOpenAiEndpoint) {
      const user = retry
        ? buildGroundedQuickRetryUserContent(req, hint, previousStructured)
        : buildGroundedUserPayload(req.action, req);
      return {
        model,
        temperature: 0.15,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: GROUNDED_QUICK_SYSTEM },
          { role: 'user', content: user },
        ],
      };
    }
    if (retry) {
      return {
        action: req.action,
        signal: req.signal,
        status: req.status,
        tradeScore: req.tradeScore,
        context: req.context,
        grounded: true,
        groundedRetry: true,
        groundedRetryHint: hint,
        ...(previousStructured != null ? { previousStructured } : {}),
      };
    }
    return {
      action: req.action,
      signal: req.signal,
      status: req.status,
      tradeScore: req.tradeScore,
      context: req.context,
      grounded: true,
    };
  };

  const runQuickFetch = async (body: unknown) => {
    const target = allowBrowserOpenAi && browserOpenAiEndpoint ? browserOpenAiEndpoint : proxyEndpoint;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 9000);
    try {
      const res = await fetch(target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(allowBrowserOpenAi && browserOpenAiKey ? { Authorization: `Bearer ${browserOpenAiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = res.ok ? ((await res.json()) as unknown) : null;
      return { res, data };
    } finally {
      window.clearTimeout(timeout);
    }
  };

  try {
    const { res, data } = await runQuickFetch(buildQuickPayload(false, '', null));
    if (!res.ok || !data) return local;

    let structured = extractStructuredFromRemotePayload(data);
    let remote = structured ? validateAndBuildRemoteQuickResponse(req, structured) : null;
    if (remote) return remote;

    if (!allowGroundedValidationRetry) return local;

    let failReason = 'missing_or_invalid_json';
    if (structured != null) {
      const vQuick = validateGroundedStructuredAnalysis(structured, req.context);
      if (!vQuick.ok) failReason = vQuick.reason;
    }
    const previousForRetry = structured ?? null;
    const { res: res2, data: data2 } = await runQuickFetch(
      buildQuickPayload(true, failReason, previousForRetry),
    );
    if (!res2.ok || !data2) return local;
    structured = extractStructuredFromRemotePayload(data2);
    remote = structured ? validateAndBuildRemoteQuickResponse(req, structured) : null;
    return remote ?? local;
  } catch {
    return local;
  }
}

export type DeepAnalysisRequest = {
  signal: CryptoSignal;
  status: MarketRowStatus;
  tradeScore: number;
  context: GroundedMarketContext;
};

export type DeepAnalysisResponse = {
  headline: string;
  body: string;
  source: 'local' | 'remote';
};

function buildDeepRetryUserContent(
  req: DeepAnalysisRequest,
  hint: string,
  previous: { headline: string; body: string } | null,
): string {
  const prevH = previous?.headline ?? '';
  const prevB = String(previous?.body ?? '').slice(0, 1400);
  return `Your previous headline/body failed validation: ${hint}.

Return corrected JSON with keys headline (string) and body (string) only.
body = GitHub Markdown with ## sections in order: Overview, Market structure, Bullish case, Bearish case, Key levels, Momentum and trend, Invalidation, Risk factors, Trade approach.

Rules:
- Any price with 2+ decimal places in body must match allowedPriceLevels: ${JSON.stringify(req.context.allowedPriceLevels)}
- Indicators only if allowed in allowedIndicatorTerms: ${JSON.stringify(req.context.allowedIndicatorTerms)}
- No MACD, Bollinger, VWAP, Ichimoku, Stochastic, Fibonacci, Elliott, harmonics.

data_package:
${JSON.stringify(req.context)}

Signal narrative (from app):
aiExplanation: ${req.signal.aiExplanation}
whyThisMatters: ${req.signal.whyThisMatters}

Rejected headline: ${prevH}
Rejected body excerpt:
${prevB}`;
}

const GROUNDED_DEEP_SYSTEM = `You are Sigflo's grounded desk analyst. You ONLY use the JSON data_package in the user message.

Rules:
- Do NOT invent prices or levels. Any specific price number in your markdown body MUST appear in data_package.allowedPriceLevels (match approximately the same numeric values).
- Do NOT reference indicators or studies not supported by data_package.allowedIndicatorTerms (RSI/EMA/ATR/volume themes only when listed).
- Do NOT use MACD, Bollinger, VWAP, Ichimoku, Stochastic, Fibonacci, Elliott, harmonics.
- If data_package.dataGaps is non-empty, mention "insufficient data in package" where those gaps block a conclusion.
- Explain the existing Sigflo signal and levels; do not present novel technical analysis.

data_package includes marketRegime and regimeToneGuide. Apply them to voice and emphasis across sections without adding facts or levels not in the package.

Return strict JSON with keys: headline (string), body (string only).
body must be GitHub-flavored Markdown with these level-2 headings in order:
## Overview
## Market structure
## Bullish case
## Bearish case
## Key levels
## Momentum and trend
## Invalidation
## Risk factors
## Trade approach

Use only facts from the package. Short paragraphs. No emojis.`;

function buildDeepGroundedUser(req: DeepAnalysisRequest): string {
  return `data_package:
${JSON.stringify(req.context)}

Signal narrative (authoritative copy from app, may paraphrase carefully):
aiExplanation: ${req.signal.aiExplanation}
whyThisMatters: ${req.signal.whyThisMatters}
`;
}

function coerceDeepRemotePayload(data: unknown): { headline: string; body: string } | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data as Record<string, unknown>;
  if (typeof raw.error === 'string') return null;
  if (typeof raw.headline === 'string' && typeof raw.body === 'string') {
    return { headline: raw.headline, body: raw.body };
  }
  const choices = (raw as OpenAiChatResponse).choices;
  const content = choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) return null;
  try {
    const parsed = JSON.parse(content.trim()) as Record<string, unknown>;
    if (typeof parsed.headline === 'string' && typeof parsed.body === 'string') {
      return { headline: parsed.headline, body: parsed.body };
    }
  } catch {
    return null;
  }
  return null;
}

export async function requestDeepMarketAnalysis(req: DeepAnalysisRequest): Promise<DeepAnalysisResponse> {
  const localWrap = (): DeepAnalysisResponse => {
    const f = buildDeepAnalysisFallback(req.signal, req.status, req.tradeScore, req.context);
    return { ...f, source: 'local' };
  };

  const proxyEndpoint = resolveAppApiPath(import.meta.env.VITE_AI_PROXY_ENDPOINT, '/api/ai/suggest');
  const allowBrowserOpenAi = import.meta.env.VITE_AI_ALLOW_BROWSER_OPENAI === 'true';
  const browserOpenAiEndpoint = import.meta.env.VITE_AI_ENDPOINT?.trim();
  const browserOpenAiKey = import.meta.env.VITE_AI_API_KEY?.trim();
  const model = import.meta.env.VITE_AI_MODEL?.trim() || 'gpt-4o-mini';

  const buildDeepPayload = (
    retry: boolean,
    hint: string,
    previous: { headline: string; body: string } | null,
  ) => {
    if (allowBrowserOpenAi && browserOpenAiEndpoint) {
      const user = retry
        ? buildDeepRetryUserContent(req, hint, previous)
        : buildDeepGroundedUser(req);
      return {
        model,
        temperature: 0.32,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: GROUNDED_DEEP_SYSTEM },
          { role: 'user', content: user },
        ],
      };
    }
    if (retry) {
      return {
        action: 'deep' as const,
        signal: req.signal,
        status: req.status,
        tradeScore: req.tradeScore,
        context: req.context,
        grounded: true,
        deepRetry: true,
        deepRetryHint: hint,
        ...(previous ? { previousDeep: previous } : {}),
      };
    }
    return {
      action: 'deep' as const,
      signal: req.signal,
      status: req.status,
      tradeScore: req.tradeScore,
      context: req.context,
      grounded: true,
    };
  };

  const runDeepFetch = async (body: unknown) => {
    const target = allowBrowserOpenAi && browserOpenAiEndpoint ? browserOpenAiEndpoint : proxyEndpoint;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 50_000);
    try {
      const res = await fetch(target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(allowBrowserOpenAi && browserOpenAiKey ? { Authorization: `Bearer ${browserOpenAiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = res.ok ? ((await res.json()) as unknown) : null;
      return { res, data };
    } finally {
      window.clearTimeout(timeout);
    }
  };

  try {
    const { res, data } = await runDeepFetch(buildDeepPayload(false, '', null));
    if (!res.ok || !data) return localWrap();

    let parsed = coerceDeepRemotePayload(data);
    let failReason = 'missing_or_invalid_json';
    if (parsed) {
      const v = validateDeepMarkdownGrounded(parsed.body, req.context);
      if (v.ok) return { headline: parsed.headline, body: parsed.body, source: 'remote' };
      failReason = v.reason;
    }

    if (!allowGroundedValidationRetry) return localWrap();

    const { res: res2, data: data2 } = await runDeepFetch(
      buildDeepPayload(true, failReason, parsed),
    );
    if (!res2.ok || !data2) return localWrap();
    parsed = coerceDeepRemotePayload(data2);
    if (!parsed) return localWrap();
    const v2 = validateDeepMarkdownGrounded(parsed.body, req.context);
    if (!v2.ok) return localWrap();
    return { headline: parsed.headline, body: parsed.body, source: 'remote' };
  } catch {
    return localWrap();
  }
}
