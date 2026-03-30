import { useMemo } from 'react';
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
  const demo = useMemo(() => runScannerDeterminismDemo(), []);

  return (
    <div className="space-y-4 pb-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Engine Debug</h1>
        <p className="mt-1 text-sm text-sigflo-muted">
          Deterministic scanner check. Pass 2 should be reduced by cooldown/dedup.
        </p>
      </header>

      <PassCard frame={demo.firstPass} title="Pass 1: initial emit" />
      <PassCard frame={demo.secondPass} title="Pass 2: cooldown and dedup" />
    </div>
  );
}

