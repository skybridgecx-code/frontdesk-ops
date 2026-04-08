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
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-md bg-indigo-50 p-2 text-indigo-600">{icon}</div>
        <span className="text-xs text-gray-400">{trend ?? 'Trend data soon'}</span>
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight text-gray-900">{value}</div>
      <p className="mt-1 text-sm text-gray-600">{label}</p>
    </Card>
  );
}
