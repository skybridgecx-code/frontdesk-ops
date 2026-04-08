import { auth } from '@clerk/nextjs/server';

export function getApiBaseUrl() {
  return process.env.FRONTDESK_API_BASE_URL ?? 'http://127.0.0.1:4000';
}

type ClerkTokenGetter = () => Promise<string | null>;

async function getServerClerkToken() {
  if (!process.env.CLERK_SECRET_KEY) {
    return null;
  }

  const authState = await auth();
  return authState.getToken();
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

  return headers;
}

export async function getClientInternalApiHeaders(getToken: ClerkTokenGetter) {
  return getInternalApiHeaders({ getToken });
}
