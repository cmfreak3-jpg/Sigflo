import { SigfloLogo } from '@/components/branding/SigfloLogo';

export function SplashScreen() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-sigflo-bg">
      <div className="relative flex flex-col items-center gap-4">
        <div className="absolute h-32 w-32 rounded-full bg-cyan-400/15 blur-3xl" aria-hidden />
        <div className="absolute h-28 w-28 rounded-full bg-emerald-400/10 blur-2xl" aria-hidden />
        <SigfloLogo size={92} glowing className="animate-pulse" />
        <p className="text-sm font-medium tracking-wide text-sigflo-muted">Loading Sigflo...</p>
      </div>
    </div>
  );
}
