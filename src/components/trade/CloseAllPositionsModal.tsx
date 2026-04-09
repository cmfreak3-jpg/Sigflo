import { AnimatePresence, motion } from 'framer-motion';

export type CloseAllPositionsModalProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** When true, Long/Short / Close use the Bybit API via Sigflo. */
  exchangeExecution?: boolean;
};

export function CloseAllPositionsModal({
  open,
  onCancel,
  onConfirm,
  exchangeExecution = true,
}: CloseAllPositionsModalProps) {
  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="close-all-backdrop"
            role="presentation"
            className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="close-all-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="close-all-title"
            className="fixed left-1/2 top-1/2 z-[71] w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-rose-400/35 bg-[#0c0c0e] p-4 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.06]"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
          >
            <h2 id="close-all-title" className="text-base font-bold text-rose-100">
              Close all positions?
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-sigflo-muted">
              {exchangeExecution ? (
                <>
                  Close all sends <span className="font-semibold text-sigflo-text/90">real orders on Bybit</span> for the
                  positions shown (reduce-only market exits on perps; market sells on spot) using your linked API keys.
                  Confirm fills and size in Bybit or Portfolio.
                </>
              ) : (
                <>
                  Connect Bybit in Account to send closes from Sigflo. Until then, this button cannot submit exchange
                  orders — manage the position on Bybit directly.
                </>
              )}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="min-h-[44px] flex-1 rounded-xl border border-white/[0.12] bg-white/[0.05] py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="min-h-[44px] flex-1 rounded-xl bg-gradient-to-b from-rose-600 to-rose-700 py-2.5 text-sm font-bold text-white shadow-[0_0_18px_-6px_rgba(248,113,113,0.55)] transition hover:brightness-110"
              >
                Close all
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
