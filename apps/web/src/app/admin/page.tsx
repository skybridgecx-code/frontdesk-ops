'use client';

import { useEffect, useState } from 'react';
import { CallsChart } from '@/components/admin/calls-chart';
import { SignupsChart } from '@/components/admin/signups-chart';

type OverviewResponse = {
  tenants: {
    total: number;
    active: number;
    onPlan: {
      free: number;
      starter: number;
      pro: number;
      enterprise: number;
    };
    signedUpToday: number;
    signedUpThisWeek: number;
    signedUpThisMonth: number;
  };
  calls: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    byStatus: {
      completed: number;
      missed: number;
      voicemail: number;
      inProgress: number;
    };
  };
  revenue: {
    mrr: number;
    breakdown: {
      starter: { count: number; revenue: number };
      pro: { count: number; revenue: number };
      enterprise: { count: number; revenue: number };
    };
  };
};

function MetricCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="mt-1 text-sm text-gray-400">{label}</p>
    </div>
  );
}

function PlanCard({
  plan,
  count,
  revenue
}: {
  plan: string;
  count: number;
  revenue: number;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <p className="text-sm text-gray-400">{plan} Plan</p>
      <p className="text-2xl font-bold text-white">{count} tenants</p>
      <p className="mt-1 text-sm text-green-400">${revenue.toLocaleString()}/mo</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchOverview() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/admin/metrics/overview', {
          cache: 'no-store'
        });
        const payload = (await response.json()) as OverviewResponse | { error?: string };

        if (!response.ok) {
          if (!cancelled) {
            setError(payload && 'error' in payload ? payload.error ?? 'Failed to load metrics' : 'Failed to load metrics');
          }
          return;
        }

        if (!cancelled) {
          setMetrics(payload as OverviewResponse);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : 'Failed to load metrics');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchOverview();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div>
        <h2 className="mb-6 text-xl font-bold text-white">Platform Overview</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl border border-gray-800 bg-gray-900" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div>
        <h2 className="mb-6 text-xl font-bold text-white">Platform Overview</h2>
        <div className="rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-red-300">
          {error ?? 'Failed to load metrics'}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-white">Platform Overview</h2>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Tenants" value={metrics.tenants.total} icon="👥" />
        <MetricCard label="Active Subscriptions" value={metrics.tenants.active} icon="✅" />
        <MetricCard label="MRR" value={`$${metrics.revenue.mrr.toLocaleString()}`} icon="💰" />
        <MetricCard label="Calls Today" value={metrics.calls.today} icon="📞" />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <PlanCard
          plan="Starter"
          count={metrics.revenue.breakdown.starter.count}
          revenue={metrics.revenue.breakdown.starter.revenue}
        />
        <PlanCard
          plan="Pro"
          count={metrics.revenue.breakdown.pro.count}
          revenue={metrics.revenue.breakdown.pro.revenue}
        />
        <PlanCard
          plan="Enterprise"
          count={metrics.revenue.breakdown.enterprise.count}
          revenue={metrics.revenue.breakdown.enterprise.revenue}
        />
      </div>

      <div className="mb-8 grid grid-cols-3 gap-4">
        <MiniStat label="Today" value={metrics.tenants.signedUpToday} />
        <MiniStat label="This Week" value={metrics.tenants.signedUpThisWeek} />
        <MiniStat label="This Month" value={metrics.tenants.signedUpThisMonth} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CallsChart />
        <SignupsChart />
      </div>
    </div>
  );
}
