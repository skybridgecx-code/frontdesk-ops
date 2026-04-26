import type { ReactNode } from 'react';

export function DataTable({
  children,
  className,
}: {
  children:   ReactNode;
  className?: string;
}) {
  return (
    <div
      className={['overflow-hidden rounded-xl', className].filter(Boolean).join(' ')}
      style={{
        background:   'var(--surface)',
        border:       '1px solid var(--border)',
        boxShadow:    'var(--shadow-sm)',
      }}
    >
      <div className="overflow-x-auto">
        <table
          className="min-w-full text-left text-sm"
          style={{ color: 'var(--text-primary)' }}
        >
          {children}
        </table>
      </div>
    </div>
  );
}
