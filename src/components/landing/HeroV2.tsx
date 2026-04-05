import { motion, useReducedMotion } from 'framer-motion';
import { useId, useMemo } from 'react';
import { LandingPrimaryCta, LandingSecondaryCta } from '@/components/landing/LandingCta';
import { LANDING_SECTIONS } from '@/components/landing/landingSections';

function scrollToLandingSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* —— Background: standalone layers (not shared with legacy hero) —— */

const V2_WAVES = [
  'M-200,140 C160,110 380,170 620,130 S980,150 1260,120 S1620,140 1920,100',
  'M-240,260 C140,230 400,290 660,250 S940,270 1220,240 S1580,260 1960,220',
  'M-180,400 C200,360 420,430 700,390 S1020,410 1300,380 S1660,400 1980,360',
  'M-220,520 C180,490 360,550 640,510 S920,530 1180,500 S1540,520 1940,480',
] as const;

function V2Particle({ seed }: { seed: number }) {
  const reduced = useReducedMotion();
  const s = useMemo(
    () => ({
      left: `${8 + (seed * 37) % 84}%`,
      top: `${12 + (seed * 59) % 76}%`,
      delay: (seed % 7) * 0.45,
      dur: 10 + (seed % 5) * 2.2,
      size: 1 + (seed % 2),
    }),
    [seed],
  );

  if (reduced) {
    return (
      <span
        className="absolute rounded-full bg-teal-400/25"
        style={{ left: s.left, top: s.top, width: s.size, height: s.size }}
        aria-hidden
      />
    );
  }

  return (
    <motion.span
      className="absolute rounded-full bg-white/35"
      style={{ left: s.left, top: s.top, width: s.size, height: s.size }}
      animate={{
        opacity: [0.08, 0.35, 0.14, 0.28, 0.08],
        x: [0, 6, -4, 3, 0],
        y: [0, -10, 4, -6, 0],
      }}
      transition={{ duration: s.dur, repeat: Infinity, ease: 'easeInOut', delay: s.delay }}
      aria-hidden
    />
  );
}

