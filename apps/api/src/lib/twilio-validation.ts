import { createHmac, timingSafeEqual } from 'node:crypto';

export function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string | undefined>
): boolean {
  if (!signature || !authToken) return false;

  const sortedKeys = Object.keys(params).sort();
  const data =
    url +
    sortedKeys.reduce((acc, key) => {
      const value = params[key];
      return acc + key + (value ?? '');
    }, '');

  const expected = createHmac('sha1', authToken).update(data).digest('base64');

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function requireTwilioSignature(
  request: { headers: Record<string, string | string[] | undefined>; url: string },
  body: Record<string, string | undefined>
): { valid: boolean; error?: string } {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    if (process.env.NODE_ENV === 'development') return { valid: true };
    return { valid: false, error: 'TWILIO_AUTH_TOKEN is not configured' };
  }

  const signature =
    typeof request.headers['x-twilio-signature'] === 'string'
      ? request.headers['x-twilio-signature']
      : '';

  const publicBaseUrl =
    process.env.FRONTDESK_API_PUBLIC_URL ?? 'http://localhost:4000';
  const fullUrl = `${publicBaseUrl.replace(/\/$/, '')}${request.url.split('?')[0]}`;

  const valid = validateTwilioSignature(authToken, signature, fullUrl, body);
  return valid ? { valid: true } : { valid: false, error: 'Invalid Twilio signature' };
}
