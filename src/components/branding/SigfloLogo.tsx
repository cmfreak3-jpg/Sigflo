type SigfloLogoProps = {
  size?: number;
  glowing?: boolean;
  className?: string;
};

const MARK_SRC = `${import.meta.env.BASE_URL}sigflo-mark.png`;

export function SigfloLogo({ size = 30, glowing = false, className = '' }: SigfloLogoProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center ${glowing ? 'drop-shadow-[0_0_14px_rgba(34,211,238,0.35)]' : ''} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <img src={MARK_SRC} alt="" width={size} height={size} className="h-full w-full object-contain" draggable={false} />
    </div>
  );
}
