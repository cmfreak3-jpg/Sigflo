import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ButtonHTMLAttributes } from 'react';

const primaryBase =
  'rounded-xl bg-gradient-to-b from-[#00C878] to-[#00E08A] text-sm font-semibold text-[#06130d] outline-none ring-2 ring-transparent focus-visible:ring-[rgba(0,200,120,0.45)]';

const primaryShadow = { boxShadow: '0 0 20px rgba(0, 200, 120, 0.25)' } as const;

type PrimaryProps = HTMLMotionProps<'button'>;

export function LandingPrimaryCta({ className = '', style, type = 'button', ...props }: PrimaryProps) {
  return (
    <motion.button
      type={type}
      className={`${primaryBase} ${className}`.trim()}
      style={{ ...primaryShadow, ...style }}
      whileHover={{
        scale: 1.03,
        boxShadow: '0 0 28px rgba(0, 232, 150, 0.42)',
      }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'tween', duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      {...props}
    />
  );
}

const secondaryBase =
  'rounded-xl border border-white/[0.14] bg-landing-surface/45 px-6 py-3 text-sm font-semibold text-landing-text backdrop-blur-sm outline-none ring-white/10 transition-[border-color,background-color,box-shadow] duration-200 hover:border-white/[0.22] hover:bg-landing-card hover:shadow-[0_8px_32px_rgba(0,0,0,0.45)] focus-visible:ring-2';

type SecondaryProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function LandingSecondaryCta({ className = '', ...props }: SecondaryProps) {
  return <button type="button" className={`${secondaryBase} ${className}`.trim()} {...props} />;
}
