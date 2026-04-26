import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import { getCurrentTenant, getOnboardingStatus } from '@/lib/tenant';
import { SidebarNav } from './components/sidebar-nav';

export const metadata: Metadata = {
  title: 'Dashboard | SkyBridgeCX'
};

type BillingStatusResponse = {
  status: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  trialExpired?: boolean;
  trialEndedAt?: string | null;
};

function getRequestPathname(requestHeaders: { get(name: string): string | null }) {
  const explicitPathname = requestHeaders.get('x-skybridge-pathname');
  if (explicitPathname) {
    return explicitPathname;
  }

  const nextUrl = requestHeaders.get('next-url');
  if (!nextUrl) {
    return '';
  }

  try {
    return new URL(nextUrl, 'http://localhost').pathname;
  } catch {
    return nextUrl.split('?')[0] ?? nextUrl;
  }
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

function canAccessDashboard(billingStatus: BillingStatusResponse) {
  const normalizedBillingStatus = billingStatus.status.toLowerCase();
  if (normalizedBillingStatus === 'active' || normalizedBillingStatus === 'past_due') {
    return true;
  }

  if (normalizedBillingStatus !== 'trialing') {
    return false;
  }

  return Boolean(billingStatus.stripeSubscriptionId || billingStatus.stripeCustomerId);
}

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const pathname = getRequestPathname(requestHeaders);
  const isBillingPage = pathname === '/billing' || pathname.startsWith('/billing/');

  const [tenant, onboardingStatus] = await Promise.all([getCurrentTenant(), getOnboardingStatus()]);

  const billingStatus = tenant
    ? await getBillingStatus(tenant.id)
    : {
        status: 'none'
      };

  const normalizedBillingStatus = billingStatus.status.toLowerCase();
  const hasDashboardAccess = canAccessDashboard(billingStatus);

  const shouldRedirectToOnboarding = onboardingStatus
    ? onboardingStatus.isOnboardingComplete === false && !isBillingPage
    : false;

  if (shouldRedirectToOnboarding) {
    redirect('/onboarding');
  }

  if (!isBillingPage && !hasDashboardAccess) {
    const notice = billingStatus.trialExpired ? 'trial-expired' : 'subscription-required';
    redirect(`/billing?notice=${notice}`);
  }

  if (isBillingPage && !hasDashboardAccess) {
    return (
      <div className="skybridge-app min-h-screen overflow-x-hidden">
        <main className="mx-auto w-full max-w-[1700px] px-4 pb-10 pt-6 sm:px-6 sm:pt-8 lg:px-10">{children}</main>
      </div>
    );
  }

  const showPastDueBanner = !isBillingPage && normalizedBillingStatus === 'past_due';

  return (
    <div className="skybridge-app min-h-screen overflow-x-hidden">
      <div className="flex min-h-screen w-full">
        <SidebarNav subscriptionStatus={billingStatus.status} />

        <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
          {/* Mobile top spacer */}
          <div className="h-14 lg:hidden" />

          {showPastDueBanner ? (
            <div
              className="flex flex-col gap-1 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"
              style={{
                background:  'rgba(245, 158, 11, 0.08)',
                borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
                color:       '#92400E',
              }}
            >
              <span>Your subscription is past due. Update billing to avoid service interruption.</span>
              <Link
                href="/billing"
                className="font-semibold underline underline-offset-4 transition hover:opacity-80"
                style={{ color: '#92400E' }}
              >
                Go to billing →
              </Link>
            </div>
          ) : null}

          <main className="flex-1 px-4 pb-10 pt-6 sm:px-6 sm:pt-7 lg:px-8 page-enter">{children}</main>
        </div>
      </div>
    </div>
  );
}
