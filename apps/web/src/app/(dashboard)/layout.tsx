import type { Metadata } from 'next';
import Link from 'next/link';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import { SidebarNav } from './components/sidebar-nav';

export const metadata: Metadata = {
  title: 'Dashboard | SkybridgeCX'
};

type BootstrapResponse = {
  ok: true;
  tenant: {
    id: string;
  } | null;
};

type BillingStatusResponse = {
  status: string;
};

async function getTenantId() {
  const response = await fetch(`${getApiBaseUrl()}/v1/bootstrap`, {
    cache: 'no-store',
    headers: await getInternalApiHeaders()
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as BootstrapResponse;
  return data.tenant?.id ?? null;
}

async function getBillingStatus(tenantId: string): Promise<BillingStatusResponse | null> {
  const response = await fetch(`${getApiBaseUrl()}/v1/billing/status/${tenantId}`, {
    cache: 'no-store',
    headers: await getInternalApiHeaders()
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as BillingStatusResponse;
}

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const tenantId = await getTenantId();
  const billingStatus = tenantId ? await getBillingStatus(tenantId) : null;
  const showBillingBanner =
    billingStatus != null && billingStatus.status !== 'active' && billingStatus.status !== 'trialing';

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1700px]">
        <SidebarNav subscriptionStatus={billingStatus?.status ?? 'none'} />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="h-14 lg:hidden" />

          {showBillingBanner ? (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span>Your trial has ended. Subscribe to continue using SkybridgeCX.</span>
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
