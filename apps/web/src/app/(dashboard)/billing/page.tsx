import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import { getCurrentTenant } from '@/lib/tenant';
import { Card } from '../components/card';
import { EmptyState } from '../components/empty-state';
import { StatusBadge } from '../components/status-badge';

export const metadata: Metadata = {
  title: 'Billing | SkybridgeCX'
};

export const dynamic = 'force-dynamic';

type BillingStatusResponse =
  | {
      status: 'none';
    }
  | {
      status:
        | 'active'
        | 'trialing'
        | 'past_due'
        | 'canceled'
        | 'unpaid'
        | 'incomplete'
        | 'incomplete_expired'
        | 'paused';
      stripeCustomerId: string;
      stripeSubscriptionId: string;
      stripePriceId: string;
      cancelAtPeriodEnd: boolean;
      currentPeriodStart: string;
      currentPeriodEnd: string;
    };

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium'
  }).format(new Date(value));
}

async function getBillingStatus(tenantId: string): Promise<BillingStatusResponse> {
  const response = await fetch(`${getApiBaseUrl()}/v1/billing/status/${tenantId}`, {
    cache: 'no-store',
    headers: await getInternalApiHeaders()
  });

  if (!response.ok) {
    return {
      status: 'none'
    };
  }

  return (await response.json()) as BillingStatusResponse;
}

export default async function BillingPage({
  searchParams
}: {
  searchParams: Promise<{ checkout?: string; notice?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const tenant = await getCurrentTenant();

  if (!tenant) {
    return (
      <EmptyState
        title="Billing unavailable"
        description="Billing is unavailable because your account is not linked to a tenant yet."
      />
    );
  }

  const tenantId = tenant.id;
  const billingStatus = await getBillingStatus(tenant.id);
  const hasSubscription = billingStatus.status !== 'none';
  const isActiveSubscription = billingStatus.status === 'active' || billingStatus.status === 'trialing';

  const noticeMessage =
    resolvedSearchParams.checkout === 'success'
      ? 'Subscription checkout completed.'
      : resolvedSearchParams.checkout === 'cancel'
        ? 'Checkout canceled. You can subscribe any time.'
        : resolvedSearchParams.notice === 'checkout-error'
          ? 'Could not create Stripe checkout session.'
          : resolvedSearchParams.notice === 'portal-error'
            ? 'Could not open Stripe billing portal.'
            : resolvedSearchParams.notice === 'subscription-required'
              ? 'Active subscription required to access dashboard pages.'
              : null;

  async function createCheckoutSession() {
    'use server';

    const response = await fetch(`${getApiBaseUrl()}/v1/billing/create-checkout-session`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        ...(await getInternalApiHeaders()),
        'content-type': 'application/json'
      },
      body: JSON.stringify({ tenantId })
    });

    if (!response.ok) {
      redirect('/billing?notice=checkout-error');
    }

    const data = (await response.json()) as {
      url?: string;
    };

    if (!data.url) {
      redirect('/billing?notice=checkout-error');
    }

    redirect(data.url);
  }

  async function createPortalSession() {
    'use server';

    const response = await fetch(`${getApiBaseUrl()}/v1/billing/create-portal-session`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        ...(await getInternalApiHeaders()),
        'content-type': 'application/json'
      },
      body: JSON.stringify({ tenantId })
    });

    if (!response.ok) {
      redirect('/billing?notice=portal-error');
    }

    const data = (await response.json()) as {
      url?: string;
    };

    if (!data.url) {
      redirect('/billing?notice=portal-error');
    }

    redirect(data.url);
  }

  return (
    <div className="space-y-6">
      <Card title="Billing" subtitle={`Manage your SkybridgeCX subscription for ${tenant.name}.`}>
        <p className="text-sm text-gray-600">
          Self-serve billing for the SkybridgeCX Pro plan, with direct access to checkout and customer portal.
        </p>
      </Card>

      {noticeMessage ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{noticeMessage}</div>
      ) : null}

      {hasSubscription ? (
        <Card title="Current subscription" subtitle="Status and current billing cycle.">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <StatusBadge value={billingStatus.status} type="subscription" />
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">Current period start</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(billingStatus.currentPeriodStart)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">Current period end</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(billingStatus.currentPeriodEnd)}</dd>
                </div>
              </dl>
              {billingStatus.cancelAtPeriodEnd ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Subscription is set to cancel at period end.
                </p>
              ) : null}
            </div>

            <form action={createPortalSession}>
              <button className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-indigo-50">
                Manage Subscription
              </button>
            </form>
          </div>
        </Card>
      ) : null}

      {!isActiveSubscription ? (
        <Card title="SkybridgeCX Pro" subtitle="Flat monthly plan for AI front desk operations.">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-semibold tracking-tight text-gray-900">$149</span>
                <span className="pb-1 text-sm text-gray-500">/month</span>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-gray-700">
                <li>24/7 AI front desk call handling</li>
                <li>Call review queue and prospect workflow tools</li>
                <li>Inbound lead capture with operator visibility</li>
                <li>Self-serve billing and customer portal access</li>
              </ul>
            </div>

            <form action={createCheckoutSession}>
              <button className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500">
                Subscribe
              </button>
            </form>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
