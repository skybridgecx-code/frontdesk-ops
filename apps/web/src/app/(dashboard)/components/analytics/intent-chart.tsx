'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { IntentPoint } from './types';

type IntentChartProps = {
  data: IntentPoint[];
};

const COLORS = ['#6366F1','#8B5CF6','#06B6D4','#10B981','#F59E0B','#EF4444','#3B82F6','#EC4899','#14B8A6','#F97316'];

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

export function IntentChart({ data }: IntentChartProps) {
  const total = data.reduce((s, i) => s + i.count, 0);

  return (
    <div style={CARD_STYLE}>
      <div className="mb-5">
        <h2
          className="text-base font-semibold"
          style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
        >
          Intent Breakdown
        </h2>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          What callers are asking for most often
        </p>
      </div>

      {data.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
          No data yet for this period.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-[200px_1fr] sm:items-center">
          {/* Donut chart */}
          <div className="relative mx-auto h-48 w-full max-w-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="intent"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {data.map((item, idx) => (
                    <Cell key={item.intent} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background:   'var(--surface)',
                    border:       '1px solid var(--border)',
                    borderRadius: 10,
                    boxShadow:    'var(--shadow-lg)',
                    fontSize:     13,
                  }}
                  formatter={(v, n) => [tooltipValue(v), String(n)]}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Centre label */}
            <div
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
            >
              <span
                className="text-2xl font-semibold"
                style={{ color: 'var(--text-primary)', letterSpacing: '-0.04em' }}
              >
                {total}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                calls
              </span>
            </div>
          </div>

          {/* Legend list */}
          <ul className="space-y-1.5">
            {data.map((item, idx) => (
              <li
                key={item.intent}
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors"
                style={{ border: '1px solid var(--border)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <span
                  className="inline-flex min-w-0 items-center gap-2 text-sm"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: COLORS[idx % COLORS.length] }}
                  />
                  <span className="truncate">{item.intent}</span>
                </span>
                <span
                  className="shrink-0 text-xs font-semibold tabular-nums"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {item.count}{' '}
                  <span style={{ color: 'var(--text-tertiary)' }}>({item.percentage}%)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
