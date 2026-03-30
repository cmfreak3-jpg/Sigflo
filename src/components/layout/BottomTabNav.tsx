import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/feed', label: 'Feed', icon: FeedIcon },
  { to: '/markets', label: 'Markets', icon: MarketsIcon },
  { to: '/bots', label: 'Bots', icon: BotsIcon },
  { to: '/portfolio', label: 'Portfolio', icon: PortfolioIcon },
  { to: '/profile', label: 'Profile', icon: ProfileIcon },
] as const;

export function BottomTabNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.07] bg-sigflo-bg/90 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_32px_rgba(0,0,0,0.35)] backdrop-blur-2xl"
      aria-label="Primary navigation"
    >
      <div className="mx-auto flex max-w-lg items-end justify-between px-1.5">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `group flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 transition-colors ${
                isActive ? 'text-cyan-200' : 'text-sigflo-muted hover:text-sigflo-text'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex h-10 w-14 items-center justify-center rounded-2xl transition-all ${
                    isActive
                      ? 'bg-gradient-to-b from-cyan-500/20 to-emerald-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-cyan-400/25'
                      : 'bg-transparent group-hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon active={isActive} />
                </span>
                <span
                  className={`max-w-full truncate text-[10px] font-semibold tracking-wide ${
                    isActive ? 'text-cyan-100' : ''
                  }`}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function FeedIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={active ? 'text-cyan-200' : 'currentColor'}>
      <path
        d="M4 6h16M4 12h10M4 18h16"
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

function MarketsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={active ? 'text-cyan-200' : 'currentColor'}>
      <path
        d="M4 18V6l6 8 4-6 6 10"
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BotsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={active ? 'text-cyan-200' : 'currentColor'}>
      <rect
        x="5"
        y="8"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.8}
      />
      <path d="M9 8V6a2 2 0 012-2h2a2 2 0 012 2v2" stroke="currentColor" strokeWidth={active ? 2.1 : 1.8} />
      <circle cx="10" cy="13" r="1" fill="currentColor" />
      <circle cx="14" cy="13" r="1" fill="currentColor" />
    </svg>
  );
}

function PortfolioIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={active ? 'text-cyan-200' : 'currentColor'}>
      <path
        d="M4 19V5M4 19h16M8 15V9M12 15V7M16 15v-4"
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={active ? 'text-cyan-200' : 'currentColor'}>
      <circle cx="12" cy="9" r="3.5" stroke="currentColor" strokeWidth={active ? 2.1 : 1.8} />
      <path
        d="M6 19c1.2-3 3.8-4.5 6-4.5s4.8 1.5 6 4.5"
        stroke="currentColor"
        strokeWidth={active ? 2.1 : 1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}
