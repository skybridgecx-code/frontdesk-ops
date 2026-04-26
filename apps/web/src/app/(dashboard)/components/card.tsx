import type { ReactNode } from 'react';

type CardProps = {
  title?:    string;
  subtitle?: string;
  footer?:   ReactNode;
  className?: string;
  children:  ReactNode;
  action?:   ReactNode;
};

export function Card({ title, subtitle, footer, className, children, action }: CardProps) {
  const classes = [
    'sb-card rounded-xl p-5 sm:p-6',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={classes}>
      {(title || subtitle || action) ? (
        <header className="mb-4 flex items-start justify-between gap-3 sm:mb-5">
          <div className="min-w-0">
            {title ? (
              <h2
                className="text-base font-semibold"
                style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
              >
                {title}
              </h2>
            ) : null}
            {subtitle ? (
              <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {subtitle}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}

      {children}

      {footer ? (
        <footer
          className="mt-5 pt-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          {footer}
        </footer>
      ) : null}
    </section>
  );
}
