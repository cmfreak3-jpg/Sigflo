import { useCallback, useEffect, useMemo, useState } from 'react';
import { requestMarketNewsScan } from '@/services/newsScanClient';
import type { MarketRegime } from '@/types/aiGrounded';
import type { MarketNewsArticle, MarketNewsScanResult } from '@/types/marketNewsScan';

type MarketNewsScanSheetProps = {
  open: boolean;
  onClose: () => void;
  /** Base asset symbol, e.g. SOL — optional asset-specific scan */
  focusAsset?: string | null;
  /** When opened from trade context, steers summary tone without inventing facts */
  marketRegime?: MarketRegime;
};

function relevanceStyles(rel: string): string {
  switch (rel) {
    case 'high':
      return 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200';
    case 'medium':
      return 'border-amber-400/35 bg-amber-500/12 text-amber-200';
    case 'low':
      return 'border-slate-400/30 bg-slate-500/10 text-slate-200';
    default:
      return 'border-white/[0.08] bg-white/[0.04] text-sigflo-muted';
  }
}

function referencedArticles(summary: NonNullable<MarketNewsScanResult['summary']>, articles: MarketNewsArticle[]) {
  const ids = new Set(summary.sourcesReferenced);
  return articles.filter((a) => ids.has(a.id));
}

