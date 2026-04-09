'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PeakHourPoint } from './types';

type PeakHoursChartProps = {
  data: PeakHourPoint[];
};

function formatHourLabel(hour: number) {
  const normalized = hour % 24;
  const suffix = normalized >= 12 ? 'PM' : 'AM';
  const hour12 = normalized % 12 || 12;
  return `${hour12} ${suffix}`;
}

function barColor(intensity: number) {
  if (intensity >= 0.8) {
    return '#0891b2';
  }

  if (intensity >= 0.6) {
    return '#06b6d4';
  }

  if (intensity >= 0.4) {
    return '#22d3ee';
  }

  if (intensity >= 0.2) {
    return '#67e8f9';
  }

  return '#a5f3fc';
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

export function PeakHoursChart({ data }: PeakHoursChartProps) {
  const maxCount = data.reduce((max, item) => Math.max(max, item.count), 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Peak Hours</h2>
        <p className="text-sm text-gray-600">Hourly call load in UTC to identify coverage windows.</p>
      </div>

      {maxCount === 0 ? (
        <p className="text-sm text-gray-600">No peak-hour data yet for this period.</p>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickFormatter={(value) => (Number(value) % 3 === 0 ? formatHourLabel(Number(value)) : '')}
                interval={0}
                minTickGap={8}
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
                labelFormatter={(value) => formatHourLabel(Number(value))}
                formatter={(value) => [tooltipValue(value), 'Calls']}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.map((entry) => {
                  const intensity = maxCount > 0 ? entry.count / maxCount : 0;
                  return <Cell key={entry.hour} fill={barColor(intensity)} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
