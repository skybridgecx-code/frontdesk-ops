'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import type { AnalyticsPeriod } from './types';

type PeriodSelectorProps = {
  period: AnalyticsPeriod;
};

const OPTIONS: Array<{ key: AnalyticsPeriod; label: string }> = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' }
];

export function PeriodSelector({ period }: PeriodSelectorProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function selectPeriod(nextPeriod: AnalyticsPeriod) {
    if (nextPeriod === period) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set('period', nextPeriod);

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
      {OPTIONS.map((option) => {
        const isActive = period === option.key;

        return (
          <button
            key={option.key}
            type="button"
            onClick={() => selectPeriod(option.key)}
            disabled={isPending}
            className={`min-h-11 rounded-md px-3 text-sm font-semibold transition sm:px-4 ${
              isActive
                ? 'bg-indigo-600 text-white'
                : 'text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
