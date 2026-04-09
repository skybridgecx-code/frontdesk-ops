import 'server-only';
import { cache } from 'react';
import { getApiBaseUrl, getInternalApiHeaders } from './api';

export type TenantContext = {
  id: string;
  slug: string;
  name: string;
  businesses: Array<{
    id: string;
    name: string;
  }>;
};

export type OnboardingStatus = {
  tenantId: string;
  tenantName: string;
  hasSubscription: boolean;
  hasBusinesses: boolean;
  hasPhoneNumbers: boolean;
  isOnboardingComplete: boolean;
};

type BootstrapResponse = {
  ok: true;
  tenant: TenantContext | null;
};

const fetchCurrentTenant = cache(async (): Promise<TenantContext | null> => {
  const response = await fetch(`${getApiBaseUrl()}/v1/bootstrap`, {
    cache: 'no-store',
    headers: await getInternalApiHeaders()
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as BootstrapResponse;
  return data.tenant;
});

const fetchOnboardingStatus = cache(async (): Promise<OnboardingStatus | null> => {
  const response = await fetch(`${getApiBaseUrl()}/v1/onboarding/status`, {
    cache: 'no-store',
    headers: await getInternalApiHeaders()
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as OnboardingStatus;
});

export async function getCurrentTenant() {
  return fetchCurrentTenant();
}

export async function getCurrentTenantId() {
  const tenant = await fetchCurrentTenant();
  return tenant?.id ?? null;
}

export async function getOnboardingStatus() {
  return fetchOnboardingStatus();
}
