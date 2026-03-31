import { SigfloLogo } from '@/components/branding/SigfloLogo';
import { LiveBadge } from '@/components/ui/LiveBadge';

export function AppTopBar() {
  return (
    <header className="sticky top-0 z-30 -mx-4 border-b border-white/[0.06] bg-sigflo-bg/80 px-4 pb-3 pt-[max(0.25rem,env(safe-area-inset-top))] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <SigfloLogo size={28} glowing />
          <h1 className="truncate text-base font-semibold tracking-tight text-white">Sigflo</h1>
        </div>
        <LiveBadge />
      </div>
    </header>
  );
}
