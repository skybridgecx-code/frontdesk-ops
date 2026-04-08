import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import { getCurrentTenant } from '@/lib/tenant';
import { SidebarNav } from './components/sidebar-nav';

export const metadata: Metadata = {
  title: 'Dashboard | SkybridgeCX'
};

type BillingStatusResponse = {
  status: string;
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

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const pathname = getRequestPathname(requestHeaders);
  const isBillingPage = pathname === '/billing' || pathname.startsWith('/billing/');

  const tenant = await getCurrentTenant();
  const billingStatus = tenant
    ? await getBillingStatus(tenant.id)
    : {
        status: 'none'
      };

  const normalizedBillingStatus = billingStatus.status.toLowerCase();
  const canAccessDashboard =
    normalizedBillingStatus === 'active' ||
    normalizedBillingStatus === 'trialing' ||
    normalizedBillingStatus === 'past_due';

  if (!isBillingPage && !canAccessDashboard) {
    redirect('/billing?notice=subscription-required');
  }

  const showPastDueBanner = !isBillingPage && normalizedBillingStatus === 'past_due';

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1700px]">
        <SidebarNav subscriptionStatus={billingStatus.status} />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="h-14 lg:hidden" />

          {showPastDueBanner ? (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span>Your subscription is past due. Update billing to avoid service interruption.</span>
                <Link href="/billing" className="font-semibold text-amber-900 underline underline-offset-4">
                  Go to billing
                </Link>
              </div>
            </div>
          ) : null}

          <main className="flex-1 px-4 pb-8 pt-4 sm:px-6 sm:pt-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
