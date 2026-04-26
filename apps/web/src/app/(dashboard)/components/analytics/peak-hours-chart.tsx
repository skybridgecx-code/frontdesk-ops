'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PeakHourPoint } from './types';

type PeakHoursChartProps = {
  data: PeakHourPoint[];
};

function formatHourLabel(hour: number) {
  const n  = hour % 24;
  const h12 = n % 12 || 12;
  return `${h12}${n >= 12 ? 'p' : 'a'}`;
}

function barColor(intensity: number) {
  if (intensity >= 0.8) return '#4F46E5';
  if (intensity >= 0.6) return '#6366F1';
  if (intensity >= 0.4) return '#818CF8';
  if (intensity >= 0.2) return '#A5B4FC';
  return '#C7D2FE';
}

function tooltipValue(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') { const p = Number(value); return Number.isFinite(p) ? p : 0; }
  if (Array.isArray(value) && value.length > 0) return tooltipValue(value[0]);
  return 0;
}

const CARD_STYLE = {
  background:   'var(--surface)',
  border:       '1px solid var(--border)',
  borderRadius: 14,
  boxShadow:    'var(--shadow-sm)',
  padding:      '1.25rem',
};

export function PeakHoursChart({ data }: PeakHoursChartProps) {
  const maxCount = data.reduce((m, i) => Math.max(m, i.count), 0);

  return (
    <div style={CARD_STYLE}>
      <div className="mb-5">
        <h2
          className="text-base font-semibold"
          style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
        >
          Peak Hours
        </h2>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Hourly call load (UTC) — identify coverage windows
        </p>
      </div>

      {maxCount === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
          No peak-hour data yet for this period.
        </p>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                tickFormatter={(v) => (Number(v) % 4 === 0 ? formatHourLabel(Number(v)) : '')}
                interval={0}
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
                labelFormatter={(v) => formatHourLabel(Number(v))}
                formatter={(v) => [tooltipValue(v), 'Calls']}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.map((entry) => (
                  <Cell
                    key={entry.hour}
                    fill={barColor(maxCount > 0 ? entry.count / maxCount : 0)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
