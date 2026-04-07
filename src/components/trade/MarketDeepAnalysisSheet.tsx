import { useCallback, useEffect, useRef, useState } from 'react';
import { parseDeepAnalysisSections } from '@/lib/parseDeepAnalysisMarkdown';
import { requestDeepMarketAnalysis, type DeepAnalysisResponse } from '@/services/ai/client';
import type { GroundedMarketContext } from '@/types/aiGrounded';
import type { MarketRowStatus } from '@/types/markets';
import type { CryptoSignal } from '@/types/signal';

type TabId = 'quick' | 'thesis';

type MarketDeepAnalysisSheetProps = {
  open: boolean;
  onClose: () => void;
  signal: CryptoSignal;
  status: MarketRowStatus;
  tradeScore: number;
  groundedContext: GroundedMarketContext;
  /** Last concise assistant output (Explain / Watch / Entry), if any. */
  quickRead: { headline: string; body: string } | null;
};

export function MarketDeepAnalysisSheet({
  open,
  onClose,
  signal,
  status,
  tradeScore,
  groundedContext,
  quickRead,
}: MarketDeepAnalysisSheetProps) {
  const [tab, setTab] = useState<TabId>('thesis');
  const [deep, setDeep] = useState<DeepAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Avoid refetching deep analysis on every live trade-score tick while the sheet is open. */
  const tradeScoreRef = useRef(tradeScore);
  tradeScoreRef.current = tradeScore;
  const contextRef = useRef(groundedContext);
  contextRef.current = groundedContext;

  const loadDeep = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await requestDeepMarketAnalysis({
        signal,
        status,
        tradeScore: tradeScoreRef.current,
        context: contextRef.current,
      });
      setDeep(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load analysis');
    } finally {
      setLoading(false);
    }
  }, [signal, status]);

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
    setTab('thesis');
    setDeep(null);
    setError(null);
    void loadDeep();
  }, [open, signal.id, status, loadDeep]);

  if (!open) return null;

  const sections = deep ? parseDeepAnalysisSections(deep.body) : [];

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/75 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deep-analysis-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close analysis"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex max-h-[min(92dvh,880px)] w-full max-w-lg flex-col rounded-t-2xl border border-white/[0.12] bg-gradient-to-b from-[#0c1210] to-[#060808] shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.85)] sm:max-h-[min(88vh,880px)] sm:rounded-2xl sm:shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.08] px-4 pb-3 pt-4">
          <div className="min-w-0">
            <p
              id="deep-analysis-title"
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200/80"
            >
              AI market read
            </p>
            <p className="mt-1 truncate text-[15px] font-semibold text-white">{signal.pair}</p>
            <p className="mt-0.5 text-[11px] text-sigflo-muted">Separate from Exit AI — broader context only.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-white/[0.1] bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-semibold text-sigflo-muted transition hover:bg-white/[0.08] hover:text-white"
          >
            Close
          </button>
        </header>

        <div className="flex shrink-0 gap-1 border-b border-white/[0.06] px-3 pt-2">
          <button
            type="button"
            onClick={() => setTab('quick')}
            className={`min-h-[40px] flex-1 rounded-t-lg px-2 py-2 text-center text-[11px] font-bold uppercase tracking-[0.12em] transition ${
              tab === 'quick'
                ? 'bg-white/[0.08] text-cyan-100'
                : 'text-sigflo-muted hover:bg-white/[0.04] hover:text-white/85'
            }`}
          >
            Quick read
          </button>
          <button
            type="button"
            onClick={() => setTab('thesis')}
            className={`min-h-[40px] flex-1 rounded-t-lg px-2 py-2 text-center text-[11px] font-bold uppercase tracking-[0.12em] transition ${
              tab === 'thesis'
                ? 'bg-white/[0.08] text-cyan-100'
                : 'text-sigflo-muted hover:bg-white/[0.04] hover:text-white/85'
            }`}
          >
            Full thesis
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {tab === 'quick' ? (
            <div className="space-y-3">
              {quickRead ? (
                <>
                  <p className="text-[13px] font-semibold leading-snug text-white/95">{quickRead.headline}</p>
                  <p className="whitespace-pre-line text-[13px] leading-relaxed text-sigflo-muted">{quickRead.body}</p>
                </>
              ) : (
                <p className="text-[13px] leading-relaxed text-sigflo-muted">
                  Run <span className="font-semibold text-white/80">Explain setup</span>,{' '}
                  <span className="font-semibold text-white/80">What to watch</span>, or{' '}
                  <span className="font-semibold text-white/80">Improve entry</span> on the card below for a concise,
                  execution-focused take. <span className="text-white/70">Full thesis</span> works on its own for the
                  long-form narrative.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadDeep()}
                  disabled={loading}
                  className="rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-cyan-100 transition enabled:hover:bg-cyan-500/18 disabled:opacity-50"
                >
                  {loading ? 'Generating…' : 'Refresh thesis'}
                </button>
                {deep ? (
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                      deep.source === 'remote'
                        ? 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200'
                        : 'border-amber-400/35 bg-amber-500/12 text-amber-200'
                    }`}
                  >
                    {deep.source === 'remote' ? 'AI live' : 'Offline draft'}
                  </span>
                ) : null}
              </div>

              {error ? (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-100/95">
                  {error}
                  <button
                    type="button"
                    onClick={() => void loadDeep()}
                    className="ml-2 font-semibold underline decoration-rose-300/60"
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              {loading && !deep ? (
                <div className="space-y-3 py-6">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-white/[0.08]" />
                  <div className="h-3 w-full animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-3 w-5/6 animate-pulse rounded bg-white/[0.06]" />
                  <p className="pt-2 text-center text-[11px] text-sigflo-muted">Composing full thesis…</p>
                </div>
              ) : null}

              {deep ? (
                <article className="space-y-6 border-t border-white/[0.06] pt-4">
                  <h2 className="text-[15px] font-semibold leading-snug text-white/95">{deep.headline}</h2>
                  {sections.length > 0 ? (
                    sections.map((sec, idx) => (
                      <section key={`${idx}-${sec.heading}`} className="space-y-2">
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200/75">
                          {sec.heading}
                        </h3>
                        <div className="text-[13px] leading-[1.65] text-white/[0.82] [&_strong]:font-semibold [&_strong]:text-white/92">
                          {sec.text.split(/\n\n+/).map((para, i) => (
                            <p key={`${sec.heading}-${i}`} className="mb-3 last:mb-0">
                              {para}
                            </p>
                          ))}
                        </div>
                      </section>
                    ))
                  ) : (
                    <p className="whitespace-pre-wrap text-[13px] leading-[1.65] text-white/[0.82]">{deep.body}</p>
                  )}
                </article>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
