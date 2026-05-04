import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    const padded = a.padEnd(Math.max(a.length, b.length));
    const target = b.padEnd(Math.max(a.length, b.length));
    timingSafeEqual(Buffer.from(padded), Buffer.from(target));
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function unauthorized(reply: FastifyReply) {
  reply
    .code(401)
    .header('WWW-Authenticate', 'Basic realm="Frontdesk Ops"')
    .send({
      ok: false,
      error: 'Authentication required'
    });
}

export function shouldSkipBasicAuth(url: string) {
  return (
    url === '/health' ||
    url === '/v1/ping' ||
    url.startsWith('/v1/twilio/voice/inbound') ||
    url.startsWith('/v1/twilio/voice/status')
  );
}

export function enforceBasicAuth(request: FastifyRequest, reply: FastifyReply) {
  const expectedUser = process.env.BASIC_AUTH_USERNAME;
  const expectedPass = process.env.BASIC_AUTH_PASSWORD;
  const internalSecret = process.env.FRONTDESK_INTERNAL_API_SECRET;

  // SECURITY (C1, 2026-04-27): fail closed when no auth scheme is configured.
  // Previously this returned `true`, which meant a deploy missing both
  // CLERK_SECRET_KEY *and* BASIC_AUTH_* served the entire dashboard API
  // unauthenticated. In development, allow the bypass; everywhere else,
  // refuse the request with 503 so the misconfiguration is loud.
  if (!expectedUser || !expectedPass) {
    if (process.env.NODE_ENV === 'development') return true;
    reply.code(503).send({
      ok: false,
      error: 'Auth not configured. Set CLERK_SECRET_KEY or BASIC_AUTH_USERNAME/BASIC_AUTH_PASSWORD.'
    });
    return false;
  }

  const internalHeader = request.headers['x-frontdesk-internal-secret'];
  if (
    internalSecret &&
    typeof internalHeader === 'string' &&
    safeEqual(internalHeader, internalSecret)
  ) {
    return true;
  }

  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    unauthorized(reply);
    return false;
  }

  try {
    const decoded = Buffer.from(auth.slice('Basic '.length), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    const user = separator >= 0 ? decoded.slice(0, separator) : '';
    const pass = separator >= 0 ? decoded.slice(separator + 1) : '';

    if (!safeEqual(user, expectedUser) || !safeEqual(pass, expectedPass)) {
      unauthorized(reply);
      return false;
    }

    return true;
  } catch {
    unauthorized(reply);
    return false;
  }
}
