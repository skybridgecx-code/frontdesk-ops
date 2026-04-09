import type { ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const variantClasses: Record<BadgeVariant, string> = {
  default: 'border-gray-200 bg-gray-100 text-gray-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  info: 'border-sky-200 bg-sky-50 text-sky-700'
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
