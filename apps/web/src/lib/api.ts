import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { FRONTDESK_TENANT_HEADER, FRONTDESK_WORKSPACE_COOKIE } from './workspace';

const DEFAULT_API_BASE_URL =
  process.env.NODE_ENV === 'production' ? 'https://frontdesk-ops.onrender.com' : 'http://127.0.0.1:4000';

function normalizeBaseUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/+$/, '');
}

export function getApiBaseUrl() {
  return (
    normalizeBaseUrl(process.env.FRONTDESK_API_BASE_URL) ??
    normalizeBaseUrl(process.env.NEXT_PUBLIC_FRONTDESK_API_BASE_URL) ??
    normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL) ??
    DEFAULT_API_BASE_URL
  );
}

type ClerkTokenGetter = () => Promise<string | null>;

async function getServerClerkToken() {
  if (!process.env.CLERK_SECRET_KEY) {
    return null;
  }

  const authState = await auth();
  return authState.getToken();
}

async function getServerSelectedWorkspaceTenantId() {
  try {
    const cookieStore = await cookies();
    const selected = cookieStore.get(FRONTDESK_WORKSPACE_COOKIE)?.value?.trim();
    return selected && selected.length > 0 ? selected : null;
  } catch {
    return null;
  }
}

export async function getInternalApiHeaders(input?: {
  getToken?: ClerkTokenGetter;
}): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  const secret = process.env.FRONTDESK_INTERNAL_API_SECRET;

  if (secret) {
    headers['x-frontdesk-internal-secret'] = secret;
  }

  const clerkToken = input?.getToken ? await input.getToken() : await getServerClerkToken();

  if (clerkToken) {
    headers.Authorization = `Bearer ${clerkToken}`;
  }

  const selectedWorkspaceTenantId = await getServerSelectedWorkspaceTenantId();
  if (selectedWorkspaceTenantId) {
    headers[FRONTDESK_TENANT_HEADER] = selectedWorkspaceTenantId;
  }

  return headers;
}

export async function getClientInternalApiHeaders(getToken: ClerkTokenGetter) {
  return getInternalApiHeaders({ getToken });
}
