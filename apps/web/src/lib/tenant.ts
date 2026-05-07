import 'server-only';
import { cache } from 'react';
import { getApiBaseUrl, getInternalApiHeaders } from './api';
import { workspaceLabelFromSlug } from './workspace';

export type TenantContext = {
  id: string;
  slug: string;
  name: string;
  businesses: Array<{
    id: string;
    name: string;
  }>;
};

export type WorkspaceContext = {
  id: string;
  slug: string;
  name: string;
  role: string;
  label: string;
};

type WorkspaceBootstrapRow = {
  id: string;
  slug: string;
  name: string;
  role: string;
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
  workspaces?: WorkspaceBootstrapRow[];
  activeWorkspaceId?: string | null;
};

type BootstrapContext = {
  tenant: TenantContext | null;
  workspaces: WorkspaceContext[];
  activeWorkspaceId: string | null;
};

const fetchBootstrapContext = cache(async (): Promise<BootstrapContext> => {
  const response = await fetch(`${getApiBaseUrl()}/v1/bootstrap`, {
    cache: 'no-store',
    headers: await getInternalApiHeaders()
  });

  if (!response.ok) {
    return {
      tenant: null,
      workspaces: [],
      activeWorkspaceId: null
    };
  }

  const data = (await response.json()) as BootstrapResponse;
  const workspaces = Array.isArray(data.workspaces)
    ? data.workspaces
        .filter(
          (workspace): workspace is WorkspaceBootstrapRow =>
            Boolean(
              workspace &&
                typeof workspace.id === 'string' &&
                typeof workspace.slug === 'string' &&
                typeof workspace.name === 'string' &&
                typeof workspace.role === 'string'
            )
        )
        .map((workspace) => ({
          ...workspace,
          label:
            workspaceLabelFromSlug(workspace.slug) === 'Workspace'
              ? workspace.name
              : workspaceLabelFromSlug(workspace.slug)
        }))
    : [];

  return {
    tenant: data.tenant,
    workspaces,
    activeWorkspaceId: typeof data.activeWorkspaceId === 'string' ? data.activeWorkspaceId : null
  };
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
  const bootstrap = await fetchBootstrapContext();
  return bootstrap.tenant;
}

export async function getCurrentTenantId() {
  const tenant = await getCurrentTenant();
  return tenant?.id ?? null;
}

export async function getWorkspaceOptions() {
  const bootstrap = await fetchBootstrapContext();
  return bootstrap.workspaces;
}

export async function getActiveWorkspaceId() {
  const bootstrap = await fetchBootstrapContext();
  return bootstrap.activeWorkspaceId ?? bootstrap.tenant?.id ?? null;
}

export async function getOnboardingStatus() {
  return fetchOnboardingStatus();
}
