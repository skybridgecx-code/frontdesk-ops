'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { formatPhoneNumber, timeAgo } from '@/lib/call-utils';

type AdminCall = {
  id: string;
  callerName: string | null;
  callerPhone: string | null;
  callReason: string | null;
  callStatus: string;
  createdAt: string;
};

type AdminTenantDetail = {
  id: string;
  email: string | null;
  name: string;
  businessName: string | null;
  industry: string | null;
  businessAddress: string | null;
  businessPhone: string | null;
  timezone: string | null;
  greeting: string | null;
  twilioPhoneNumber: string | null;
  plan: string;
  subscriptionStatus: string;
  onboardingComplete: boolean;
  callCount: number;
  missedCallCount: number;
  voicemailCount: number;
  lastCallAt: string | null;
  createdAt: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  recentCalls: AdminCall[];
};

type TenantDetailResponse = {
  tenant: AdminTenantDetail;
};

type PlanValue = 'free' | 'starter' | 'pro' | 'enterprise';
type StatusValue = 'none' | 'active' | 'canceled' | 'past_due' | 'inactive';

type TenantEditState = {
  plan: PlanValue;
  subscriptionStatus: StatusValue;
  onboardingComplete: boolean;
  businessName: string;
  greeting: string;
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

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-white">{value}</p>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

function createEditState(tenant: AdminTenantDetail): TenantEditState {
  return {
    plan: (tenant.plan as PlanValue) ?? 'free',
    subscriptionStatus: (tenant.subscriptionStatus as StatusValue) ?? 'none',
    onboardingComplete: tenant.onboardingComplete,
    businessName: tenant.businessName ?? '',
    greeting: tenant.greeting ?? ''
  };
}

export default function AdminTenantDetailPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = useMemo(() => {
    const raw = params?.tenantId;
    if (Array.isArray(raw)) {
      return raw[0] ?? '';
    }

    return raw ?? '';
  }, [params]);

  const [tenant, setTenant] = useState<AdminTenantDetail | null>(null);
  const [form, setForm] = useState<TenantEditState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      return;
    }

    const controller = new AbortController();

    async function fetchTenant() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/admin/tenants/${tenantId}`, {
          cache: 'no-store',
          signal: controller.signal
        });

        const payload = (await response.json()) as TenantDetailResponse | { error?: string };

        if (!response.ok) {
          setError(payload && 'error' in payload ? payload.error ?? 'Failed to load tenant' : 'Failed to load tenant');
          return;
        }

        if ('tenant' in payload) {
          setTenant(payload.tenant);
          setForm(createEditState(payload.tenant));
        }
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load tenant');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchTenant();

    return () => controller.abort();
  }, [tenantId]);

  async function refreshTenant() {
    if (!tenantId) {
      return;
    }

    const response = await fetch(`/api/admin/tenants/${tenantId}`, {
      cache: 'no-store'
    });

    const payload = (await response.json()) as TenantDetailResponse | { error?: string };

    if (!response.ok) {
      throw new Error(payload && 'error' in payload ? payload.error ?? 'Failed to refresh tenant' : 'Failed to refresh tenant');
    }

    if ('tenant' in payload) {
      setTenant(payload.tenant);
      setForm(createEditState(payload.tenant));
    }
  }

  async function handleSave() {
    if (!tenantId || !form) {
      return;
    }

    setSaving(true);
    setNotice(null);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        plan: form.plan,
        subscriptionStatus: form.subscriptionStatus,
        onboardingComplete: form.onboardingComplete,
        greeting: form.greeting
      };

      const trimmedBusinessName = form.businessName.trim();
      if (trimmedBusinessName.length > 0) {
        payload.businessName = trimmedBusinessName;
      }

      const response = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? 'Failed to update tenant');
      }

      setNotice('Tenant updated successfully.');
      await refreshTenant();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update tenant');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!tenantId) {
      return;
    }

    setActionLoading(true);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}/deactivate`, {
        method: 'POST'
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? 'Failed to deactivate tenant');
      }

      setNotice('Tenant deactivated.');
      await refreshTenant();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to deactivate tenant');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReactivate() {
    if (!tenantId) {
      return;
    }

    setActionLoading(true);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}/reactivate`, {
        method: 'POST'
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? 'Failed to reactivate tenant');
      }

      setNotice('Tenant reactivated.');
      await refreshTenant();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to reactivate tenant');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-400">Loading tenant details...</p>;
  }

  if (error && !tenant) {
    return (
      <div>
        <Link href="/admin/tenants" className="text-sm text-blue-400 hover:text-blue-300">
          ← Back to Tenants
        </Link>
        <div className="mt-4 rounded-xl border border-red-900 bg-red-950/30 p-4 text-red-300">{error}</div>
      </div>
    );
  }

  if (!tenant || !form) {
    return (
      <div>
        <Link href="/admin/tenants" className="text-sm text-blue-400 hover:text-blue-300">
          ← Back to Tenants
        </Link>
        <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900 p-4 text-gray-300">Tenant not found.</div>
      </div>
    );
  }

  return (
    <div>
      <Link href="/admin/tenants" className="text-sm text-blue-400 hover:text-blue-300">
        ← Back to Tenants
      </Link>

      <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">{tenant.businessName || tenant.name}</h2>
            <p className="text-gray-400">{tenant.email ?? 'No email on file'}</p>
          </div>
          <div className="flex gap-2">
            <PlanBadge plan={tenant.plan} />
            <SubscriptionBadge status={tenant.subscriptionStatus} />
          </div>
        </div>
      </div>

      {notice ? <div className="mt-4 rounded-lg border border-emerald-900 bg-emerald-950/30 p-3 text-sm text-emerald-300">{notice}</div> : null}
      {error ? <div className="mt-4 rounded-lg border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">{error}</div> : null}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Calls" value={tenant.callCount} />
        <StatCard label="Missed Calls" value={tenant.missedCallCount} />
        <StatCard label="Voicemails" value={tenant.voicemailCount} />
        <StatCard label="Last Call" value={tenant.lastCallAt ? timeAgo(tenant.lastCallAt) : 'Never'} />
      </div>

      <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="mb-4 font-semibold text-white">Details</h3>
        <div className="grid grid-cols-1 gap-4 text-sm text-gray-300 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Tenant ID</p>
            <p className="font-mono text-xs text-gray-300">{tenant.id}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Industry</p>
            <p>{tenant.industry ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Phone Number</p>
            <p>{formatPhoneNumber(tenant.twilioPhoneNumber)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Onboarding</p>
            <p>{tenant.onboardingComplete ? 'Complete' : 'Incomplete'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Joined</p>
            <p>{formatDate(tenant.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Last Call Timestamp</p>
            <p>{formatDate(tenant.lastCallAt)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Stripe Customer</p>
            <p className="font-mono text-xs">{tenant.stripeCustomerId ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Stripe Subscription</p>
            <p className="font-mono text-xs">{tenant.stripeSubscriptionId ?? '—'}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="mb-4 font-semibold text-white">Admin Actions</h3>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <label className="text-sm text-gray-300">
            <span className="mb-1 block text-xs uppercase tracking-wide text-gray-500">Plan</span>
            <select
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
              value={form.plan}
              onChange={(event) => setForm((current) => (current ? { ...current, plan: event.target.value as PlanValue } : current))}
            >
              <option value="free">Free</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </label>

          <label className="text-sm text-gray-300">
            <span className="mb-1 block text-xs uppercase tracking-wide text-gray-500">Subscription Status</span>
            <select
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
              value={form.subscriptionStatus}
              onChange={(event) =>
                setForm((current) =>
                  current
                    ? { ...current, subscriptionStatus: event.target.value as StatusValue }
                    : current
                )
              }
            >
              <option value="none">none</option>
              <option value="active">active</option>
              <option value="canceled">canceled</option>
              <option value="past_due">past_due</option>
              <option value="inactive">inactive</option>
            </select>
          </label>

          <label className="text-sm text-gray-300 lg:col-span-2">
            <span className="mb-1 block text-xs uppercase tracking-wide text-gray-500">Business Name</span>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
              value={form.businessName}
              onChange={(event) => setForm((current) => (current ? { ...current, businessName: event.target.value } : current))}
            />
          </label>

          <label className="text-sm text-gray-300 lg:col-span-2">
            <span className="mb-1 block text-xs uppercase tracking-wide text-gray-500">Greeting</span>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
              value={form.greeting}
              onChange={(event) => setForm((current) => (current ? { ...current, greeting: event.target.value } : current))}
            />
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={form.onboardingComplete}
              onChange={(event) =>
                setForm((current) =>
                  current ? { ...current, onboardingComplete: event.target.checked } : current
                )
              }
              className="h-4 w-4 rounded border-gray-600 bg-gray-950"
            />
            Mark onboarding complete
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || actionLoading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={handleDeactivate}
            disabled={saving || actionLoading}
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionLoading ? 'Processing...' : 'Deactivate Tenant'}
          </button>
          <button
            type="button"
            onClick={handleReactivate}
            disabled={saving || actionLoading}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionLoading ? 'Processing...' : 'Reactivate Tenant'}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="mb-4 font-semibold text-white">Recent Calls</h3>

        {tenant.recentCalls.length === 0 ? (
          <p className="text-sm text-gray-400">No calls found for this tenant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-2 py-2 text-left text-xs uppercase tracking-wide text-gray-500">Caller</th>
                  <th className="px-2 py-2 text-left text-xs uppercase tracking-wide text-gray-500">Phone</th>
                  <th className="px-2 py-2 text-left text-xs uppercase tracking-wide text-gray-500">Reason</th>
                  <th className="px-2 py-2 text-left text-xs uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-2 py-2 text-left text-xs uppercase tracking-wide text-gray-500">Created</th>
                </tr>
              </thead>
              <tbody>
                {tenant.recentCalls.map((call) => (
                  <tr key={call.id} className="border-b border-gray-800/70">
                    <td className="px-2 py-2 text-sm text-gray-200">{call.callerName ?? 'Unknown'}</td>
                    <td className="px-2 py-2 text-xs text-gray-400">{formatPhoneNumber(call.callerPhone)}</td>
                    <td className="px-2 py-2 text-xs text-gray-400">{call.callReason ?? 'Not captured'}</td>
                    <td className="px-2 py-2 text-xs text-gray-300">{call.callStatus}</td>
                    <td className="px-2 py-2 text-xs text-gray-400">{formatDate(call.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
