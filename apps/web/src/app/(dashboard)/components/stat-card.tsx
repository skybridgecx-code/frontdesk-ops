import type { ReactNode } from 'react';

export function StatCard({
  label,
  value,
  icon,
  trend,
  accentColor,
}: {
  label:        string;
  value:        string;
  icon:         ReactNode;
  trend?:       string;
  accentColor?: string;
}) {
  const color = accentColor ?? 'var(--accent)';
  const bg    = accentColor ? `${accentColor}18` : 'var(--accent-dim)';

  return (
    <div
      className="sb-card sb-card-lift rounded-xl p-5 transition-all"
      style={{ animationFillMode: 'both' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ background: bg, color }}
        >
          {icon}
        </div>
        {trend ? (
          <span
            className="rounded-md px-2 py-0.5 text-xs font-medium"
            style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
          >
            {trend}
          </span>
        ) : null}
      </div>
      <div
        className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl"
        style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}
      >
        {value}
      </div>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</p>
    </div>
  );
}
