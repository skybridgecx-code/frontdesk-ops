import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import { getCurrentTenant } from '@/lib/tenant';
import { Card } from '../components/card';
import { EmptyState } from '../components/empty-state';
import { StatusBadge } from '../components/status-badge';
import { ManageSubscriptionButton } from './manage-subscription-button';

export const metadata: Metadata = {
  title: 'Billing | SkybridgeCX'
};

export const dynamic = 'force-dynamic';

type PlanKey = 'starter' | 'pro' | 'enterprise';

type BillingPlan = {
  key: PlanKey;
  name: string;
  monthlyPrice: number;
  callsPerMonth: number;
  maxPhoneNumbers: number;
  maxBusinesses: number;
  features: string[];
  stripePriceId: string | null;
};

type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

type BillingStatusResponse =
  | {
      status: 'none';
      plans: BillingPlan[];
    }
  | {
      status: SubscriptionStatus;
      stripeCustomerId: string;
      stripeSubscriptionId: string;
      stripePriceId: string;
      cancelAtPeriodEnd: boolean;
      currentPeriodStart: string;
      currentPeriodEnd: string;
      planKey: PlanKey;
      planName: string;
      monthlyPrice: number;
      planLimits: {
        callsPerMonth: number;
        maxPhoneNumbers: number;
        maxBusinesses: number;
      };
      callsThisPeriod: number;
      activePhoneNumbers: number;
      activeBusinesses: number;
      plans: BillingPlan[];
    };

const FALLBACK_PLANS: BillingPlan[] = [
  {
    key: 'starter',
    name: 'Starter',
    monthlyPrice: 299,
    callsPerMonth: 500,
    maxPhoneNumbers: 1,
    maxBusinesses: 1,
    features: [
      'AI call answering 24/7',
      'Up to 500 calls/month',
      'Lead extraction & email alerts',
      'Call recording & playback',
      'Basic dashboard & CRM',
      'Email support'
    ],
    stripePriceId: null
  },
  {
    key: 'pro',
    name: 'Pro',
    monthlyPrice: 499,
    callsPerMonth: -1,
    maxPhoneNumbers: 3,
    maxBusinesses: 1,
    features: [
      'Everything in Starter',
      'Unlimited calls',
      'Up to 3 phone numbers',
      'Outreach copilot AI drafts',
      'Priority support',
      'Custom agent personality'
    ],
    stripePriceId: null
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 999,
    callsPerMonth: -1,
    maxPhoneNumbers: 10,
    maxBusinesses: 5,
    features: [
      'Everything in Pro',
      'Up to 5 businesses / locations',
      'Up to 10 phone numbers',
      'API access & webhooks',
      'Dedicated onboarding',
      'Custom integrations'
    ],
    stripePriceId: null
  }
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium'
  }).format(new Date(value));
}

function formatCallsValue(used: number, limit: number) {
  if (limit < 0) {
    return `${used} / Unlimited calls used`;
  }

  return `${used} / ${limit} calls used`;
}

function formatCountValue(used: number, limit: number, label: string) {
  if (limit < 0) {
    return `${used} / Unlimited ${label}`;
  }

  return `${used} / ${limit} ${label}`;
}

function toProgressPercent(used: number, limit: number) {
  if (limit <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((used / limit) * 100));
}

function getPlanRank(planKey: PlanKey) {
  if (planKey === 'starter') {
    return 0;
  }

  if (planKey === 'pro') {
    return 1;
  }

  return 2;
}

