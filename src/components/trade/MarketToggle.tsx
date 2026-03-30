import type { MarketMode } from '@/types/trade';

export function MarketToggle({
  value,
  onChange,
}: {
  value: MarketMode;
  onChange: (m: MarketMode) => void;
}) {
  const options: { id: MarketMode; label: string }[] = [
    { id: 'futures', label: 'Futures' },
    { id: 'spot', label: 'Spot' },
  ];
  return (
    <div
      className="flex rounded-2xl border border-white/10 bg-sigflo-elevated/80 p-1 shadow-inner"
      role="tablist"
      aria-label="Market type"
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
              active
                ? 'bg-gradient-to-r from-emerald-500/25 to-cyan-500/20 text-white shadow-glow-sm'
                : 'text-sigflo-muted hover:text-sigflo-text'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
