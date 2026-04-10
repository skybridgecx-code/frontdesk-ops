import type { FastifyReply, FastifyRequest } from 'fastify';

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

  if (token !== secret) {
    reply.code(403).send({ error: 'Invalid admin credentials' });
    return;
  }
}
