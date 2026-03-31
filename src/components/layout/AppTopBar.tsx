import { SigfloLogo } from '@/components/branding/SigfloLogo';
import { useSignalEngine } from '@/hooks/useSignalEngine';
import { deriveMarketStatus } from '@/lib/marketScannerRows';
import { uiSignalStateFromMarketStatus } from '@/lib/signalState';
import { Link } from 'react-router-dom';

export function AppTopBar() {
  const { signals, loading } = useSignalEngine();
  const { inPlayCount } = signals.reduce(
    (acc, s) => {
      const uiState = uiSignalStateFromMarketStatus(deriveMarketStatus(s));
      if (uiState === 'triggered' || uiState === 'in_play') acc.inPlayCount += 1;
      return acc;
    },
    { inPlayCount: 0 },
  );

  return (
    <header className="sticky top-0 z-30 -mx-4 border-b border-white/[0.06] bg-sigflo-bg/80 px-4 pb-3 pt-[max(0.25rem,env(safe-area-inset-top))] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <SigfloLogo size={28} glowing />
          <h1 className="truncate text-base font-semibold tracking-tight text-white">Sigflo</h1>
        </div>
        <Link
          to="/feed?filter=actionable"
          className="inline-flex items-center gap-1.5 rounded-full border border-sigflo-accent/25 bg-sigflo-accentDim px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sigflo-accent transition hover:border-sigflo-accent/40 hover:bg-sigflo-accent/14"
          aria-label="Open feed filtered to active setups"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-pulse-dot rounded-full bg-sigflo-accent [animation-duration:1.8s]" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sigflo-accent" />
          </span>
          {loading ? 'Syncing...' : `${inPlayCount} in play`}
        </Link>
      </div>
    </header>
  );
}
