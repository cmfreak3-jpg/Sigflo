export function SetupToggle({ isActive, onToggle }: { isActive: boolean; onToggle: () => void }) {
  return (
    <div
      className="inline-flex items-stretch rounded border border-white/[0.07] bg-black/40 p-px shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]"
      role="group"
      aria-label="Chart overlay mode"
    >
      <button
        type="button"
        role="radio"
        aria-checked={!isActive}
        onClick={() => {
          if (isActive) onToggle();
        }}
        className={`flex h-[16px] items-center justify-center rounded-[3px] px-1.5 py-0 text-[7px] font-bold uppercase leading-none tracking-[0.1em] transition sm:h-[17px] sm:px-2 sm:text-[8px] ${
          !isActive
            ? 'bg-white/[0.1] text-white shadow-[0_0_8px_-4px_rgba(255,255,255,0.1)]'
            : 'text-sigflo-muted hover:text-sigflo-text'
        }`}
      >
        Clean
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={isActive}
        onClick={() => {
          if (!isActive) onToggle();
        }}
        className={`flex h-[16px] items-center justify-center rounded-[3px] px-1.5 py-0 text-[7px] font-bold uppercase leading-none tracking-[0.1em] transition sm:h-[17px] sm:px-2 sm:text-[8px] ${
          isActive
            ? 'bg-[rgba(0,255,200,0.1)] text-[#a8f5e8] ring-1 ring-[rgba(0,255,200,0.18)]'
            : 'text-sigflo-muted hover:text-sigflo-text'
        }`}
      >
        Setup
      </button>
    </div>
  );
}

/** Alias for product spec naming (`SetupModeToggle`). */
export const SetupModeToggle = SetupToggle;
