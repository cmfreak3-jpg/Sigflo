/**
 * Fetches public RSS/Atom feeds server-side, then asks the model for a grounded summary
 * (only article ids provided — no invented headlines).
 */

import { REGIME_TONE_GUIDE, normalizeMarketRegime } from './regime-tone.mjs';

const DEFAULT_OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

const DEFAULT_FEEDS = [
  'https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml',
  'https://cointelegraph.com/rss',
  'https://decrypt.co/feed',
  'https://www.federalreserve.gov/feeds/press_all.xml',
];

const FETCH_TIMEOUT_MS = 10_000;
const MAX_ITEMS_PER_FEED = 14;
const MAX_ARTICLES_FOR_MODEL = 26;
const EXCERPT_LEN = 420;

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** Human-readable error when the chat-completions request is not OK (still returns articles to the client). */
async function formatAiHttpError(response) {
  const status = response.status;
  let apiMsg = '';
  try {
    const raw = await response.text();
    const j = safeJsonParse(raw);
    const msg = j?.error?.message ?? j?.message;
    if (typeof msg === 'string') {
      apiMsg = msg.replace(/\s+/g, ' ').trim().slice(0, 280);
    }
  } catch {
    /* ignore */
  }
  const hint =
    status === 401 || status === 403
      ? ' Check OPENAI_API_KEY (Netlify env or local .env) and redeploy / restart dev.'
      : status === 429
        ? ' Rate limited — try again in a moment.'
        : status === 404
          ? ' Check OPENAI_API_ENDPOINT / AI_ENDPOINT matches your provider (default is OpenAI v1/chat/completions).'
          : '';
  if (apiMsg) return `AI request failed (HTTP ${status}): ${apiMsg}`;
  return `AI request failed (HTTP ${status}).${hint}`;
}

function decodeBasicEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(html) {
  return decodeBasicEntities(String(html).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').replace(/<[^>]+>/g, ' '));
}

function truncate(s, n) {
  const t = stripTags(s);
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}

function extractTag(block, tagName) {
  const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const m = block.match(re);
  if (!m) return '';
  return decodeBasicEntities(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1'));
}

function parseRssItems(xml, feedLabel) {
  const out = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) && out.length < MAX_ITEMS_PER_FEED) {
    const block = m[1];
    const title = extractTag(block, 'title');
    let link = extractTag(block, 'link');
    if (!link) {
      const lm = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
      link = lm ? decodeBasicEntities(lm[1]) : '';
    }
    const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'dc:date') || '';
    const desc = extractTag(block, 'description') || extractTag(block, 'content:encoded') || '';
    if (title && link) {
      out.push({
        title: truncate(title, 220),
        link: link.trim(),
        published: pubDate,
        excerpt: truncate(desc, EXCERPT_LEN),
        source: feedLabel,
      });
    }
  }
  return out;
}

function parseAtomEntries(xml, feedLabel) {
  const out = [];
  const entryRe = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
  let m;
  while ((m = entryRe.exec(xml)) && out.length < MAX_ITEMS_PER_FEED) {
    const block = m[1];
    const title = extractTag(block, 'title');
    let link = '';
    const hrefM = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i);
    if (hrefM) link = decodeBasicEntities(hrefM[1]);
    if (!link) link = extractTag(block, 'link');
    const updated = extractTag(block, 'updated') || extractTag(block, 'published') || '';
    const summary = extractTag(block, 'summary') || extractTag(block, 'content') || '';
    if (title && link) {
      out.push({
        title: truncate(title, 220),
        link: link.trim(),
        published: updated,
        excerpt: truncate(summary, EXCERPT_LEN),
        source: feedLabel,
      });
    }
  }
  return out;
}

function feedLabelFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'feed';
  }
}

function parseFeedXml(xml, feedUrl) {
  const label = feedLabelFromUrl(feedUrl);
  const lower = xml.slice(0, 1200).toLowerCase();
  if (lower.includes('<feed')) {
    const atom = parseAtomEntries(xml, label);
    if (atom.length) return atom;
  }
  const rss = parseRssItems(xml, label);
  if (rss.length) return rss;
  return parseAtomEntries(xml, label);
}

