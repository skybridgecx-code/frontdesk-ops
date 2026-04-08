import type { InputHTMLAttributes } from 'react';

export function SearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="relative block">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
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
          'w-full rounded-md border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none transition',
          'placeholder:text-gray-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100',
          props.className
        ]
          .filter(Boolean)
          .join(' ')}
      />
    </label>
  );
}
