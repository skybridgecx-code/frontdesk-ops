export function getApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_FRONTDESK_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.FRONTDESK_API_BASE_URL ??
    'http://127.0.0.1:4000'
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
