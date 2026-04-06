import { motion } from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';
import { formatQuoteNumber, formatQuoteUsd } from '@/lib/formatQuote';
import type { SimulatedActivePosition } from '@/types/activePosition';
import type { TradeSide } from '@/types/trade';

function formatTimeInTrade(openedAtMs: number, nowMs: number): string {
  const s = Math.max(0, Math.floor((nowMs - openedAtMs) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function pnlWithRoe(side: TradeSide, entry: number, mark: number, notionalUsd: number, marginUsd: number) {
  const e = Math.max(1e-12, entry);
  const dir: 1 | -1 = side === 'long' ? 1 : -1;
  const movePct = ((mark - e) / e) * 100 * dir;
  const pnlUsd = notionalUsd * (movePct / 100);
  const m = Math.max(1e-9, marginUsd);
  const roePct = (pnlUsd / m) * 100;
  return { pnlUsd, roePct, movePct };
}

function StatCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border border-white/[0.06] bg-black/35 px-1.5 py-1">
      <p className="truncate text-[7px] font-bold uppercase tracking-[0.1em] text-sigflo-muted">{label}</p>
      <div className="mt-0.5 truncate font-mono text-[10px] font-semibold tabular-nums leading-tight text-white/92 sm:text-[11px]">
        {children}
      </div>
    </div>
  );
}

type ActivePositionCardProps = {
  position: SimulatedActivePosition;
  markPrice: number;
  nowMs: number;
  exitAiModeLabel: string;
  exitStrategyLabel: string;
  scenarioSummary: string;
};

export function ActivePositionCard({
  position,
  markPrice,
  nowMs,
  exitAiModeLabel,
  exitStrategyLabel,
  scenarioSummary,
}: ActivePositionCardProps) {
  const prevPnlRef = useRef<number | null>(null);
  const { pnlUsd, roePct, movePct } = pnlWithRoe(
    position.side,
    position.entryPrice,
    markPrice,
    position.positionNotionalUsd,
    position.marginUsd,
  );

  useEffect(() => {
    prevPnlRef.current = pnlUsd;
  }, [pnlUsd]);

  const prev = prevPnlRef.current;
  const tickUp = prev != null && pnlUsd > prev + 0.01;
  const tickDown = prev != null && pnlUsd < prev - 0.01;
  const pnlPositive = pnlUsd >= 0;
  const pnlClass = pnlPositive ? 'text-emerald-300' : 'text-rose-300';
  const glowClass = tickUp
    ? 'shadow-[0_0_18px_-6px_rgba(52,211,153,0.4)]'
    : tickDown
      ? 'shadow-[0_0_18px_-6px_rgba(248,113,113,0.35)]'
      : pnlPositive
        ? 'shadow-[0_0_14px_-8px_rgba(52,211,153,0.18)]'
        : 'shadow-[0_0_14px_-8px_rgba(248,113,113,0.16)]';

  const nearStop =
    position.stopLossPrice != null &&
    Number.isFinite(position.stopLossPrice) &&
    Number.isFinite(markPrice) &&
    Math.abs(markPrice - position.stopLossPrice) / Math.max(markPrice, 1e-9) < 0.004;
  const nearTp =
    position.takeProfitPrice != null &&
    Number.isFinite(position.takeProfitPrice) &&
    Number.isFinite(markPrice) &&
    Math.abs(markPrice - position.takeProfitPrice) / Math.max(markPrice, 1e-9) < 0.004;
  const levelGlow = nearStop ? 'ring-1 ring-rose-400/25' : nearTp ? 'ring-1 ring-emerald-400/25' : '';

  const liveBadge =
    position.side === 'long' ? (
      <span className="inline-flex shrink-0 items-center gap-0.5 rounded border border-emerald-400/35 bg-emerald-500/[0.1] px-1 py-px text-[7px] font-extrabold uppercase tracking-wide text-emerald-200">
        <span className="relative flex h-1 w-1">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/45 opacity-50" />
          <span className="relative inline-flex h-1 w-1 rounded-full bg-emerald-400" />
        </span>
        Long
      </span>
    ) : (
      <span className="inline-flex shrink-0 items-center gap-0.5 rounded border border-rose-400/35 bg-rose-500/[0.1] px-1 py-px text-[7px] font-extrabold uppercase tracking-wide text-rose-200">
        <span className="relative flex h-1 w-1">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400/40 opacity-50" />
          <span className="relative inline-flex h-1 w-1 rounded-full bg-rose-400" />
        </span>
        Short
      </span>
    );

  return (
    <div
      className={`rounded-xl border border-[#00ffc8]/18 bg-gradient-to-b from-black/85 to-black/92 p-2 ring-1 ring-white/[0.05] transition-shadow duration-300 sm:p-2.5 ${glowClass} ${levelGlow}`}
      role="region"
      aria-label={`Active position ${position.symbol} ${position.side}`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-white/[0.07] pb-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <h3 className="truncate text-xs font-bold tracking-tight text-white sm:text-[13px]">{position.symbol}</h3>
          {liveBadge}
        </div>
        <p className="shrink-0 text-right text-[8px] font-medium tabular-nums text-sigflo-muted">
          {position.market === 'futures' ? `${position.leverage}x` : 'Spot'}
        </p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 py-2">
        <div className="min-w-0">
          <p className="text-[7px] font-bold uppercase tracking-[0.14em] text-sigflo-muted">Unrealized</p>
          <motion.p
            key={Math.round(pnlUsd * 100) / 100}
            initial={{ opacity: 0.88 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
            className={`truncate font-mono text-xl font-bold tabular-nums tracking-tight sm:text-2xl ${pnlClass}`}
          >
            {pnlUsd >= 0 ? '+' : '−'}${formatQuoteNumber(Math.abs(pnlUsd))}
          </motion.p>
        </div>
        <div className="grid shrink-0 grid-rows-2 justify-items-end gap-0.5 text-right">
          <span className={`font-mono text-[11px] font-bold tabular-nums leading-none ${pnlClass}`}>
            {roePct >= 0 ? '+' : ''}
            {roePct.toFixed(1)}% <span className="text-[8px] font-semibold text-sigflo-muted">ROE</span>
          </span>
          <span className={`font-mono text-[9px] font-medium tabular-nums ${pnlClass}`}>
            {movePct >= 0 ? '+' : ''}
            {movePct.toFixed(2)}% <span className="text-sigflo-muted">PnL</span>
          </span>
        </div>
      </div>

      <div className="mb-1.5 rounded-lg border border-white/[0.06] bg-black/30 px-2 py-1.5">
        <p className="text-[7px] font-extrabold uppercase tracking-[0.12em] text-sigflo-muted">Exit & scenario</p>
        <p className="mt-0.5 text-[10px] font-semibold leading-snug text-white/90">
          <span className="text-cyan-200/90">{exitAiModeLabel}</span>
          <span className="text-sigflo-muted"> · </span>
          <span className="text-white/85">{exitStrategyLabel}</span>
        </p>
        <p className="mt-0.5 text-[9px] leading-snug text-sigflo-muted">{scenarioSummary}</p>
      </div>

      <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 sm:gap-1.5">
        <StatCell label="Entry">{formatQuoteUsd(position.entryPrice)}</StatCell>
        <StatCell label="Mark">{formatQuoteUsd(markPrice)}</StatCell>
        <StatCell label="Size">${formatQuoteNumber(position.positionNotionalUsd)}</StatCell>
        <StatCell label="Margin">${formatQuoteNumber(position.marginUsd)}</StatCell>
        <StatCell label="Liq">
          {position.liquidationPrice != null && Number.isFinite(position.liquidationPrice)
            ? formatQuoteUsd(position.liquidationPrice)
            : '—'}
        </StatCell>
        <StatCell label="Time">{formatTimeInTrade(position.openedAtMs, nowMs)}</StatCell>
        <StatCell label="Stop">{position.stopLossPrice != null ? formatQuoteUsd(position.stopLossPrice) : '—'}</StatCell>
        <StatCell label="TP">{position.takeProfitPrice != null ? formatQuoteUsd(position.takeProfitPrice) : '—'}</StatCell>
      </div>
    </div>
  );
}
