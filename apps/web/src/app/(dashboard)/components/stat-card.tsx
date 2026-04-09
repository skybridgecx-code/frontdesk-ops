import type { ReactNode } from 'react';
import { Card } from './card';

export function StatCard({
  label,
  value,
  icon,
  trend
}: {
  label: string;
  value: string;
  icon: ReactNode;
  trend?: string;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-md bg-indigo-50 p-2 text-indigo-600">{icon}</div>
        <span className="text-sm text-gray-400 sm:text-xs">{trend ?? 'Trend data soon'}</span>
      </div>
      <div className="mt-4 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">{value}</div>
      <p className="mt-1 text-sm text-gray-600">{label}</p>
    </Card>
  );
}
