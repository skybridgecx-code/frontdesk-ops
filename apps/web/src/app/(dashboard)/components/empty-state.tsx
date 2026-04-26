import Link from 'next/link';
import type { ReactNode } from 'react';

type EmptyStateProps = {
  title:        string;
  description:  string;
  icon?:        ReactNode;
  actionLabel?: string;
  actionHref?:  string;
};

export function EmptyState({ title, description, icon, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <div
      className="rounded-xl p-8 text-center sm:p-12"
      style={{
        background:  'var(--surface)',
        border:      '1.5px dashed var(--border-mid)',
        boxShadow:   'var(--shadow-xs)',
      }}
    >
      <div
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
      >
        {icon ?? (
          <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <h3
        className="text-base font-semibold"
        style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
      >
        {title}
      </h3>
      <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
        {description}
      </p>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="btn-accent mt-6 inline-flex min-h-10 items-center justify-center rounded-lg px-5 text-sm font-semibold text-white transition sm:w-auto"
          style={{ background: 'var(--accent)' }}
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
