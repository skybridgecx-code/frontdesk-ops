'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { IntentPoint } from './types';

type IntentChartProps = {
  data: IntentPoint[];
};

const COLORS = ['#06b6d4', '#7c3aed', '#f97316', '#14b8a6', '#ef4444', '#0ea5e9', '#a855f7', '#10b981', '#f59e0b', '#6366f1', '#64748b'];

function tooltipValue(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (Array.isArray(value) && value.length > 0) {
    return tooltipValue(value[0]);
  }

  return 0;
}

export function IntentChart({ data }: IntentChartProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Intent Breakdown</h2>
        <p className="text-sm text-gray-600">What callers are asking for most often.</p>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-gray-600">No data yet.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-[240px_1fr] sm:items-center">
          <div className="mx-auto h-56 w-full max-w-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="count" nameKey="intent" innerRadius={58} outerRadius={90} paddingAngle={2}>
                  {data.map((item, index) => (
                    <Cell key={item.intent} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderColor: '#e5e7eb', borderRadius: '0.5rem' }}
                  formatter={(value, name) => [tooltipValue(value), String(name)]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="-mt-24 text-center">
              <p className="text-2xl font-semibold text-gray-900">{total}</p>
              <p className="text-xs text-gray-500">Calls</p>
            </div>
          </div>

          <ul className="space-y-2">
            {data.map((item, index) => (
              <li key={item.intent} className="flex items-center justify-between gap-3 rounded-md border border-gray-100 px-3 py-2">
                <span className="inline-flex min-w-0 items-center gap-2 text-sm text-gray-700">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="truncate">{item.intent}</span>
                </span>
                <span className="shrink-0 text-sm font-medium text-gray-900">{item.count} ({item.percentage}%)</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
