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

  if (!expectedSecret) {
    // No secret configured — allow (dev mode)
    return true;
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
