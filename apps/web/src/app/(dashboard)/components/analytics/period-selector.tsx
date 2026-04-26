'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import type { AnalyticsPeriod } from './types';

type PeriodSelectorProps = {
  period: AnalyticsPeriod;
};

const OPTIONS: Array<{ key: AnalyticsPeriod; label: string }> = [
  { key: '7d',  label: '7D'  },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
];

export function PeriodSelector({ period }: PeriodSelectorProps) {
  const pathname    = usePathname();
  const searchParams = useSearchParams();
  const router      = useRouter();
  const [isPending, startTransition] = useTransition();

  function selectPeriod(next: AnalyticsPeriod) {
    if (next === period) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', next);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div
      className="inline-flex rounded-lg p-1"
      style={{
        background:  'var(--surface)',
        border:      '1px solid var(--border)',
        boxShadow:   'var(--shadow-xs)',
      }}
    >
      {OPTIONS.map((opt) => {
        const active = period === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => selectPeriod(opt.key)}
            disabled={isPending}
            className="min-h-8 rounded-md px-3.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background:    active ? 'var(--accent)'         : 'transparent',
              color:         active ? 'white'                 : 'var(--text-secondary)',
              boxShadow:     active ? '0 1px 4px var(--accent-glow)' : 'none',
              letterSpacing: '-0.01em',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
