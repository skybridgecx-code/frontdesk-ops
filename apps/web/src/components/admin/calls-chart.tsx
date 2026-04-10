'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

type Period = '7d' | '30d' | '90d';

type CallsPoint = {
  date: string;
  total: number;
  completed: number;
  missed: number;
  voicemail: number;
};

type CallsOverTimeResponse = {
  period: Period;
  data: CallsPoint[];
};

const PERIODS: Period[] = ['7d', '30d', '90d'];

function prettyDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function CallsChart() {
  const [period, setPeriod] = useState<Period>('30d');
  const [data, setData] = useState<CallsPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/admin/metrics/calls-over-time?period=${period}`, {
          cache: 'no-store',
          signal: controller.signal
        });

        const payload = (await response.json()) as CallsOverTimeResponse | { error?: string };

        if (!response.ok) {
          setError(payload && 'error' in payload ? payload.error ?? 'Failed to load chart' : 'Failed to load chart');
          return;
        }

        if ('data' in payload && Array.isArray(payload.data)) {
          setData(payload.data);
        } else {
          setData([]);
        }
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load chart');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => controller.abort();
  }, [period]);

  const chartData = useMemo(
    () =>
      data.map((point) => ({
        ...point,
        total: toNumber(point.total),
        completed: toNumber(point.completed),
        missed: toNumber(point.missed),
        voicemail: toNumber(point.voicemail)
      })),
    [data]
  );

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-white">Calls Over Time</h3>
        <div className="flex items-center gap-2">
          {PERIODS.map((value) => {
            const active = value === period;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setPeriod(value)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  active ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {value}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? <p className="text-sm text-gray-400">Loading call chart...</p> : null}
      {!loading && error ? <p className="text-sm text-red-400">{error}</p> : null}

      {!loading && !error ? (
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 6, right: 10, left: -14, bottom: 0 }}>
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={prettyDate}
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
                minTickGap={22}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111827',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem'
                }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#d1d5db' }}
                labelFormatter={(value) => prettyDate(String(value))}
              />
              <Area type="monotone" dataKey="completed" stackId="calls" stroke="#10b981" fill="#10b981" fillOpacity={0.35} />
              <Area type="monotone" dataKey="missed" stackId="calls" stroke="#ef4444" fill="#ef4444" fillOpacity={0.35} />
              <Area type="monotone" dataKey="voicemail" stackId="calls" stroke="#a855f7" fill="#a855f7" fillOpacity={0.35} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  );
}
