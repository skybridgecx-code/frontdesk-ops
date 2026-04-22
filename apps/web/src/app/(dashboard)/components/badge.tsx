import type { ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const variantClasses: Record<BadgeVariant, string> = {
  default: 'border-white/10 bg-white/5 text-[#c8d8e8]',
  success: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  warning: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  danger: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
  info: 'border-[#00d4ff]/25 bg-[#00d4ff]/10 text-[#00d4ff]'
};

export function Badge({
  children,
  variant = 'default',
  className
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  const classes = [
    'inline-flex max-w-full items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-sm font-medium leading-5 sm:text-xs',
    variantClasses[variant],
    className
  ]
    .filter(Boolean)
    .join(' ');

  return <span className={classes}>{children}</span>;
}
