import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { runScannerDeterminismDemo } from '@/engine/demoRunner';
import type { ScannerDemoFrame } from '@/engine/demoRunner';

function PassCard({ frame, title }: { frame: ScannerDemoFrame; title: string }) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <span className="rounded-full border border-sigflo-border bg-sigflo-bg/70 px-2 py-0.5 text-[11px] text-sigflo-muted">
          run {frame.run}
        </span>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-sigflo-border bg-sigflo-bg/50 p-2">
          <p className="text-sigflo-muted">Candidates</p>
          <p className="mt-1 font-semibold text-white">{frame.candidateCount}</p>
        </div>
        <div className="rounded-lg border border-sigflo-border bg-sigflo-bg/50 p-2">
          <p className="text-sigflo-muted">Accepted</p>
          <p className="mt-1 font-semibold text-white">{frame.acceptedCount}</p>
        </div>
      </div>
      <div className="space-y-2">
        {frame.accepted.length === 0 ? (
          <p className="text-xs text-sigflo-muted">No signals accepted on this pass.</p>
        ) : (
          frame.accepted.map((s) => (
            <div
              key={`${s.symbol}-${s.setupType}-${s.setupScore}`}
              className="rounded-xl border border-sigflo-border bg-sigflo-bg/45 px-3 py-2"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-white">{s.symbol}</p>
                <p className="text-xs text-emerald-300">{s.setupScore}</p>
              </div>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-sigflo-muted">
                {s.setupType} • {s.tags.join(', ')}
              </p>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

export function EngineDebugScreen() {
  const navigate = useNavigate();
  const [rerunTick, setRerunTick] = useState(0);
  const [lastRerunAt, setLastRerunAt] = useState(() => new Date());
  const demo = useMemo(() => runScannerDeterminismDemo(), [rerunTick]);

  return (
    <div className="space-y-4 pb-6">
      <header>
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs font-semibold text-sigflo-muted transition hover:bg-white/[0.08] hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setRerunTick((n) => n + 1);
                setLastRerunAt(new Date());
              }}
              className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/15"
            >
              Rerun Demo
            </button>
            <Link
              to="/scanner-lab"
              className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/15"
            >
              Open Lab
            </Link>
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Engine Debug</h1>
        <p className="mt-1 text-sm text-sigflo-muted">
          Deterministic scanner check. Pass 2 should be reduced by cooldown/dedup.
        </p>
        <p className="mt-1 text-[11px] text-sigflo-muted">
          Reruns: {rerunTick} · Last run: {lastRerunAt.toLocaleTimeString()}
        </p>
      </header>

      <PassCard frame={demo.firstPass} title={`Pass 1: initial emit #${rerunTick + 1}`} />
      <PassCard frame={demo.secondPass} title={`Pass 2: cooldown and dedup #${rerunTick + 1}`} />
    </div>
  );
}

