import type { ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const variantStyles: Record<BadgeVariant, { background: string; color: string; border: string }> = {
  default: {
    background: 'var(--surface-3)',
    color:      'var(--text-secondary)',
    border:     'var(--border)',
  },
  success: {
    background: 'var(--success-light)',
    color:      '#065F46',
    border:     'rgba(16, 185, 129, 0.2)',
  },
  warning: {
    background: 'var(--warning-light)',
    color:      '#92400E',
    border:     'rgba(245, 158, 11, 0.2)',
  },
  danger: {
    background: 'var(--danger-light)',
    color:      '#991B1B',
    border:     'rgba(239, 68, 68, 0.2)',
  },
  info: {
    background: 'var(--info-light)',
    color:      '#1E40AF',
    border:     'rgba(59, 130, 246, 0.2)',
  },
};

export function Badge({
  children,
  variant = 'default',
  className,
}: {
  children:  ReactNode;
  variant?:  BadgeVariant;
  className?: string;
}) {
  const s = variantStyles[variant];

  return (
    <span
      className={[
        'inline-flex max-w-full items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        background:  s.background,
        color:       s.color,
        borderColor: s.border,
        letterSpacing: '0.01em',
      }}
    >
      {children}
    </span>
  );
}
