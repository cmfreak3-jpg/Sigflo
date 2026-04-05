import { SigfloLogo } from '@/components/branding/SigfloLogo';
import { useSignalEngine } from '@/hooks/useSignalEngine';
import { isFeedActionableOpportunity } from '@/lib/marketScannerRows';
import { Link } from 'react-router-dom';

export function AppTopBar() {
  const { signals, loading } = useSignalEngine();
  /** Must match Feed → Actionable filter (`isFeedActionableOpportunity`), since the badge links there. */
  const actionableCount = signals.filter(isFeedActionableOpportunity).length;

  return (
    <header className="sticky top-0 z-30 -mx-4 border-b border-white/[0.06] bg-sigflo-bg/80 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] backdrop-blur-xl">
      <div className="flex min-h-7 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-1.5">
          <SigfloLogo size={28} glowing className="shrink-0" />
          <h1 className="m-0 flex h-7 min-w-0 items-center truncate text-base font-semibold leading-none tracking-tight text-white">
            Sigflo
          </h1>
        </div>
        <Link
          to="/feed?filter=actionable"
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-sigflo-accent/25 bg-sigflo-accentDim px-2.5 text-[10px] font-bold uppercase leading-none tracking-wider text-sigflo-accent transition hover:border-sigflo-accent/40 hover:bg-sigflo-accent/14"
          aria-label="Open feed filtered to actionable setups"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-pulse-dot rounded-full bg-sigflo-accent [animation-duration:1.8s]" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sigflo-accent" />
          </span>
          {loading
            ? 'Syncing...'
            : actionableCount === 0
              ? '0 setups'
              : actionableCount === 1
                ? '1 setup'
                : `${actionableCount} setups`}
        </Link>
      </div>
    </header>
  );
}
