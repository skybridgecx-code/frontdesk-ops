import type { ReactNode } from 'react';

type CardProps = {
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function Card({ title, subtitle, footer, className, children }: CardProps) {
  const classes = [
    'rounded-xl border border-white/10 bg-[#0d1320]/88 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.22)] backdrop-blur sm:p-6',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={classes}>
      {title || subtitle ? (
        <header className="mb-4 sm:mb-5">
          {title ? <h2 className="text-lg font-semibold text-[#f0f4f8]">{title}</h2> : null}
          {subtitle ? <p className="mt-1 text-sm text-[#5a6a80]">{subtitle}</p> : null}
        </header>
      ) : null}

      {children}

      {footer ? <footer className="mt-6 border-t border-white/10 pt-4">{footer}</footer> : null}
    </section>
  );
}