async function getBillingStatus(tenantId: string): Promise<BillingStatusResponse> {
  const response = await fetch(`${getApiBaseUrl()}/v1/billing/status/${tenantId}`, {
    cache: 'no-store',
    headers: await getInternalApiHeaders()
  });

  if (!response.ok) {
    return {
      status: 'none',
      plans: FALLBACK_PLANS
    };
  }

  const parsed = (await response.json()) as BillingStatusResponse;
  if (parsed.plans.length === 0) {
    return {
      ...parsed,
      plans: FALLBACK_PLANS
    };
  }

  return parsed;
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
  const plans = billingStatus.plans.length > 0 ? billingStatus.plans : FALLBACK_PLANS;

  const subscriptionStatus = billingStatus.status === 'none' ? null : billingStatus;
  const hasSubscription = subscriptionStatus !== null;
  const currentPlanKey = subscriptionStatus?.planKey ?? null;

  const upgradePlans = hasSubscription
    ? plans.filter((plan) => {
        const currentRank = currentPlanKey ? getPlanRank(currentPlanKey) : -1;
        return getPlanRank(plan.key) > currentRank;
      })
    : [];

  const primaryUpgradePlan = upgradePlans[0] ?? null;

  const callLimit = subscriptionStatus ? subscriptionStatus.planLimits.callsPerMonth : 0;
  const callUsageRatio = subscriptionStatus && callLimit > 0 ? subscriptionStatus.callsThisPeriod / callLimit : 0;
  const isApproachingCallLimit = subscriptionStatus && callLimit > 0 && callUsageRatio >= 0.8;

  const showCheckoutSuccessBanner = resolvedSearchParams.checkout === 'success';
  const showCheckoutCanceledBanner =
    resolvedSearchParams.checkout === 'canceled' || resolvedSearchParams.checkout === 'cancel';
  const noticeMessage =
    resolvedSearchParams.notice === 'checkout-error'
      ? 'Could not create Stripe checkout session.'
      : resolvedSearchParams.notice === 'portal-error'
        ? 'Could not open Stripe billing portal.'
        : resolvedSearchParams.notice === 'subscription-required'
          ? 'Active subscription required to access dashboard pages.'
          : null;

  async function createCheckoutSession(planKey: PlanKey) {
    'use server';

    const response = await fetch(`${getApiBaseUrl()}/v1/billing/checkout`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        ...(await getInternalApiHeaders()),
        'content-type': 'application/json'
      },
      body: JSON.stringify({ tenantId, planKey })
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

  return (
    <div className="space-y-6">
      <Card title="Billing" subtitle={`Manage your SkybridgeCX subscription for ${tenant.name}.`}>
        <p className="text-sm text-gray-600">
          Pick the plan that matches your call volume and team footprint. All plans include AI answering,
          recordings, and dashboard operations tooling.
        </p>
      </Card>

      {showCheckoutSuccessBanner ? (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 mb-6">
          <p className="text-green-800 font-medium">
            ✅ Subscription activated! Your plan is now active.
          </p>
        </div>
      ) : null}

      {showCheckoutCanceledBanner ? (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 mb-6">
          <p className="text-yellow-800 font-medium">
            Checkout was canceled. You can try again anytime.
          </p>
        </div>
      ) : null}

      {noticeMessage ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{noticeMessage}</div>
      ) : null}

      {subscriptionStatus?.status === 'active' ? (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-blue-800 font-medium">
                Current Plan: <span className="font-bold capitalize">{subscriptionStatus.planKey}</span>
              </p>
              <p className="text-blue-600 text-sm">Your subscription is active.</p>
            </div>
            <ManageSubscriptionButton tenantId={tenantId} />
          </div>
        </div>
      ) : null}

      {subscriptionStatus?.status === 'past_due' ? (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-6">
          <p className="text-red-800 font-medium">
            ⚠️ Payment failed. Please update your payment method.
          </p>
        </div>
      ) : null}

      {subscriptionStatus?.status === 'canceled' ? (
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 mb-6">
          <p className="text-gray-800 font-medium">
            Your subscription has been canceled. Choose a plan below to resubscribe.
          </p>
        </div>
      ) : null}

      {subscriptionStatus ? (
        <Card title="Current plan" subtitle="Subscription status and usage for this billing cycle.">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-3">
                <StatusBadge value={subscriptionStatus.status} type="subscription" />
                <div>
                  <p className="text-lg font-semibold text-gray-900">
                    {subscriptionStatus.planName} · ${subscriptionStatus.monthlyPrice}/mo
                  </p>
                  <p className="text-sm text-gray-600">
                    Period {formatDate(subscriptionStatus.currentPeriodStart)} to {formatDate(subscriptionStatus.currentPeriodEnd)}
                  </p>
                </div>
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-auto">
                {primaryUpgradePlan ? (
                  <form action={createCheckoutSession.bind(null, primaryUpgradePlan.key)}>
                    <button className="min-h-11 w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 sm:w-auto">
                      {`Upgrade to ${primaryUpgradePlan.name}`}
                    </button>
                  </form>
                ) : null}
              </div>
            </div>

            {subscriptionStatus.cancelAtPeriodEnd ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Subscription is set to cancel at period end.
              </p>
            ) : null}

            {isApproachingCallLimit ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                You&#39;re approaching your call limit. Upgrade to Pro for unlimited calls.
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Calls</p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {formatCallsValue(subscriptionStatus.callsThisPeriod, subscriptionStatus.planLimits.callsPerMonth)}
                </p>
                {subscriptionStatus.planLimits.callsPerMonth > 0 ? (
                  <div className="mt-2 h-2 rounded-full bg-gray-100">
                    <div
                      className={`h-2 rounded-full ${isApproachingCallLimit ? 'bg-amber-500' : 'bg-indigo-600'}`}
                      style={{ width: `${toProgressPercent(subscriptionStatus.callsThisPeriod, subscriptionStatus.planLimits.callsPerMonth)}%` }}
                    />
                  </div>
                ) : null}
              </div>

              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Phone numbers</p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {formatCountValue(
                    subscriptionStatus.activePhoneNumbers,
                    subscriptionStatus.planLimits.maxPhoneNumbers,
                    'phone numbers'
                  )}
                </p>
                <div className="mt-2 h-2 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-indigo-600"
                    style={{ width: `${toProgressPercent(subscriptionStatus.activePhoneNumbers, subscriptionStatus.planLimits.maxPhoneNumbers)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Businesses</p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {formatCountValue(
                    subscriptionStatus.activeBusinesses,
                    subscriptionStatus.planLimits.maxBusinesses,
                    'businesses'
                  )}
                </p>
                <div className="mt-2 h-2 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-indigo-600"
                    style={{ width: `${toProgressPercent(subscriptionStatus.activeBusinesses, subscriptionStatus.planLimits.maxBusinesses)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      <Card title="Choose a plan" subtitle="Monthly pricing for SkybridgeCX AI front desk operations.">
          <div className="grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => {
              const isPro = plan.key === 'pro';
              const isEnterprise = plan.key === 'enterprise';
              const isCurrent = currentPlanKey === plan.key;
              const canCheckout = plan.stripePriceId !== null;

              return (
                <article
                  key={plan.key}
                  className={`relative flex h-full flex-col rounded-lg border p-4 ${
                    isPro ? 'border-indigo-600 shadow-sm' : 'border-gray-200'
                  } ${isCurrent ? 'ring-2 ring-blue-500' : ''}`}
                >
                  {isPro ? (
                    <span className="absolute right-3 top-3 rounded-full bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white">
                      Most Popular
                    </span>
                  ) : null}

                  {isCurrent ? (
                    <span className="mb-2 inline-block w-fit rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                      Current Plan
                    </span>
                  ) : null}

                  <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                  <div className="mt-2 flex items-end gap-1">
                    <span className="text-3xl font-semibold tracking-tight text-gray-900">${plan.monthlyPrice}</span>
                    <span className="pb-1 text-sm text-gray-500">/mo</span>
                  </div>

                  <ul className="mt-4 space-y-2 text-sm text-gray-700">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <span className="mt-0.5 text-indigo-600" aria-hidden="true">
                          ✓
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5 flex flex-1 flex-col justify-end gap-2">
                    {isCurrent ? (
                      <button
                        disabled
                        className="w-full rounded-lg bg-gray-300 py-2 text-sm text-gray-500 cursor-not-allowed"
                      >
                        Current Plan
                      </button>
                    ) : (
                      <form action={createCheckoutSession.bind(null, plan.key)}>
                        <button
                          disabled={!canCheckout}
                          className="min-h-11 w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                        >
                          Choose Plan
                        </button>
                      </form>
                    )}

                    {isEnterprise ? (
                      <a
                        href="mailto:sales@skybridgecx.com?subject=SkybridgeCX%20Enterprise"
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-indigo-50"
                      >
                        Contact Us
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
      </Card>
    </div>
  );
}