export function MarketNewsScanSheet({ open, onClose, focusAsset = null, marketRegime }: MarketNewsScanSheetProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MarketNewsScanResult | null>(null);
  const [lastMode, setLastMode] = useState<'short' | 'deep'>('short');

  const title = focusAsset ? `${focusAsset} · news context` : "Today's market brief";

  const run = useCallback(
    async (mode: 'short' | 'deep') => {
      setLoading(true);
      setLastMode(mode);
      try {
        const r = await requestMarketNewsScan({
          mode,
          focusAsset,
          ...(marketRegime != null ? { marketRegime } : {}),
        });
        setResult(r);
      } finally {
        setLoading(false);
      }
    },
    [focusAsset, marketRegime],
  );

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    void run('short');
  }, [open, focusAsset, run]);

  const sources = useMemo(() => {
    if (!result?.summary) return [];
    return referencedArticles(result.summary, result.articles);
  }, [result]);

  if (!open) return null;

  const s = result?.summary;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/75 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="news-scan-title"
      aria-busy={loading}
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div
        className="relative z-10 flex max-h-[min(92dvh,880px)] w-full max-w-lg flex-col rounded-t-2xl border border-white/[0.12] bg-gradient-to-b from-[#0c1210] to-[#060808] shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.85)] sm:max-h-[min(88vh,880px)] sm:rounded-2xl sm:shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.08] px-4 pb-3 pt-4">
          <div className="min-w-0">
            <p
              id="news-scan-title"
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200/80"
            >
              AI news scan
            </p>
            <p className="mt-1 text-[15px] font-semibold text-white">{title}</p>
            <p className="mt-0.5 text-[11px] text-sigflo-muted">
              Summaries are grounded in live RSS headlines only — not investment advice.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-white/[0.1] bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-semibold text-sigflo-muted transition hover:bg-white/[0.08] hover:text-white"
          >
            Close
          </button>
        </header>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/[0.06] px-4 py-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void run('short')}
            className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-sigflo-text transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void run('deep')}
            className="rounded-lg border border-cyan-400/25 bg-cyan-500/[0.1] px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/16 disabled:opacity-50"
          >
            Full market brief
          </button>
          {loading ? (
            <span className="text-[11px] text-sigflo-muted">
              {lastMode === 'deep' ? 'Pulling feeds & writing brief…' : 'Scanning feeds…'}
            </span>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          {loading && !result ? (
            <div className="space-y-3 py-8">
              <div className="h-3 w-3/4 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-3 w-full animate-pulse rounded bg-white/[0.05]" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-white/[0.05]" />
            </div>
          ) : null}

          {result?.message ? (
            <div className="mb-3 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] px-3 py-2">
              <p className="text-[12px] leading-relaxed text-amber-100/90">{result.message}</p>
              {result.noAi && import.meta.env.DEV ? (
                <p className="mt-2 border-t border-amber-400/15 pt-2 text-[10px] leading-snug text-amber-200/65">
                  Set <span className="font-mono text-amber-100/80">OPENAI_API_KEY</span> (or{' '}
                  <span className="font-mono text-amber-100/80">AI_API_KEY</span>) in root{' '}
                  <span className="font-mono text-amber-100/80">.env</span> or{' '}
                  <span className="font-mono text-amber-100/80">.env.local</span>, or in{' '}
                  <span className="font-mono text-amber-100/80">backend/.env</span>. Restart{' '}
                  <span className="font-mono text-amber-100/80">netlify dev</span> /{' '}
                  <span className="font-mono text-amber-100/80">npm run dev:vite</span> after saving.
                </p>
              ) : null}
            </div>
          ) : null}

          {result && !result.ok && result.error ? (
            <p className="mb-3 text-[12px] leading-snug text-rose-200/90 [overflow-wrap:anywhere]">{result.error}</p>
          ) : null}

          {result?.lowSignal && s && !s.lowSignalSummary ? (
            <p className="mb-3 text-[11px] text-sigflo-muted">Thin headline set — interpret with extra caution.</p>
          ) : null}

          {s?.lowSignalSummary ? (
            <p className="mb-3 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[11px] text-sigflo-muted">
              Low signal in today&apos;s feeds — the bullets below are intentionally cautious.
            </p>
          ) : null}

          {s ? (
            <div className="space-y-4">
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-sigflo-muted">Market mood</h3>
                <p className="mt-1.5 text-[14px] font-medium leading-snug text-white">{s.marketMood}</p>
              </section>

              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-sigflo-muted">What&apos;s moving it</h3>
                <ul className="mt-2 list-none space-y-2">
                  {s.keyDrivers.map((line, i) => (
                    <li key={i} className="flex gap-2 text-[12px] leading-snug text-white/90">
                      <span className="shrink-0 font-bold text-cyan-300/70">·</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {s.assetsAffected.length > 0 ? (
                <section>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-sigflo-muted">Assets in play</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {s.assetsAffected.map((a, i) => (
                      <div
                        key={`${a.symbol}-${i}`}
                        className="max-w-full rounded-xl border border-white/[0.08] bg-black/30 px-2.5 py-1.5"
                      >
                        <span className="font-mono text-[11px] font-bold text-cyan-200/90">{a.symbol}</span>
                        <p className="mt-0.5 text-[11px] leading-snug text-sigflo-muted">{a.note}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-sigflo-muted">Why it matters</h3>
                <p className="mt-2 text-[12px] leading-relaxed text-white/88">{s.whyItMatters}</p>
              </section>

              {s.whatToWatchNext.length > 0 ? (
                <section>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-sigflo-muted">What to watch next</h3>
                  <ul className="mt-2 list-none space-y-1.5">
                    {s.whatToWatchNext.map((line, i) => (
                      <li key={i} className="flex gap-2 text-[12px] leading-snug text-white/85">
                        <span className="shrink-0 text-cyan-300/60">→</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {s.assetFocus ? (
                <section className="rounded-xl border border-cyan-400/15 bg-cyan-500/[0.05] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200/80">Asset lens</h3>
                    <span className="font-mono text-[11px] font-semibold text-white">{s.assetFocus.symbol}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${relevanceStyles(s.assetFocus.newsRelevance)}`}
                    >
                      News relevance: {s.assetFocus.newsRelevance}
                    </span>
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-white/88">{s.assetFocus.narrative}</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-sigflo-muted">{s.assetFocus.technicalVsNews}</p>
                </section>
              ) : focusAsset ? (
                <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[11px] leading-relaxed text-sigflo-muted">
                    No dedicated asset block returned — the model may not have found strong {focusAsset}-specific items in
                    this headline batch.
                  </p>
                </section>
              ) : null}

              {s.fullBrief ? (
                <section>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-sigflo-muted">Full brief</h3>
                  <div className="mt-2 whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-black/35 p-3 text-[12px] leading-relaxed text-white/85">
                    {s.fullBrief}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

          {!loading && result && !s && result.articles.length > 0 ? (
            <section className="mt-2">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-sigflo-muted">Recent headlines</h3>
              <ul className="mt-2 space-y-2">
                {result.articles.slice(0, 12).map((a) => (
                  <li key={a.id} className="rounded-lg border border-white/[0.05] bg-black/25 px-2.5 py-2">
                    <a
                      href={a.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] font-medium text-cyan-200/95 underline-offset-2 hover:underline"
                    >
                      {a.title}
                    </a>
                    <p className="mt-0.5 text-[10px] text-sigflo-muted">
                      {a.source}
                      {a.published ? ` · ${a.published}` : ''}
                    </p>
                    {a.excerpt ? <p className="mt-1 text-[11px] leading-snug text-sigflo-muted">{a.excerpt}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {!loading && result && !s && result.articles.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-sigflo-muted">Nothing to show yet — try refresh.</p>
          ) : null}
        </div>

        {sources.length > 0 ? (
          <footer className="shrink-0 border-t border-white/[0.06] px-4 py-3">
            <h3 className="text-[9px] font-bold uppercase tracking-[0.16em] text-sigflo-muted">Sources used in summary</h3>
            <ul className="mt-2 max-h-32 space-y-1.5 overflow-y-auto">
              {sources.map((a) => (
                <li key={a.id} className="text-[10px] leading-snug">
                  <a
                    href={a.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-200/85 underline-offset-2 hover:underline"
                  >
                    [{a.id}] {a.title}
                  </a>
                  <span className="text-sigflo-muted"> · {a.source}</span>
                </li>
              ))}
            </ul>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
