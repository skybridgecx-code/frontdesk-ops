'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { UrgencyPoint } from './types';

type UrgencyChartProps = {
  data: UrgencyPoint[];
};

function urgencyColor(value: string) {
  const normalized = value.toLowerCase();

  if (normalized.includes('high') || normalized.includes('emergency')) {
    return '#ef4444';
  }

  if (normalized.includes('medium')) {
    return '#f59e0b';
  }

  if (normalized.includes('low')) {
    return '#10b981';
  }

  return '#64748b';
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

export function UrgencyChart({ data }: UrgencyChartProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Urgency Distribution</h2>
        <p className="text-sm text-gray-600">How urgent incoming requests are classified.</p>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-gray-600">No data yet.</p>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 20, left: 12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#d1d5db' }} />
              <YAxis
                type="category"
                dataKey="urgency"
                width={84}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#d1d5db' }}
              />
              <Tooltip
                contentStyle={{ borderColor: '#e5e7eb', borderRadius: '0.5rem' }}
                formatter={(value, name, item) => {
                  const row = item && typeof item.payload === 'object' && item.payload ? (item.payload as UrgencyPoint) : null;
                  const percentage = row ? row.percentage : 0;
                  return [`${tooltipValue(value)} (${percentage}%)`, String(name)];
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.map((entry) => (
                  <Cell key={entry.urgency} fill={urgencyColor(entry.urgency)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