function HeroBackground() {
  const reduced = useReducedMotion();
  const waveId = useId().replace(/:/g, '');

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 90% 65% at 50% -15%, rgba(14, 22, 38, 0.92) 0%, transparent 52%),
            radial-gradient(ellipse 50% 45% at 85% 35%, rgba(0, 180, 110, 0.12) 0%, transparent 55%),
            linear-gradient(170deg, #010203 0%, #060910 40%, #0c1520 100%)
          `,
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(160, 190, 210, 0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(160, 190, 210, 0.22) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse 86% 72% at 48% 44%, black 22%, transparent 94%)',
          WebkitMaskImage: 'radial-gradient(ellipse 86% 72% at 48% 44%, black 22%, transparent 94%)',
        }}
      />
      <svg
        className="absolute inset-0 h-full w-full min-h-[400px]"
        viewBox="0 0 1920 640"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`v2w-${waveId}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00c878" stopOpacity="0" />
            <stop offset="22%" stopColor="#21f0c3" stopOpacity="0.38" />
            <stop offset="55%" stopColor="#00c878" stopOpacity="0.28" />
            <stop offset="78%" stopColor="#21f0c3" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#00c878" stopOpacity="0" />
          </linearGradient>
          <filter id={`v2f-${waveId}`} x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {V2_WAVES.map((d, i) => (
          <motion.g
            key={i}
            filter={`url(#v2f-${waveId})`}
            animate={reduced ? undefined : { x: i % 2 === 0 ? [0, 28, 0, -20, 0] : [0, -24, 0, 18, 0] }}
            transition={{ duration: 18 + i * 4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.7 }}
          >
            <path
              d={d}
              stroke={`url(#v2w-${waveId})`}
              strokeWidth={i === 1 ? 1.9 : 1.35}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              opacity={0.18 + i * 0.04}
            />
          </motion.g>
        ))}
      </svg>
      {Array.from({ length: 36 }, (_, i) => (
        <V2Particle key={i} seed={i} />
      ))}
      <motion.div
        className="absolute right-[-6%] top-[12%] h-[min(78%,520px)] w-[min(48%,420px)] rounded-[50%]"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(0, 200, 120, 0.26) 0%, rgba(33, 240, 195, 0.06) 48%, transparent 72%)',
          filter: 'blur(36px)',
        }}
        animate={reduced ? undefined : { opacity: [0.65, 0.9, 0.7, 0.85, 0.65], scale: [1, 1.03, 0.99, 1.01, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

/* —— Header —— */

function Header() {
  return (
    <header className="relative z-20 border-b border-white/[0.06] bg-[rgba(6,10,16,0.65)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-4 px-4 sm:h-[3.75rem] sm:px-6 lg:px-8">
        <a href="#top" className="text-sm font-semibold tracking-tight text-[#f5f7fa] sm:text-base">
          Sigflo
        </a>
        <nav className="hidden items-center gap-6 text-xs font-medium text-[rgba(245,247,250,0.55)] sm:flex sm:text-[13px]">
          <button
            type="button"
            className="transition-colors hover:text-[#f5f7fa]"
            onClick={() => scrollToLandingSection(LANDING_SECTIONS.features)}
          >
            Features
          </button>
          <button
            type="button"
            className="transition-colors hover:text-[#f5f7fa]"
            onClick={() => scrollToLandingSection(LANDING_SECTIONS.howItWorks)}
          >
            How it works
          </button>
          <button
            type="button"
            className="transition-colors hover:text-[#f5f7fa]"
            onClick={() => scrollToLandingSection(LANDING_SECTIONS.screens)}
          >
            Screens
          </button>
          <button
            type="button"
            className="transition-colors hover:text-[#f5f7fa]"
            onClick={() => scrollToLandingSection(LANDING_SECTIONS.faq)}
          >
            FAQ
          </button>
        </nav>
        <button
          type="button"
          className="rounded-lg border border-[rgba(130,170,190,0.25)] bg-[rgba(12,18,26,0.6)] px-3 py-1.5 text-xs font-medium text-[#f5f7fa] backdrop-blur-sm transition hover:border-[rgba(130,170,190,0.4)] sm:px-4 sm:text-sm"
          onClick={() => scrollToLandingSection(LANDING_SECTIONS.joinWaitlist)}
        >
          Join waitlist
        </button>
      </div>
    </header>
  );
}

/* —— Ticker —— */

const V2_TICK = [
  { pair: 'BTC · USDT', side: 'LONG' as const, conf: '71%' },
  { pair: 'ETH · USDT', side: 'SHORT' as const, conf: '66%' },
  { pair: 'SOL · USDT', side: 'LONG' as const, conf: '63%' },
] as const;

function LiveTicker() {
  const reduced = useReducedMotion();
  const loop = [...V2_TICK, ...V2_TICK, ...V2_TICK];

  return (
    <div className="relative z-[1] mx-auto w-full max-w-[1280px] px-4 pt-3 sm:px-6 sm:pt-4 lg:px-8">
      <div className="overflow-hidden rounded-md border border-[rgba(130,170,190,0.14)] bg-[rgba(8,12,18,0.5)] py-2 backdrop-blur-md">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-10 bg-gradient-to-r from-[#070b10] to-transparent sm:w-14" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-10 bg-gradient-to-l from-[#070b10] to-transparent sm:w-14" />
          {reduced ? (
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-1 px-2 py-0.5">
              {V2_TICK.map((t) => (
                <span
                  key={t.pair}
                  className="inline-flex items-center gap-2 whitespace-nowrap text-[10px] uppercase tracking-[0.18em] text-[rgba(245,247,250,0.75)] sm:text-[11px]"
                >
                  <span className="font-medium text-[#f5f7fa]">{t.pair}</span>
                  <span className="text-[rgba(245,247,250,0.3)]">·</span>
                  <span className={t.side === 'LONG' ? 'font-semibold text-[#21f0c3]' : 'font-semibold text-rose-400/90'}>
                    {t.side}
                  </span>
                  <span className="text-[rgba(245,247,250,0.3)]">·</span>
                  <span className="tabular-nums text-[#00c878]">{t.conf}</span>
                </span>
              ))}
            </div>
          ) : (
            <motion.div
              className="flex w-max gap-0"
              animate={{ x: ['0%', '-33.333%'] }}
              transition={{ duration: 38, repeat: Infinity, ease: 'linear' }}
            >
              {loop.map((t, i) => (
                <span
                  key={`${t.pair}-${i}`}
                  className="inline-flex items-center gap-2 whitespace-nowrap px-6 text-[10px] uppercase tracking-[0.18em] text-[rgba(245,247,250,0.75)] sm:px-8 sm:text-[11px]"
                >
                  <span className="font-medium text-[#f5f7fa]">{t.pair}</span>
                  <span className="text-[rgba(245,247,250,0.3)]">·</span>
                  <span className={t.side === 'LONG' ? 'font-semibold text-[#21f0c3]' : 'font-semibold text-rose-400/90'}>
                    {t.side}
                  </span>
                  <span className="text-[rgba(245,247,250,0.3)]">·</span>
                  <span className="tabular-nums text-[#00c878]">{t.conf}</span>
                </span>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

/* —— Copy column —— */

function LeftCopy() {
  return (
    <div className="min-w-0 lg:pr-6">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#00c878] sm:mb-4 sm:text-xs">
        Trading signals / AI-assisted
      </p>
      <h1 className="text-[1.75rem] font-semibold leading-[1.12] tracking-tight text-[#f5f7fa] sm:text-[2rem] lg:text-[2.5rem] lg:leading-[1.08]">
        Sigflo — The Smarter Way to Trade
      </h1>
      <p className="mt-4 max-w-[28rem] text-base leading-relaxed text-[rgba(245,247,250,0.7)] sm:mt-5 sm:text-lg">
        AI-assisted signals, cleaner entries, and smarter exits — all in one trading interface.
      </p>
      <div className="mt-7 flex flex-wrap gap-3 sm:mt-8">
        <LandingPrimaryCta
          pulseIdle
          className="px-6 py-3 text-sm sm:px-7 sm:py-3.5 sm:text-[0.9375rem]"
          onClick={() => scrollToLandingSection(LANDING_SECTIONS.joinWaitlist)}
        >
          Join Waitlist
        </LandingPrimaryCta>
        <LandingSecondaryCta
          className="border-[rgba(130,170,190,0.22)] bg-[rgba(10,14,20,0.55)] px-6 py-3 text-sm backdrop-blur-md sm:px-7 sm:py-3.5 sm:text-[0.9375rem]"
          onClick={() => scrollToLandingSection(LANDING_SECTIONS.screens)}
        >
          View Screens
        </LandingSecondaryCta>
      </div>
      <p className="mt-6 text-sm text-[rgba(245,247,250,0.52)]">Built for active traders — no hype, no noise.</p>
    </div>
  );
}

/* —— Signal panel —— */

function V2MiniSparkline({ gid }: { gid: string }) {
  const path =
    'M0,40 L28,34 L56,38 L84,24 L112,18 L140,22 L168,12 L196,8 L224,14 L252,6 L280,10 L308,4 L336,8';
  return (
    <svg viewBox="0 0 336 44" className="h-full w-full min-h-[96px]" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`v2sfill-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#21f0c3" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#00c878" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1="42" x2="336" y2="42" stroke="rgba(130,170,190,0.12)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      <path
        d={`${path} L336,44 L0,44 Z`}
        fill={`url(#v2sfill-${gid})`}
        opacity={0.9}
      />
      <path
        d={path}
        fill="none"
        stroke="#21f0c3"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.85}
        vectorEffect="non-scaling-stroke"
        filter={`drop-shadow(0 0 6px rgba(33,240,195,0.35))`}
      />
    </svg>
  );
}

function SignalPanel() {
  const reduced = useReducedMotion();
  const gid = useId().replace(/:/g, '');

  return (
    <aside className="relative w-full max-w-[560px] justify-self-end lg:max-w-[600px]">
      <motion.div
        animate={reduced ? undefined : { y: [0, -6, 0] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
        className="relative"
      >
        <div
          className="relative flex max-h-[min(52vh,560px)] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-[rgba(130,170,190,0.2)] sm:max-h-[min(56vh,600px)] sm:rounded-3xl sm:min-h-[460px] lg:max-h-[520px] lg:min-h-[480px]"
          style={{
            background: 'linear-gradient(155deg, rgba(16, 24, 34, 0.94) 0%, rgba(8, 11, 16, 0.96) 100%)',
            boxShadow: `
              0 0 0 1px rgba(0, 200, 120, 0.12),
              0 0 64px -10px rgba(33, 240, 195, 0.2),
              0 28px 64px rgba(0, 0, 0, 0.5),
              inset 0 1px 0 rgba(255, 255, 255, 0.05)
            `,
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(245,247,250,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(245,247,250,0.18) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(33,240,195,0.45)] to-transparent" />
          <div className="relative flex min-h-0 flex-1 flex-col p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3 border-b border-[rgba(130,170,190,0.12)] pb-4">
              <div>
                <p className="text-base font-semibold text-[#f5f7fa] sm:text-lg">BTC / USDT</p>
                <p className="mt-0.5 text-[11px] text-[rgba(245,247,250,0.45)]">Perpetual</p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[rgba(0,200,120,0.45)] bg-[rgba(0,200,120,0.1)] px-2.5 py-1.5">
                <span className="relative flex h-2 w-2">
                  {!reduced ? (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#21f0c3] opacity-35" />
                  ) : null}
                  <motion.span
                    className="relative h-2 w-2 rounded-full bg-[#21f0c3] shadow-[0_0_10px_rgba(33,240,195,0.75)]"
                    animate={reduced ? undefined : { opacity: [1, 0.35, 1], scale: [1, 0.88, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </span>
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#21f0c3] sm:text-[10px]">Live</span>
              </div>
            </div>

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-xl border border-[rgba(130,170,190,0.12)] bg-[rgba(4,6,10,0.55)] px-3 py-2.5">
                <dt className="text-[rgba(245,247,250,0.55)]">Bias</dt>
                <dd className="rounded-md bg-[rgba(0,200,120,0.14)] px-2 py-0.5 text-xs font-bold text-[#21f0c3]">LONG</dd>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[rgba(130,170,190,0.12)] bg-[rgba(4,6,10,0.55)] px-3 py-2.5">
                <dt className="text-[rgba(245,247,250,0.55)]">Confidence</dt>
                <dd className="text-base font-semibold tabular-nums text-[#f5f7fa]">72%</dd>
              </div>
            </dl>

            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-[11px] text-[rgba(245,247,250,0.45)]">
                <span>Strength</span>
                <span className="tabular-nums">72 / 100</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(3,5,8,0.9)] ring-1 ring-[rgba(130,170,190,0.08)]">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#00c878] to-[#21f0c3]"
                  initial={{ width: 0 }}
                  animate={{ width: '72%' }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {(
                [
                  { label: 'Entry', value: '34,100', cls: 'text-[#f5f7fa]' },
                  { label: 'Stop', value: '33,420', cls: 'text-rose-300' },
                  { label: 'Target', value: '36,050', cls: 'text-[#21f0c3]' },
                ] as const
              ).map((m) => (
                <div
                  key={m.label}
                  className="rounded-lg border border-[rgba(130,170,190,0.12)] bg-[rgba(4,6,10,0.5)] px-1.5 py-2 text-center sm:rounded-xl sm:py-2.5"
                >
                  <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-[rgba(245,247,250,0.38)] sm:text-[9px]">
                    {m.label}
                  </p>
                  <p className={`mt-1 text-xs font-bold tabular-nums sm:text-sm ${m.cls}`}>{m.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-auto min-h-0 flex-1 pt-4">
              <div className="flex h-full min-h-[100px] flex-col rounded-xl border border-[rgba(130,170,190,0.1)] bg-[rgba(4,6,10,0.45)] p-2 sm:min-h-[112px] sm:p-2.5">
                <p className="mb-1 text-[8px] uppercase tracking-[0.2em] text-[rgba(245,247,250,0.28)] sm:text-[9px]">Price · 15m</p>
                <div className="min-h-0 flex-1">
                  <V2MiniSparkline gid={gid} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </aside>
  );
}

/* —— Public entry —— */

export function HeroV2() {
  return (
    <section
      id="top"
      className="relative flex min-h-[92vh] flex-col overflow-hidden bg-[#05070b] text-[#f5f7fa] antialiased"
    >
      <HeroBackground />
      <Header />
      <LiveTicker />
      <main className="relative z-[1] mx-auto grid w-full max-w-[1280px] flex-1 grid-cols-1 content-center items-center gap-10 px-4 py-8 sm:gap-12 sm:px-6 sm:py-10 lg:grid-cols-[46fr_54fr] lg:gap-8 lg:px-8 lg:py-6">
        <LeftCopy />
        <SignalPanel />
      </main>
    </section>
  );
}
