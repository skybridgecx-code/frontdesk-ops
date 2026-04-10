'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { timeAgo } from '@/lib/call-utils';

type PlanFilter = '' | 'free' | 'starter' | 'pro' | 'enterprise';
type StatusFilter = '' | 'active' | 'canceled' | 'past_due' | 'none';

type AdminTenant = {
  id: string;
  email: string;
  name: string;
  businessName: string | null;
  industry: string | null;
  plan: string;
  subscriptionStatus: string;
  twilioPhoneNumber: string | null;
  onboardingComplete: boolean;
  callCount: number;
  lastCallAt: string | null;
  createdAt: string;
};

type AdminTenantsResponse = {
  tenants: AdminTenant[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

function PlanBadge({ plan }: { plan: string }) {
  const normalized = plan.toLowerCase();

  const className =
    normalized === 'starter'
      ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
      : normalized === 'pro'
        ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
        : normalized === 'enterprise'
          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          : 'bg-gray-500/15 text-gray-300 border-gray-500/30';

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${className}`}>
      {normalized}
    </span>
  );
}

function SubscriptionBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();

  const className =
    normalized === 'active'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : normalized === 'canceled' || normalized === 'inactive'
        ? 'bg-red-500/15 text-red-300 border-red-500/30'
        : normalized === 'past_due'
          ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
          : 'bg-gray-500/15 text-gray-300 border-gray-500/30';

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${className}`}>
      {normalized.replace('_', ' ')}
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(value));
}

const DEFAULT_PAGINATION = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1
};

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState<PlanFilter>('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchTenants() {
      setLoading(true);
      setError(null);

      const query = new URLSearchParams({
        page: String(page),
        limit: '20'
      });

      if (search) {
        query.set('search', search);
      }

      if (plan) {
        query.set('plan', plan);
      }

      if (status) {
        query.set('status', status);
      }

      try {
        const response = await fetch(`/api/admin/tenants?${query.toString()}`, {
          cache: 'no-store',
          signal: controller.signal
        });

        const payload = (await response.json()) as AdminTenantsResponse | { error?: string };

        if (!response.ok) {
          setError(payload && 'error' in payload ? payload.error ?? 'Failed to load tenants' : 'Failed to load tenants');
          return;
        }

        if ('tenants' in payload && 'pagination' in payload) {
          setTenants(payload.tenants);
          setPagination(payload.pagination);
        }
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load tenants');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchTenants();

    return () => controller.abort();
  }, [page, plan, search, status]);

  const range = useMemo(() => {
    if (pagination.total === 0) {
      return { start: 0, end: 0 };
    }

    const start = (pagination.page - 1) * pagination.limit + 1;
    const end = Math.min(pagination.page * pagination.limit, pagination.total);

    return { start, end };
  }, [pagination]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">All Tenants</h2>
        <p className="text-sm text-gray-400">{pagination.total} total</p>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="Search by name, email, or business..."
          className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-white placeholder-gray-500"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />

        <select
          className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
          value={plan}
          onChange={(event) => {
            setPlan(event.target.value as PlanFilter);
            setPage(1);
          }}
        >
          <option value="">All Plans</option>
          <option value="free">Free</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>

        <select
          className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as StatusFilter);
            setPage(1);
          }}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="canceled">Canceled</option>
          <option value="past_due">Past Due</option>
          <option value="none">No Subscription</option>
        </select>
      </div>

      {error ? <div className="mb-4 rounded-lg border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">{error}</div> : null}

      <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-gray-400">Tenant</th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-gray-400">Plan</th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-gray-400">Status</th>
              <th className="hidden px-4 py-3 text-left text-xs uppercase tracking-wide text-gray-400 sm:table-cell">Calls</th>
              <th className="hidden px-4 py-3 text-left text-xs uppercase tracking-wide text-gray-400 md:table-cell">Last Call</th>
              <th className="hidden px-4 py-3 text-left text-xs uppercase tracking-wide text-gray-400 lg:table-cell">Joined</th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-sm text-gray-400">
                  Loading tenants...
                </td>
              </tr>
            ) : tenants.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-sm text-gray-400">
                  No tenants found for the current filters.
                </td>
              </tr>
            ) : (
              tenants.map((tenant) => (
                <tr key={tenant.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-white">{tenant.businessName || tenant.name}</p>
                    <p className="text-xs text-gray-500">{tenant.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <PlanBadge plan={tenant.plan} />
                  </td>
                  <td className="px-4 py-3">
                    <SubscriptionBadge status={tenant.subscriptionStatus} />
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-gray-300 sm:table-cell">{tenant.callCount}</td>
                  <td className="hidden px-4 py-3 text-xs text-gray-400 md:table-cell">
                    {tenant.lastCallAt ? timeAgo(tenant.lastCallAt) : '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-gray-400 lg:table-cell">{formatDate(tenant.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/tenants/${tenant.id}`} className="text-sm text-blue-400 hover:text-blue-300">
                      View →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-gray-400">
          Showing {range.start}-{range.end} of {pagination.total}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={pagination.page === 1}
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
            disabled={pagination.page >= pagination.totalPages}
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
