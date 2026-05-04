import { timingSafeEqual } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import type WebSocket from 'ws';

/**
 * Validates the `token` query param on the WebSocket upgrade request.
 * Returns `true` if the connection is authorized, `false` if it was rejected and closed.
 */
export function authorizeWebSocket(
  socket: WebSocket,
  token: string | null,
  callSid: string | null,
  log: FastifyBaseLogger
): boolean {
  const expectedSecret = process.env.FRONTDESK_INTERNAL_API_SECRET;

  // SECURITY (C2, 2026-04-27): fail closed in production.
  // Previously this returned `true` whenever the secret was unset, so a
  // misconfigured prod deploy accepted any WebSocket and would happily burn
  // OpenAI Realtime tokens. Allow the bypass only when explicitly running in
  // development.
  if (!expectedSecret) {
    if (process.env.NODE_ENV === 'development') return true;
    log.error({ msg: 'WebSocket rejected: FRONTDESK_INTERNAL_API_SECRET not configured', callSid });
    socket.close(4500, 'Server misconfigured');
    return false;
  }

  if (
    !token ||
    token.length !== expectedSecret.length ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(expectedSecret))
  ) {
    log.warn({ msg: 'Unauthorized WebSocket connection attempt', callSid });
    socket.close(4401, 'Unauthorized');
    return false;
  }

  return true;
}
