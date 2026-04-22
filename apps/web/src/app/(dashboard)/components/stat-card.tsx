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
        <div className="rounded-md bg-[#00d4ff]/10 p-2 text-[#00d4ff]">{icon}</div>
        <span className="text-sm text-[#5a6a80] sm:text-xs">{trend ?? 'Trend data soon'}</span>
      </div>
      <div className="mt-4 text-2xl font-semibold tracking-tight text-[#f0f4f8] sm:text-3xl">{value}</div>
      <p className="mt-1 text-sm text-[#5a6a80]">{label}</p>
    </Card>
  );
}
