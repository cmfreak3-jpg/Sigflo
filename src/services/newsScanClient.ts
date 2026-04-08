import { resolveAppApiPath } from '@/lib/appBasePath';
import type { MarketRegime } from '@/types/aiGrounded';
import type { MarketNewsArticle, MarketNewsScanResult, MarketNewsSummary } from '@/types/marketNewsScan';

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function parseArticles(raw: unknown): MarketNewsArticle[] {
  if (!Array.isArray(raw)) return [];
  const out: MarketNewsArticle[] = [];
  for (const x of raw) {
    if (!isRecord(x)) continue;
    const id = x.id;
    const title = x.title;
    const link = x.link;
    const source = x.source;
    if (typeof id !== 'number' || typeof title !== 'string' || typeof link !== 'string' || typeof source !== 'string') {
      continue;
    }
    out.push({
      id,
      title,
      link,
      source,
      published: typeof x.published === 'string' ? x.published : '',
      excerpt: typeof x.excerpt === 'string' ? x.excerpt : '',
    });
  }
  return out;
}

function parseAssetFocus(raw: unknown): MarketNewsSummary['assetFocus'] {
  if (!isRecord(raw)) return null;
  const symbol = raw.symbol;
  const newsRelevance = raw.newsRelevance;
  const narrative = raw.narrative;
  const technicalVsNews = raw.technicalVsNews;
  if (typeof symbol !== 'string' || typeof narrative !== 'string' || typeof technicalVsNews !== 'string') {
    return null;
  }
  if (newsRelevance !== 'high' && newsRelevance !== 'medium' && newsRelevance !== 'low' && newsRelevance !== 'none') {
    return null;
  }
  return { symbol, newsRelevance, narrative, technicalVsNews };
}

function parseSummary(raw: unknown, mode: 'short' | 'deep'): MarketNewsSummary | null {
  if (!isRecord(raw)) return null;
  const marketMood = raw.marketMood;
  if (typeof marketMood !== 'string') return null;
  const keyDrivers = Array.isArray(raw.keyDrivers) ? raw.keyDrivers.filter((x): x is string => typeof x === 'string') : [];
  if (keyDrivers.length < 1) return null;
  const assetsAffected = Array.isArray(raw.assetsAffected)
    ? raw.assetsAffected
        .filter(isRecord)
        .map((o) => ({
          symbol: typeof o.symbol === 'string' ? o.symbol : '',
          note: typeof o.note === 'string' ? o.note : '',
        }))
        .filter((a) => a.symbol && a.note)
    : [];
  const whyItMatters = typeof raw.whyItMatters === 'string' ? raw.whyItMatters : '';
  if (whyItMatters.length < 4) return null;
  const whatToWatchNext = Array.isArray(raw.whatToWatchNext)
    ? raw.whatToWatchNext.filter((x): x is string => typeof x === 'string')
    : [];
  const sourcesReferenced = Array.isArray(raw.sourcesReferenced)
    ? raw.sourcesReferenced.filter((x): x is number => typeof x === 'number' && Number.isInteger(x))
    : [];
  const lowSignalSummary = Boolean(raw.lowSignalSummary);
  const assetFocus = parseAssetFocus(raw.assetFocus);
  const fullBrief =
    mode === 'deep' && typeof raw.fullBrief === 'string' && raw.fullBrief.trim().length > 0 ? raw.fullBrief.trim() : undefined;
  return {
    marketMood,
    keyDrivers,
    assetsAffected,
    whyItMatters,
    whatToWatchNext,
    sourcesReferenced,
    lowSignalSummary,
    assetFocus,
    ...(fullBrief ? { fullBrief } : {}),
  };
}

function normalizePayload(data: unknown): MarketNewsScanResult {
  if (!isRecord(data)) {
    return {
      ok: false,
      error: 'News scan response was missing required fields',
      mode: 'short',
      focusAsset: null,
      summary: null,
      articles: [],
    };
  }
  const mode = data.mode === 'deep' ? 'deep' : 'short';
  const focusAsset = typeof data.focusAsset === 'string' && data.focusAsset ? data.focusAsset : null;
  const articles = parseArticles(data.articles);
  const summaryRaw = data.summary;
  const summary =
    summaryRaw === null || summaryRaw === undefined ? null : parseSummary(summaryRaw, mode);

  return {
    ok: Boolean(data.ok),
    error: typeof data.error === 'string' ? data.error : undefined,
    noAi: Boolean(data.noAi),
    lowSignal: Boolean(data.lowSignal),
    message: typeof data.message === 'string' ? data.message : undefined,
    mode,
    focusAsset,
    summary,
    articles,
  };
}

export async function requestMarketNewsScan(req: {
  mode: 'short' | 'deep';
  focusAsset?: string | null;
  /** From trade scanner context when available; otherwise omit (server defaults to transition). */
  marketRegime?: MarketRegime;
}): Promise<MarketNewsScanResult> {
  const endpoint = resolveAppApiPath(import.meta.env.VITE_NEWS_SCAN_ENDPOINT, '/api/ai/news-scan');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: req.mode,
        focusAsset: req.focusAsset ?? null,
        ...(req.marketRegime != null ? { marketRegime: req.marketRegime } : {}),
      }),
      signal: controller.signal,
    });
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      return normalizePayload({
        ok: false,
        error: typeof data === 'object' && data && 'error' in data ? String((data as { error: unknown }).error) : `HTTP ${res.status}`,
        mode: req.mode,
        focusAsset: req.focusAsset ?? null,
        summary: null,
        articles: [],
      });
    }
    return normalizePayload(data);
  } catch {
    return {
      ok: false,
      error: 'Network error',
      mode: req.mode,
      focusAsset: req.focusAsset ?? null,
      summary: null,
      articles: [],
    };
  } finally {
    window.clearTimeout(timeout);
  }
}
