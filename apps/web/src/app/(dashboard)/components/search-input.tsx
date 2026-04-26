import type { InputHTMLAttributes } from 'react';

export function SearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="relative block">
      <span
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center"
        style={{ color: 'var(--text-tertiary)' }}
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
          <path
            d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <input
        {...props}
        className={[
          'min-h-10 w-full rounded-lg py-2 pl-9 pr-3 text-sm outline-none transition',
          props.className,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{
          background:  'var(--surface)',
          border:      '1px solid var(--border-mid)',
          color:       'var(--text-primary)',
          boxShadow:   'var(--shadow-xs)',
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--accent)';
          (e.currentTarget as HTMLInputElement).style.boxShadow  = '0 0 0 3px var(--accent-dim)';
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border-mid)';
          (e.currentTarget as HTMLInputElement).style.boxShadow  = 'var(--shadow-xs)';
        }}
      />
    </label>
  );
}
