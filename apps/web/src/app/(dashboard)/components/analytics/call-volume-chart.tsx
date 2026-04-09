'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CallVolumePoint } from './types';

type CallVolumeChartProps = {
  data: CallVolumePoint[];
};

function prettyDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  }).format(new Date(`${value}T00:00:00.000Z`));
}

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

export function CallVolumeChart({ data }: CallVolumeChartProps) {
  const maxTotal = data.reduce((max, point) => Math.max(max, point.total), 0);

  if (data.length === 0 || maxTotal === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Call Volume</h2>
          <p className="text-sm text-gray-600">Answered vs missed call distribution over time.</p>
        </div>
        <p className="text-sm text-gray-600">No call-volume data yet for this period.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Call Volume</h2>
          <p className="text-sm text-gray-600">Answered vs missed call distribution over time.</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" /> Answered
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-400" /> Missed
          </span>
        </div>
      </div>

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickFormatter={prettyDate}
              minTickGap={24}
              axisLine={{ stroke: '#d1d5db' }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={{ stroke: '#d1d5db' }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ borderColor: '#e5e7eb', borderRadius: '0.5rem' }}
              labelFormatter={(value) => prettyDate(String(value))}
              formatter={(value, name) => [tooltipValue(value), String(name) === 'answered' ? 'Answered' : 'Missed']}
            />
            <Bar dataKey="answered" stackId="calls" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            <Bar dataKey="missed" stackId="calls" fill="#fb923c" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
