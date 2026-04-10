import type { FastifyReply, FastifyRequest } from 'fastify';
import { validateRequest } from 'twilio';

function getHeaderValue(value: string | string[] | undefined) {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return '';
}

function normalizeParams(body: unknown): Record<string, string> {
  if (!body || typeof body !== 'object') {
    return {};
  }

  return Object.entries(body).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === 'string') {
      acc[key] = value;
      return acc;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      acc[key] = String(value);
    }

    return acc;
  }, {});
}

export async function validateTwilioRequest(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.warn('[twilio-auth] TWILIO_AUTH_TOKEN not set — skipping request validation');
    return;
  }

  const signature = getHeaderValue(request.headers['x-twilio-signature']);
  const url = `https://frontdesk-ops.onrender.com${request.url}`;
  const params = normalizeParams(request.body);

  const isValid = validateRequest(authToken, signature, url, params);
  if (!isValid) {
    reply.code(403).send({ error: 'Invalid Twilio signature' });
  }
}
