import { AnimatePresence, motion } from 'framer-motion';
import { ActivePositionCard } from '@/components/trade/ActivePositionCard';
import type { SimulatedActivePosition } from '@/types/activePosition';

type ActivePositionsPanelProps = {
  positions: SimulatedActivePosition[];
  markPrice: number;
  nowMs: number;
  onRequestCloseAllModal: () => void;
  exitAiModeLabel: string;
  exitStrategyLabel: string;
  scenarioSummary: string;
};

export function ActivePositionsPanel({
  positions,
  markPrice,
  nowMs,
  onRequestCloseAllModal,
  exitAiModeLabel,
  exitStrategyLabel,
  scenarioSummary,
}: ActivePositionsPanelProps) {
  if (positions.length === 0) return null;

  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key="active-positions-panel"
        layout
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10, transition: { duration: 0.22 } }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className="border-t border-[#00ffc8]/14 bg-gradient-to-b from-[#00ffc8]/[0.05] to-transparent px-1.5 py-1.5 sm:px-2 sm:py-2"
      >
        <div className="mx-auto flex max-w-lg flex-col gap-1.5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-0.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#7ee8d3] sm:text-[10px]">
                Live trade{positions.length > 1 ? ` · ${positions.length}` : ''}
              </span>
              {positions.length > 1 ? (
                <span className="shrink-0 rounded bg-white/[0.06] px-1 py-px font-mono text-[9px] font-bold tabular-nums text-white/75">
                  {positions.length}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onRequestCloseAllModal}
              className="shrink-0 rounded-md border border-rose-500/35 bg-rose-500/[0.08] px-2 py-1 text-[8px] font-bold uppercase tracking-wide text-rose-200/95 transition hover:bg-rose-500/16 sm:text-[9px]"
            >
              Close all
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <AnimatePresence initial={false}>
              {positions.map((p) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -12, scale: 0.98, transition: { duration: 0.2 } }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                >
                  <ActivePositionCard
                    position={p}
                    markPrice={markPrice}
                    nowMs={nowMs}
                    exitAiModeLabel={exitAiModeLabel}
                    exitStrategyLabel={exitStrategyLabel}
                    scenarioSummary={scenarioSummary}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <p className="px-0.5 text-center text-[8px] leading-snug text-sigflo-muted/85">
            Manage exits from the chart dock below — demo only; confirm on exchange.
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
