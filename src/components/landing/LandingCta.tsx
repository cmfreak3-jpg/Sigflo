import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import type { ButtonHTMLAttributes } from 'react';

const primaryBase =
  'rounded-xl bg-gradient-to-b from-[#00C878] to-[#21F0C3] text-sm font-semibold text-[#06130d] outline-none ring-2 ring-transparent focus-visible:ring-[rgba(0,200,120,0.45)]';

const idleShadowPulse = {
  boxShadow: [
    '0 0 20px rgba(0, 200, 120, 0.22)',
    '0 0 32px rgba(0, 232, 150, 0.44)',
    '0 0 20px rgba(0, 200, 120, 0.22)',
  ] as string[],
};

const primaryShadow = { boxShadow: '0 0 20px rgba(0, 200, 120, 0.25)' } as const;

type PrimaryProps = HTMLMotionProps<'button'> & {
  /** Subtle ~3s glow pulse when not hovered (system feedback). */
  pulseIdle?: boolean;
};

export function LandingPrimaryCta({
  className = '',
  style,
  type = 'button',
  pulseIdle = false,
  ...props
}: PrimaryProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      type={type}
      className={`${primaryBase} ${className}`.trim()}
      style={{ ...primaryShadow, ...style }}
      animate={reduceMotion || !pulseIdle ? undefined : idleShadowPulse}
      transition={
        pulseIdle && !reduceMotion
          ? { duration: 3, repeat: Infinity, ease: 'easeInOut' }
          : { type: 'tween', duration: 0.2, ease: [0.22, 1, 0.36, 1] }
      }
      whileHover={{
        scale: 1.03,
        boxShadow: '0 0 28px rgba(0, 232, 150, 0.42)',
      }}
      whileTap={{ scale: 0.99 }}
      {...props}
    />
  );
}

const secondaryBase =
  'rounded-xl border border-white/[0.14] bg-landing-surface/45 px-6 py-3 text-sm font-semibold text-landing-text backdrop-blur-sm outline-none ring-white/10 transition-[border-color,background-color,box-shadow,transform] duration-200 hover:scale-[1.02] hover:border-white/[0.22] hover:bg-landing-card hover:shadow-[0_8px_32px_rgba(0,0,0,0.45)] active:scale-[0.99] focus-visible:ring-2 motion-reduce:hover:scale-100 motion-reduce:active:scale-100';

type SecondaryProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function LandingSecondaryCta({ className = '', ...props }: SecondaryProps) {
  return <button type="button" className={`${secondaryBase} ${className}`.trim()} {...props} />;
}
