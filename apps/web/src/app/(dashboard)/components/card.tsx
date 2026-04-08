import type { ReactNode } from 'react';

type CardProps = {
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function Card({ title, subtitle, footer, className, children }: CardProps) {
  const classes = ['rounded-lg border border-gray-200 bg-white p-6 shadow-sm', className]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={classes}>
      {title || subtitle ? (
        <header className="mb-5">
          {title ? <h2 className="text-lg font-semibold text-gray-900">{title}</h2> : null}
          {subtitle ? <p className="mt-1 text-sm text-gray-600">{subtitle}</p> : null}
        </header>
      ) : null}

      {children}

      {footer ? <footer className="mt-6 border-t border-gray-200 pt-4">{footer}</footer> : null}
    </section>
  );
}
