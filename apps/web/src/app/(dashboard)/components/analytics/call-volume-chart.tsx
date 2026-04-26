'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CallVolumePoint } from './types';

type CallVolumeChartProps = {
  data: CallVolumePoint[];
};

function prettyDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    new Date(`${value}T00:00:00.000Z`)
  );
}

function tooltipValue(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') { const p = Number(value); return Number.isFinite(p) ? p : 0; }
  if (Array.isArray(value) && value.length > 0) return tooltipValue(value[0]);
  return 0;
}

const CARD_STYLE = {
  background: 'var(--surface)',
  border:     '1px solid var(--border)',
  borderRadius: 14,
  boxShadow:  'var(--shadow-sm)',
  padding:    '1.25rem',
};

export function CallVolumeChart({ data }: CallVolumeChartProps) {
  const maxTotal = data.reduce((m, p) => Math.max(m, p.total), 0);

  return (
    <div style={CARD_STYLE}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            className="text-base font-semibold"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
          >
            Call Volume
          </h2>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Answered vs missed over time
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#6366F1' }} />
            Answered
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#F97316' }} />
            Missed
          </span>
        </div>
      </div>

      {data.length === 0 || maxTotal === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
          No call-volume data yet for this period.
        </p>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                tickFormatter={prettyDate}
                minTickGap={24}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background:   'var(--surface)',
                  border:       '1px solid var(--border)',
                  borderRadius: 10,
                  boxShadow:    'var(--shadow-lg)',
                  fontSize:     13,
                }}
                labelFormatter={(v) => prettyDate(String(v))}
                formatter={(v, n) => [tooltipValue(v), String(n) === 'answered' ? 'Answered' : 'Missed']}
              />
              <Bar dataKey="answered" stackId="calls" fill="#6366F1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="missed"   stackId="calls" fill="#F97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
