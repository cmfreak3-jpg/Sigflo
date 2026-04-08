import { Link } from 'react-router-dom';
import { LANDING_SECTIONS } from '@/components/landing/landingSections';

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const FOOTER_LINKS = [
  { label: 'Features', id: LANDING_SECTIONS.features },
  { label: 'How It Works', id: LANDING_SECTIONS.howItWorks },
  { label: 'Screens', id: LANDING_SECTIONS.screens },
  { label: 'FAQ', id: LANDING_SECTIONS.faq },
] as const;
const APP_ENTRY_PATH = import.meta.env.BASE_URL === '/' ? '/feed' : '/';

export function LandingFooter() {
  return (
    <footer className="border-t border-white/[0.08] bg-[#0B0E14] px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-lg font-semibold tracking-tight text-landing-text">Sigflo</p>
          <p className="mt-2 max-w-xs text-sm text-landing-muted opacity-90">
            AI-assisted trading workflow — signals, guidance, execution.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-landing-muted opacity-90">
            {FOOTER_LINKS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => scrollToId(l.id)}
                className="transition-colors hover:text-landing-text"
              >
                {l.label}
              </button>
            ))}
            <Link to={APP_ENTRY_PATH} className="transition-colors hover:text-landing-text">
              Open app
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:items-end">
          <div className="flex gap-4">
            <a
              href="https://x.com/"
              target="_blank"
              rel="noreferrer noopener"
              className="text-sm text-landing-muted opacity-90 transition-colors hover:text-landing-text"
            >
              X
            </a>
            <a
              href="https://discord.com/"
              target="_blank"
              rel="noreferrer noopener"
              className="text-sm text-landing-muted opacity-90 transition-colors hover:text-landing-text"
            >
              Discord
            </a>
            <a
              href="mailto:hello@sigflo.app"
              className="text-sm text-landing-muted opacity-90 transition-colors hover:text-landing-text"
            >
              Email
            </a>
          </div>
          <p className="max-w-md text-right text-xs leading-relaxed text-landing-muted opacity-85 sm:max-w-sm">
            Trading involves risk. Sigflo does not provide guaranteed outcomes.
          </p>
        </div>
      </div>
      <p className="mx-auto mt-10 max-w-6xl text-center text-[11px] text-landing-muted opacity-60">
        © {new Date().getFullYear()} Sigflo. All rights reserved.
      </p>
    </footer>
  );
}
