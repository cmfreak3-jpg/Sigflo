import { SigfloLogo } from '@/components/branding/SigfloLogo';

export function AppTopBar() {
  return (
    <header className="sticky top-0 z-30 -mx-4 border-b border-white/[0.06] bg-sigflo-bg/80 px-4 pb-3 pt-[max(0.25rem,env(safe-area-inset-top))] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <SigfloLogo size={30} glowing />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight text-white">Sigflo</h1>
            <p className="truncate text-[11px] text-sigflo-muted">Pro signals</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300/95 sm:inline-flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Live
          </span>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-sigflo-muted transition hover:bg-white/[0.06] hover:text-sigflo-text"
            aria-label="Notifications"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 22a2.5 2.5 0 002.45-2h-4.9A2.5 2.5 0 0012 22zm6-6V11a6 6 0 10-12 0v5l-2 2V19h16v-1l-2-2z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
