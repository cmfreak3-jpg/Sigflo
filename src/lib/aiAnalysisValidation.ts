import type { AiStructuredAnalysis, GroundedMarketContext } from '@/types/aiGrounded';

const BANNED_TERMS_DEFAULT = [
  'MACD',
  'Bollinger',
  'Ichimoku',
  'VWAP',
  'stochastic',
  'fibonacci',
  'fib retracement',
  'elliott wave',
  'harmonic',
];

function levelMatchesAllowed(n: number, allowed: number[], relTol = 0.0005, absTol = 1e-8): boolean {
  for (const a of allowed) {
    const tol = Math.max(absTol, Math.abs(a) * relTol);
    if (Math.abs(n - a) <= tol) return true;
  }
  return false;
}

export function parseAiStructuredAnalysis(raw: unknown): AiStructuredAnalysis | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const bias = o.bias;
  if (bias !== 'long' && bias !== 'short' && bias !== 'neutral') return null;
  const confidence = o.confidence;
  if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 100) {
    return null;
  }
  const reasoning = o.reasoning;
  const notes = o.notes;
  const trade_valid = o.trade_valid;
  if (typeof reasoning !== 'string' || typeof notes !== 'string' || typeof trade_valid !== 'boolean') {
    return null;
  }
  const levelsRaw = o.levels_used;
  if (!Array.isArray(levelsRaw)) return null;
  const levels_used: number[] = [];
  for (const x of levelsRaw) {
    if (typeof x === 'number' && Number.isFinite(x)) levels_used.push(x);
    else if (typeof x === 'string' && Number.isFinite(Number(x))) levels_used.push(Number(x));
    else return null;
  }
  return {
    bias,
    confidence: Math.round(confidence),
    reasoning: reasoning.trim(),
    levels_used,
    trade_valid,
    notes: notes.trim(),
  };
}

function textViolatesIndicatorAllowlist(text: string, allowed: string[]): boolean {
  const lower = text.toLowerCase();
  for (const term of BANNED_TERMS_DEFAULT) {
    if (lower.includes(term.toLowerCase())) return true;
  }
  if (/\brsi\b/i.test(text) && !allowed.some((a) => a.toLowerCase().includes('rsi'))) return true;
  if (/\bema\b/i.test(text) && !allowed.some((a) => a.toLowerCase().includes('ema'))) return true;
  if (/\batr\b/i.test(text) && !allowed.some((a) => a.toLowerCase().includes('atr'))) return true;
  if (/\bvolume\b/i.test(text) && !allowed.some((a) => a.toLowerCase().includes('volume'))) return true;
  return false;
}

/** Long-form thesis only: hard-banned indicators only (no RSI/volume prose checks — they false-fail normal copy). */
function deepTextViolatesHardBannedIndicators(text: string): boolean {
  const lower = text.toLowerCase();
  for (const term of BANNED_TERMS_DEFAULT) {
    if (lower.includes(term.toLowerCase())) return true;
  }
  return false;
}

export type ValidationResult = { ok: true } | { ok: false; reason: string };

export function validateGroundedStructuredAnalysis(
  s: AiStructuredAnalysis,
  ctx: GroundedMarketContext,
): ValidationResult {
  if (!s.reasoning || s.reasoning.length < 4) {
    return { ok: false, reason: 'reasoning_too_short' };
  }
  for (const lvl of s.levels_used) {
    if (!levelMatchesAllowed(lvl, ctx.allowedPriceLevels)) {
      return { ok: false, reason: `level_not_in_package:${lvl}` };
    }
  }
  const combined = `${s.reasoning}\n${s.notes}`;
  if (textViolatesIndicatorAllowlist(combined, ctx.allowedIndicatorTerms)) {
    return { ok: false, reason: 'unsupported_indicator_mentioned' };
  }
  return { ok: true };
}

/**
 * Deep thesis: block only hard-banned indicators (MACD, Fib, etc.). Do not apply the same RSI/EMA/volume
 * substring rules as quick JSON — models say "volume" in plain English and we would fall back to offline
 * draft every time.
 *
 * Price check: decimals with 2+ fractional digits must either sit in a loose band around packaged levels
 * (so we still catch hallucinated levels near the trade) or be ignored (years like 2024.12, tiny ratios).
 */
export function validateDeepMarkdownGrounded(body: string, ctx: GroundedMarketContext): ValidationResult {
  if (deepTextViolatesHardBannedIndicators(body)) {
    return { ok: false, reason: 'deep_indicator_violation' };
  }
  const allowed = ctx.allowedPriceLevels;
  if (allowed.length === 0) return { ok: true };
  const minL = Math.min(...allowed);
  const maxL = Math.max(...allowed);
  const envelopeLow = Math.max(0, minL * 0.05);
  const envelopeHigh = maxL * 20;
  const re = /\b\d+\.\d{2,12}\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const raw = m[0];
    if (/^(?:19|20)\d{2}\.\d{2}$/.test(raw)) continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    if (n < envelopeLow || n > envelopeHigh) continue;
    if (!levelMatchesAllowed(n, allowed, 0.012, 1e-5)) {
      return { ok: false, reason: `deep_unlisted_price:${raw}` };
    }
  }
  return { ok: true };
}
