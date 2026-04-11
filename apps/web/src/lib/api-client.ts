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

export async function getClientInternalApiHeaders(getToken: ClerkTokenGetter): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  const clerkToken = await getToken();
  if (clerkToken) {
    headers.Authorization = `Bearer ${clerkToken}`;
  }

  return headers;
}
