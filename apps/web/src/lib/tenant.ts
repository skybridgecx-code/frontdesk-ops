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

export async function getCurrentTenant() {
  return fetchCurrentTenant();
}

export async function getCurrentTenantId() {
  const tenant = await fetchCurrentTenant();
  return tenant?.id ?? null;
}
