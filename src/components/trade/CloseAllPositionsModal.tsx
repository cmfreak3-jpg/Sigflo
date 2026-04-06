import { AnimatePresence, motion } from 'framer-motion';

export type CloseAllPositionsModalProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function CloseAllPositionsModal({ open, onCancel, onConfirm }: CloseAllPositionsModalProps) {
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
              This will clear every active (demo) position on this screen. Sigflo does not send orders to your exchange —
              confirm on the venue for real exits.
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
