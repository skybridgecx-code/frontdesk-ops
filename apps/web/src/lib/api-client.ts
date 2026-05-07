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
    normalizeBaseUrl(process.env.NEXT_PUBLIC_FRONTDESK_API_BASE_URL) ??
    normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL) ??
    DEFAULT_API_BASE_URL
  );
}

type ClerkTokenGetter = () => Promise<string | null>;

function getCookieValue(name: string) {
  if (typeof document === 'undefined') {
    return null;
  }

  const allCookies = document.cookie ? document.cookie.split('; ') : [];
  for (const row of allCookies) {
    if (!row.startsWith(`${name}=`)) {
      continue;
    }
    const rawValue = row.slice(name.length + 1);
    const decoded = decodeURIComponent(rawValue);
    return decoded.trim().length > 0 ? decoded.trim() : null;
  }

  return null;
}

export async function getClientInternalApiHeaders(getToken: ClerkTokenGetter): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  const clerkToken = await getToken();
  if (clerkToken) {
    headers.Authorization = `Bearer ${clerkToken}`;
  }

  const selectedWorkspaceTenantId = getCookieValue(FRONTDESK_WORKSPACE_COOKIE);
  if (selectedWorkspaceTenantId) {
    headers[FRONTDESK_TENANT_HEADER] = selectedWorkspaceTenantId;
  }

  return headers;
}