async function fetchText(url, signal) {
  const res = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      'User-Agent': 'SigfloNewsScan/1.0 (+https://sigflo.app)',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function normalizeFocusAsset(s) {
  if (typeof s !== 'string') return null;
  let u = s.trim().toUpperCase();
  if (!u) return null;
  if (u.endsWith('USDT')) u = u.slice(0, -4);
  if (u.endsWith('USDC')) u = u.slice(0, -4);
  if (u.endsWith('USD')) u = u.slice(0, -3);
  return u.slice(0, 16) || null;
}

function parseFeedsEnv(env) {
  const raw = env.NEWS_RSS_FEEDS?.trim();
  if (!raw) return DEFAULT_FEEDS;
  try {
    const j = JSON.parse(raw);
    if (Array.isArray(j) && j.every((x) => typeof x === 'string')) return j;
  } catch {
    /* fall through */
  }
  return raw
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function dedupeArticles(items) {
  const seen = new Set();
  const out = [];
  for (const a of items) {
    const key = a.link.replace(/\/$/, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

function articleTimeMs(a) {
  const t = Date.parse(a.published || '');
  return Number.isFinite(t) ? t : 0;
}

const NEWS_SCAN_SYSTEM = `You are Sigflo's market news desk. You ONLY summarize the numbered articles in the user JSON.

Hard rules:
- Do not invent headlines, firms, dates, numbers, or events that are not clearly supported by those articles.
- If the feed set is thin or unrelated to markets, set lowSignalSummary true and keep copy humble.
- keyDrivers: each bullet must be traceable to specific article ids (you will list those ids in sourcesReferenced).
- assetsAffected: only include assets clearly implicated in the articles; use short symbols (BTC, ETH, SOL, etc.). If unclear, use fewer entries.
- marketMood: one concise trader-friendly line (risk-on / risk-off / mixed / wait-and-see style when appropriate).
- whyItMatters: 2–4 sentences, concrete, no hype adjectives.
- whatToWatchNext: 2–5 short bullets — forward catalysts or levels of attention mentioned or implied in the articles (not fabricated).
- Tone: thoughtful human trader, not a news anchor. No "delve", no vague "market participants". No emojis.
- The user JSON includes marketRegime (trending | range | risk_off | transition) and regimeToneGuide from the app’s engine. Use them to calibrate mood, hedging, and emphasis in marketMood / whyItMatters / whatToWatchNext — still only state facts supported by the articles; do not invent macro or price narratives to match the regime.

If focusAsset is set in the user JSON, you MUST include assetFocus (not null):
- symbol exactly equals focusAsset
- newsRelevance: high | medium | low | none
- narrative: what in THESE articles matters for that asset, or clearly state if nothing substantive mentions it
- technicalVsNews: one sentence on whether price action today is plausibly news-driven vs likely technical/flow (only from article cues; if unknown say so)

Return a single JSON object with keys:
marketMood (string),
keyDrivers (array of string, max 6),
assetsAffected (array of { symbol: string, note: string }, max 8),
whyItMatters (string),
whatToWatchNext (array of string, max 6),
sourcesReferenced (array of integer article ids that you relied on for substantive claims),
lowSignalSummary (boolean),
assetFocus (null OR object with symbol, newsRelevance, narrative, technicalVsNews),
fullBrief (string, optional — ONLY when user asks for deep mode: longer markdown sections ## Overview, ## What moved, ## Crypto tape, ## Macro / rates, ## Risks, ## What to watch; still grounded in the same articles)`;

function validateSummary(obj, mode, focusAsset) {
  if (!obj || typeof obj !== 'object') return null;
  const marketMood = typeof obj.marketMood === 'string' ? obj.marketMood.trim() : '';
  const keyDrivers = Array.isArray(obj.keyDrivers) ? obj.keyDrivers.filter((x) => typeof x === 'string').slice(0, 6) : [];
  const assetsAffected = Array.isArray(obj.assetsAffected)
    ? obj.assetsAffected
        .filter((x) => x && typeof x === 'object' && typeof x.symbol === 'string' && typeof x.note === 'string')
        .slice(0, 8)
        .map((x) => ({ symbol: x.symbol.trim(), note: x.note.trim() }))
    : [];
  const whyItMatters = typeof obj.whyItMatters === 'string' ? obj.whyItMatters.trim() : '';
  const whatToWatchNext = Array.isArray(obj.whatToWatchNext)
    ? obj.whatToWatchNext.filter((x) => typeof x === 'string').slice(0, 6)
    : [];
  const sourcesReferenced = Array.isArray(obj.sourcesReferenced)
    ? obj.sourcesReferenced.filter((x) => Number.isInteger(x)).slice(0, 40)
    : [];
  const lowSignalSummary = Boolean(obj.lowSignalSummary);
  let assetFocus = null;
  if (focusAsset) {
    const af = obj.assetFocus && typeof obj.assetFocus === 'object' ? obj.assetFocus : null;
    if (
      af &&
      typeof af.symbol === 'string' &&
      typeof af.narrative === 'string' &&
      typeof af.technicalVsNews === 'string' &&
      ['high', 'medium', 'low', 'none'].includes(af.newsRelevance)
    ) {
      assetFocus = {
        symbol: af.symbol.trim(),
        newsRelevance: af.newsRelevance,
        narrative: af.narrative.trim(),
        technicalVsNews: af.technicalVsNews.trim(),
      };
    } else {
      assetFocus = {
        symbol: focusAsset,
        newsRelevance: 'none',
        narrative:
          'No reliable asset-specific thread in the retrieved headlines — the model did not return a structured asset block.',
        technicalVsNews: 'Treat price action as mostly technical/flow unless your chart context says otherwise.',
      };
    }
  } else if (obj.assetFocus && typeof obj.assetFocus === 'object') {
    const af = obj.assetFocus;
    if (
      typeof af.symbol === 'string' &&
      typeof af.narrative === 'string' &&
      typeof af.technicalVsNews === 'string' &&
      ['high', 'medium', 'low', 'none'].includes(af.newsRelevance)
    ) {
      assetFocus = {
        symbol: af.symbol.trim(),
        newsRelevance: af.newsRelevance,
        narrative: af.narrative.trim(),
        technicalVsNews: af.technicalVsNews.trim(),
      };
    }
  }
  let fullBrief = '';
  if (mode === 'deep' && typeof obj.fullBrief === 'string') {
    fullBrief = obj.fullBrief.trim().slice(0, 24_000);
  }
  if (!marketMood || keyDrivers.length < 1) return null;
  if (!whyItMatters || whyItMatters.length < 4) return null;
  return {
    marketMood,
    keyDrivers,
    assetsAffected,
    whyItMatters,
    whatToWatchNext,
    sourcesReferenced,
    lowSignalSummary,
    assetFocus,
    ...(mode === 'deep' && fullBrief ? { fullBrief } : {}),
  };
}

/**
 * @param {string | undefined} rawBody
 * @param {NodeJS.ProcessEnv} env
 */
export async function runMarketNewsScan(rawBody, env) {
  const payload = safeJsonParse(rawBody || '');
  const mode = payload?.mode === 'deep' ? 'deep' : 'short';
  const focusAsset = normalizeFocusAsset(payload?.focusAsset ?? '');
  const marketRegime = normalizeMarketRegime(payload?.marketRegime);

  const feeds = parseFeedsEnv(env);
  const collected = [];
  for (const url of feeds) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const xml = await fetchText(url, controller.signal);
      collected.push(...parseFeedXml(xml, url));
    } catch {
      /* skip broken feed */
    } finally {
      clearTimeout(timer);
    }
  }

  const merged = dedupeArticles(collected).sort((a, b) => articleTimeMs(b) - articleTimeMs(a));
  const articles = merged.slice(0, MAX_ARTICLES_FOR_MODEL).map((a, i) => ({
    id: i + 1,
    title: a.title,
    link: a.link,
    source: a.source,
    published: a.published || '',
    excerpt: a.excerpt,
  }));

  if (articles.length === 0) {
    return {
      ok: true,
      lowSignal: true,
      mode,
      focusAsset,
      summary: null,
      articles: [],
      message: 'No headlines could be loaded from configured feeds. Check back or refresh.',
    };
  }

  const apiKey = env.OPENAI_API_KEY || env.AI_API_KEY;
  const endpoint = env.OPENAI_API_ENDPOINT || env.AI_ENDPOINT || DEFAULT_OPENAI_ENDPOINT;
  const model = env.OPENAI_MODEL || env.AI_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    return {
      ok: true,
      noAi: true,
      lowSignal: true,
      mode,
      focusAsset,
      summary: null,
      articles,
      message: 'AI summary unavailable (server API key not configured). Headlines below are raw feed excerpts.',
    };
  }

  const userPayload = {
    mode,
    focusAsset,
    marketRegime,
    regimeToneGuide: REGIME_TONE_GUIDE[marketRegime],
    articles,
    instruction:
      mode === 'deep'
        ? 'Include fullBrief with the markdown sections listed in the system prompt.'
        : 'Omit fullBrief. Keep keyDrivers and whatToWatchNext tight (scannable).',
    focusInstruction: focusAsset
      ? `assetFocus is required (not null). Use symbol "${focusAsset}" exactly. If articles barely mention it, set newsRelevance to "none" and say so honestly in narrative.`
      : 'Set assetFocus to null.',
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55_000);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.28,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: NEWS_SCAN_SYSTEM },
          { role: 'user', content: JSON.stringify(userPayload) },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const error = await formatAiHttpError(response);
      return {
        ok: false,
        error,
        mode,
        focusAsset,
        summary: null,
        articles,
      };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      return {
        ok: false,
        error: 'Empty AI response',
        mode,
        focusAsset,
        summary: null,
        articles,
      };
    }

    const parsed = safeJsonParse(content.trim());
    const summary = validateSummary(parsed, mode, focusAsset);
    if (!summary) {
      return {
        ok: false,
        error: 'Could not parse AI summary',
        mode,
        focusAsset,
        summary: null,
        articles,
      };
    }

    const maxId = articles.length;
    const sourcesReferenced = summary.sourcesReferenced.filter((id) => id >= 1 && id <= maxId);

    return {
      ok: true,
      lowSignal: Boolean(summary.lowSignalSummary || articles.length < 4),
      mode,
      focusAsset,
      summary: { ...summary, sourcesReferenced },
      articles,
    };
  } catch (e) {
    const aborted = e?.name === 'AbortError';
    return {
      ok: false,
      error: aborted
        ? 'News scan timed out while calling the AI. Try again or use a shorter scan.'
        : 'News scan failed (network or unexpected error).',
      mode,
      focusAsset,
      summary: null,
      articles,
    };
  }
}
