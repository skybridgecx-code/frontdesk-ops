'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { UrgencyPoint } from './types';

type UrgencyChartProps = {
  data: UrgencyPoint[];
};

function urgencyColor(value: string) {
  const n = value.toLowerCase();
  if (n.includes('high') || n.includes('emergency')) return '#EF4444';
  if (n.includes('medium'))                          return '#F59E0B';
  if (n.includes('low'))                             return '#10B981';
  return '#94A3B8';
}

function urgencyBg(value: string) {
  const n = value.toLowerCase();
  if (n.includes('high') || n.includes('emergency')) return '#FEE2E2';
  if (n.includes('medium'))                          return '#FEF3C7';
  if (n.includes('low'))                             return '#D1FAE5';
  return 'var(--surface-3)';
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

export function UrgencyChart({ data }: UrgencyChartProps) {
  return (
    <div style={CARD_STYLE}>
      <div className="mb-5">
        <h2
          className="text-base font-semibold"
          style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
        >
          Urgency Distribution
        </h2>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          How incoming requests are classified
        </p>
      </div>

      {data.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
          No urgency data yet for this period.
        </p>
      ) : (
        <>
          {/* Visual pill breakdown */}
          <div className="mb-4 flex flex-wrap gap-2">
            {data.map((d) => (
              <span
                key={d.urgency}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: urgencyBg(d.urgency), color: urgencyColor(d.urgency) }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: urgencyColor(d.urgency) }}
                />
                {d.urgency} · {d.percentage}%
              </span>
            ))}
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.06)" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="urgency"
                  width={72}
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background:   'var(--surface)',
                    border:       '1px solid var(--border)',
                    borderRadius: 10,
                    boxShadow:    'var(--shadow-lg)',
                    fontSize:     13,
                  }}
                  formatter={(v, _n, item) => {
                    const row = item?.payload as UrgencyPoint | null;
                    return [`${tooltipValue(v)} (${row?.percentage ?? 0}%)`, 'Calls'];
                  }}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {data.map((entry) => (
                    <Cell key={entry.urgency} fill={urgencyColor(entry.urgency)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
