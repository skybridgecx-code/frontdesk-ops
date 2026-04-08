import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyToken } from '@clerk/backend';

declare module 'fastify' {
  interface FastifyRequest {
    clerkUserId?: string;
    clerkOrgId?: string | null;
  }
}

/**
 * Required Clerk environment variables:
 * NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
 * CLERK_SECRET_KEY=sk_...
 * NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
 * NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
 */

type ClerkTokenClaims = {
  sub?: unknown;
  org_id?: unknown;
  orgId?: unknown;
};

function unauthorized(reply: FastifyReply) {
  reply.code(401).send({
    error: 'Unauthorized'
  });
}

function getBearerToken(authorization: string | undefined) {
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }

  const token = authorization.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

function getClaimString(claims: ClerkTokenClaims, key: keyof ClerkTokenClaims) {
  const value = claims[key];
  return typeof value === 'string' ? value : null;
}

export function shouldSkipDashboardAuth(url: string) {
  const pathname = url.split('?')[0] ?? url;
  return pathname === '/health' || pathname === '/v1/ping' || pathname.startsWith('/v1/twilio/');
}

export async function enforceClerkAuth(request: FastifyRequest, reply: FastifyReply) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    reply.code(500).send({
      error: 'Clerk auth is not configured'
    });
    return false;
  }

  const token = getBearerToken(request.headers.authorization);
  if (!token) {
    unauthorized(reply);
    return false;
  }

  try {
    const claims = (await verifyToken(token, { secretKey })) as ClerkTokenClaims;
    const userId = getClaimString(claims, 'sub');

    if (!userId) {
      unauthorized(reply);
      return false;
    }

    request.clerkUserId = userId;
    request.clerkOrgId = getClaimString(claims, 'org_id') ?? getClaimString(claims, 'orgId');

    return true;
  } catch {
    unauthorized(reply);
    return false;
  }
}
