import { motion } from 'framer-motion';

function MiniChart() {
  const points =
    '0,42 12,38 24,40 36,32 48,28 60,22 72,26 84,18 96,14 108,20 120,12 132,8 144,14 156,6 168,10 180,4 192,8 200,2';
  return (
    <svg viewBox="0 0 200 48" className="h-14 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="heroChartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(0, 200, 120)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="rgb(0, 200, 120)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke="rgb(0, 200, 120)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        vectorEffect="non-scaling-stroke"
      />
      <polygon fill="url(#heroChartFill)" points={`0,48 ${points} 200,48`} />
    </svg>
  );
}

export function HeroTradingPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[340px] lg:max-w-[380px]">
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[min(120%,520px)] w-[min(140%,440px)] -translate-x-1/2 -translate-y-1/2"
        style={{
          background: 'radial-gradient(circle, rgba(0,200,120,0.07) 0%, transparent 72%)',
        }}
        animate={{
          opacity: [0.55, 0.82, 0.55],
          scale: [0.98, 1.02, 0.98],
        }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-landing-card/80 backdrop-blur-md"
        style={{
          boxShadow:
            'inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 0 0 1px rgba(0, 200, 120, 0.12), 0 28px 88px rgba(0, 0, 0, 0.55), 0 0 48px -20px rgba(157, 0, 255, 0.06)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
          aria-hidden
        />
        <motion.div
          className="relative space-y-3 p-4 sm:p-5"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
            <div>
              <p className="text-sm font-semibold tracking-tight text-landing-text">BTC / USDT</p>
              <p className="text-[11px] text-landing-muted opacity-90">Perpetual · 15m context</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-[rgba(0,200,120,0.28)] bg-[rgba(0,200,120,0.08)] px-2.5 py-1">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-landing-accent opacity-50" />
                <motion.span
                  className="relative inline-flex h-2 w-2 rounded-full bg-landing-accent"
                  animate={{ opacity: [1, 0.35, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                />
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-landing-accent">
                LIVE SIGNAL
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-landing-surface/60 px-3 py-2.5">
            <span className="text-xs text-landing-muted opacity-90">Bias</span>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                Long
              </span>
              <span className="text-sm font-semibold tabular-nums text-landing-text">62%</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-landing-muted opacity-90">Confidence</span>
              <span className="font-medium tabular-nums text-landing-text">78</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-landing-bg">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#00C878] to-landing-accent-hi"
                style={{ width: '78%' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-white/[0.08] bg-landing-bg/80 px-2 py-2">
              <p className="text-[10px] uppercase tracking-wide text-landing-muted opacity-90">Entry</p>
              <p className="mt-0.5 text-xs font-semibold tabular-nums text-landing-text">94,180</p>
            </div>
            <div className="rounded-lg border border-white/[0.08] bg-landing-bg/80 px-2 py-2">
              <p className="text-[10px] uppercase tracking-wide text-landing-muted opacity-90">Stop</p>
              <p className="mt-0.5 text-xs font-semibold tabular-nums text-rose-300/90">93,420</p>
            </div>
            <div className="rounded-lg border border-white/[0.08] bg-landing-bg/80 px-2 py-2">
              <p className="text-[10px] uppercase tracking-wide text-landing-muted opacity-90">Target</p>
              <p className="mt-0.5 text-xs font-semibold tabular-nums text-emerald-300/90">96,050</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-landing-bg/60 px-2 py-1.5">
            <MiniChart />
          </div>

          <p className="text-center text-[10px] leading-relaxed text-landing-muted opacity-90">
            AI context summarizes structure, invalidation, and execution notes — without the noise.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
