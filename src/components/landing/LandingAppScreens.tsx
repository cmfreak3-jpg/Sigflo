import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { LANDING_SECTIONS } from '@/components/landing/landingSections';
import { ScrollReveal } from '@/components/landing/ScrollReveal';

function ScreenChrome({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-landing-bg">
      <div className="flex items-center gap-1.5 border-b border-white/[0.08] px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-white/20" />
        <span className="h-2 w-2 rounded-full bg-white/15" />
        <span className="h-2 w-2 rounded-full bg-white/10" />
        <span className="ml-2 flex-1 truncate text-center text-[10px] text-landing-muted opacity-90">
          Sigflo
        </span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function SignalFeedMock() {
  return (
    <ScreenChrome>
      <p className="text-[10px] font-medium uppercase tracking-wide text-landing-muted opacity-90">
        Signal feed
      </p>
      <div className="mt-2 space-y-2">
        {[
          { pair: 'ETH / USDT', tag: 'Pullback', conf: '74' },
          { pair: 'SOL / USDT', tag: 'Trend', conf: '61' },
          { pair: 'BTC / USDT', tag: 'Range', conf: '58' },
        ].map((row) => (
          <div
            key={row.pair}
            className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-landing-card/80 px-2 py-2"
          >
            <div>
              <p className="text-[11px] font-semibold text-landing-text">{row.pair}</p>
              <p className="text-[9px] text-landing-muted opacity-90">{row.tag} setup</p>
            </div>
            <span className="rounded bg-landing-surface px-1.5 py-0.5 text-[9px] tabular-nums text-landing-accent">
              {row.conf}
            </span>
          </div>
        ))}
      </div>
    </ScreenChrome>
  );
}

function TradeSetupMock() {
  return (
    <ScreenChrome>
      <p className="text-[10px] font-medium uppercase tracking-wide text-landing-muted opacity-90">
        Trade setup
      </p>
      <div className="mt-2 rounded-lg border border-white/[0.06] bg-landing-card/90 p-2">
        <div className="flex justify-between text-[10px]">
          <span className="text-landing-muted opacity-90">Pair</span>
          <span className="font-medium text-landing-text">BTC / USDT</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1 text-center">
          <div className="rounded bg-landing-bg py-1.5">
            <p className="text-[8px] text-landing-muted opacity-90">Entry</p>
            <p className="text-[10px] font-semibold tabular-nums text-landing-text">94.1k</p>
          </div>
          <div className="rounded bg-landing-bg py-1.5">
            <p className="text-[8px] text-landing-muted opacity-90">Stop</p>
            <p className="text-[10px] font-semibold tabular-nums text-rose-300/90">93.4k</p>
          </div>
          <div className="rounded bg-landing-bg py-1.5">
            <p className="text-[8px] text-landing-muted opacity-90">TP</p>
            <p className="text-[10px] font-semibold tabular-nums text-emerald-300/90">96.0k</p>
          </div>
        </div>
        <div className="mt-2 h-8 rounded bg-gradient-to-t from-landing-accent/10 to-transparent">
          <svg viewBox="0 0 120 32" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
            <polyline
              fill="none"
              stroke="rgb(0,200,120)"
              strokeWidth="1.2"
              points="0,24 20,20 40,22 60,14 80,12 100,8 120,10"
            />
          </svg>
        </div>
      </div>
    </ScreenChrome>
  );
}

function PositionRiskMock() {
  return (
    <ScreenChrome>
      <p className="text-[10px] font-medium uppercase tracking-wide text-landing-muted opacity-90">
        Position & risk
      </p>
      <div className="mt-2 space-y-2">
        <div className="flex justify-between text-[10px]">
          <span className="text-landing-muted opacity-90">Notional</span>
          <span className="tabular-nums text-landing-text">$4,250</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-landing-surface">
          <div className="h-full w-[38%] rounded-full bg-landing-accent/80" />
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-landing-muted opacity-90">Risk vs. account</span>
          <span className="tabular-nums text-landing-muted">1.1%</span>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-landing-card/80 px-2 py-2 text-[9px] leading-relaxed text-landing-muted opacity-90">
          Liquidation buffer and stop distance summarized for quick sanity checks.
        </div>
      </div>
    </ScreenChrome>
  );
}

function ExchangeConnectMock() {
  return (
    <ScreenChrome>
      <p className="text-[10px] font-medium uppercase tracking-wide text-landing-muted opacity-90">
        Connections
      </p>
      <div className="mt-3 flex flex-col items-center gap-2">
        <div className="w-full rounded-lg border border-landing-accent/30 bg-landing-accent-dim px-3 py-3 text-center">
          <p className="text-[11px] font-semibold text-landing-text">Bybit</p>
          <p className="mt-1 text-[9px] text-landing-muted opacity-90">API keys · read + trade scopes</p>
          <span className="mt-2 inline-block rounded-full bg-landing-accent/20 px-2 py-0.5 text-[9px] font-medium text-landing-accent">
            Supported first
          </span>
        </div>
        <p className="text-center text-[9px] text-landing-muted opacity-90">Additional exchanges later.</p>
      </div>
    </ScreenChrome>
  );
}

const SCREENS = [
  { title: 'Signal feed', subtitle: 'Scan ranked ideas at a glance.', node: <SignalFeedMock /> },
  { title: 'Trade setup', subtitle: 'One screen for the full thesis.', node: <TradeSetupMock /> },
  { title: 'Position / risk', subtitle: 'Clarity before you size up.', node: <PositionRiskMock /> },
  {
    title: 'Exchange link',
    subtitle: 'Connect where you actually trade.',
    node: <ExchangeConnectMock />,
  },
] as const;

const ROTATE = [-2, 0, 2, 1] as const;
const BASE_SCALE = [1, 1.05, 1, 1] as const;

export function LandingAppScreens() {
  return (
    <section
      id={LANDING_SECTIONS.screens}
      className="scroll-mt-24 bg-landing-bg px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-32"
    >
      <div className="mx-auto max-w-6xl">
        <ScrollReveal>
          <h2 className="text-[1.65rem] font-semibold tracking-tight text-landing-text sm:text-[1.875rem] lg:text-[2.125rem]">
            See Sigflo in action
          </h2>
          <p className="mt-4 max-w-xl text-landing-muted opacity-[0.86]">
            A calm trading UI that respects your attention — mock previews below.
          </p>
        </ScrollReveal>

        <div className="mt-16 grid items-end gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6 lg:pt-4">
          {SCREENS.map((s, i) => {
            const r = ROTATE[i] ?? 0;
            const sc = BASE_SCALE[i] ?? 1;
            return (
              <div key={s.title} className={`[perspective:880px] ${i === 1 ? 'lg:z-10' : ''}`}>
                <div className="relative">
                  <div
                    className="pointer-events-none absolute left-1/2 top-[42%] h-[85%] w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-[1.25rem] blur-2xl"
                    style={{
                      background: 'radial-gradient(ellipse at center, rgba(0,200,120,0.12) 0%, transparent 68%)',
                    }}
                    aria-hidden
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 22, rotate: r, scale: sc }}
                    whileInView={{ opacity: 1, y: 0, rotate: r, scale: sc }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ duration: 0.42, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] }}
                    whileHover={{
                      rotate: 0,
                      y: -12,
                      scale: sc * 1.02,
                      boxShadow:
                        '0 24px 56px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(0, 200, 120, 0.18), 0 0 48px -12px rgba(0, 200, 120, 0.2)',
                      transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
                    }}
                    style={{ transformOrigin: 'center bottom' }}
                    className="relative flex h-full flex-col rounded-2xl border border-white/[0.1] bg-landing-card p-4 shadow-landing-card-strong"
                  >
                    <div className="pointer-events-none mb-3 aspect-[10/16] max-h-[280px] w-full overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
                      <div className="h-full scale-[0.98]">{s.node}</div>
                    </div>
                    <h3 className="text-sm font-semibold text-landing-text">{s.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-landing-muted opacity-90">{s.subtitle}</p>
                  </motion.div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
