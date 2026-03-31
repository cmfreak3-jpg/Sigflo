import { Outlet } from 'react-router-dom';
import { AppTopBar } from '@/components/layout/AppTopBar';
import { BottomTabNav } from '@/components/layout/BottomTabNav';

export function AppShell() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-sigflo-bg">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,255,200,0.06),transparent)]"
        aria-hidden
      />
      <main className="relative flex-1 pb-[calc(5.25rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-lg px-4">
          <AppTopBar />
          <Outlet />
        </div>
      </main>
      <BottomTabNav />
    </div>
  );
}
