import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@frontdesk/db';

type TenantUserRow = {
  tenantId: string;
  role: string;
};

declare module 'fastify' {
  interface FastifyRequest {
    tenantId?: string;
    tenantRole?: string;
  }
}

function forbiddenNoTenant(reply: FastifyReply) {
  reply.code(403).send({
    error: 'No tenant associated with this account. Contact support.'
  });
}

function unauthorized(reply: FastifyReply) {
  reply.code(401).send({
    error: 'Unauthorized'
  });
}

export async function resolveTenant(request: FastifyRequest, reply: FastifyReply) {
  const clerkUserId = request.clerkUserId;

  if (!clerkUserId) {
    unauthorized(reply);
    return false;
  }

  const rows = await prisma.$queryRaw<TenantUserRow[]>`
    SELECT
      "tenantId",
      "role"
    FROM "TenantUser"
    WHERE "clerkUserId" = ${clerkUserId}
    LIMIT 1
  `;

  const tenantUser = rows[0];

  if (!tenantUser) {
    forbiddenNoTenant(reply);
    return false;
  }

  request.tenantId = tenantUser.tenantId;
  request.tenantRole = tenantUser.role;
  return true;
}
