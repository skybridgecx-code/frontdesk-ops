import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

// SECURITY (M1, 2026-04-27): constant-time string comparison so a network-side
// attacker cannot infer the admin secret one byte at a time from response
// timing differences.
function safeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function requireAdminAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const secret = process.env.FRONTDESK_INTERNAL_API_SECRET;

  if (!secret) {
    console.error('[admin-auth] FRONTDESK_INTERNAL_API_SECRET not set');
    reply.code(503).send({ error: 'Admin API not configured' });
    return;
  }

  const authHeader = request.headers.authorization;
  if (!authHeader) {
    reply.code(401).send({ error: 'Authorization header required' });
    return;
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (!safeEqualString(token, secret)) {
    reply.code(403).send({ error: 'Invalid admin credentials' });
    return;
  }
}
