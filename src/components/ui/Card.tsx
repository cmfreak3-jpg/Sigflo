import type { HTMLAttributes, ReactNode } from 'react';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Card({ className = '', children, ...rest }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-sigflo-border bg-sigflo-surface/90 shadow-card backdrop-blur-sm ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
