export function LandingBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-landing-bg" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse 85% 65% at 50% 0%, black 18%, transparent 72%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 85% 65% at 50% 0%, black 18%, transparent 72%)',
        }}
      />
      <div className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-landing-accent/[0.04] blur-[100px]" />
      <div className="absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-cyan-500/[0.04] blur-[90px]" />
      <div className="absolute bottom-0 left-1/2 h-72 w-[120%] -translate-x-1/2 bg-gradient-to-t from-landing-mid/90 to-transparent" />
    </div>
  );
}
