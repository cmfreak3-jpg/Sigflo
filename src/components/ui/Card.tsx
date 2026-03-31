import type { HTMLAttributes, ReactNode } from 'react';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Card({ className = '', children, ...rest }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.06] bg-sigflo-surface shadow-card ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
