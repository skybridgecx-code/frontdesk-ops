export function getApiBaseUrl() {
  return process.env.FRONTDESK_API_BASE_URL ?? 'http://127.0.0.1:4000';
}

export function getInternalApiHeaders(): HeadersInit {
  const headers: Record<string, string> = {};
  const secret = process.env.FRONTDESK_INTERNAL_API_SECRET;

  if (secret) {
    headers['x-frontdesk-internal-secret'] = secret;
  }

  return headers;
}
