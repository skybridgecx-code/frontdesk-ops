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
  tenantId?: string;
  tenantName?: string;
  hasSubscription: boolean;
  hasBusinesses: boolean;
  hasPhoneNumbers: boolean;
  onboardingComplete: boolean;
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

  const payload = (await response.json()) as {
    tenantId?: unknown;
    tenantName?: unknown;
    hasSubscription?: unknown;
    hasBusinesses?: unknown;
    hasPhoneNumbers?: unknown;
    onboardingComplete?: unknown;
    isOnboardingComplete?: unknown;
    steps?: {
      businessInfo?: { complete?: unknown };
      phoneNumber?: { complete?: unknown };
      billing?: { complete?: unknown };
    };
  };

  const hasSubscription = payload.hasSubscription === true || payload.steps?.billing?.complete === true;
  const hasBusinesses = payload.hasBusinesses === true || payload.steps?.businessInfo?.complete === true;
  const hasPhoneNumbers = payload.hasPhoneNumbers === true || payload.steps?.phoneNumber?.complete === true;
  const onboardingComplete = payload.onboardingComplete === true || payload.isOnboardingComplete === true;

  return {
    tenantId: typeof payload.tenantId === 'string' ? payload.tenantId : undefined,
    tenantName: typeof payload.tenantName === 'string' ? payload.tenantName : undefined,
    hasSubscription,
    hasBusinesses,
    hasPhoneNumbers,
    onboardingComplete,
    isOnboardingComplete: onboardingComplete
  };
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
