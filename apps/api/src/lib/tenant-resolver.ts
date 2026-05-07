import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@frontdesk/db';

type TenantUserRow = {
  tenantId: string;
  role: string;
  tenantSlug: string;
  tenantName: string;
};

export const TENANT_SELECTION_HEADER = 'x-frontdesk-tenant-id';

export type TenantWorkspace = {
  tenantId: string;
  role: string;
  tenantSlug: string;
  tenantName: string;
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

function forbiddenRequestedTenant(reply: FastifyReply) {
  reply.code(403).send({
    error: 'Requested workspace is not associated with this account.'
  });
}

function normalizeRequestedTenantId(rawValue: unknown) {
  if (typeof rawValue !== 'string') {
    return null;
  }
  const trimmed = rawValue.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function matchesRequestedWorkspace(workspace: TenantWorkspace, requestedTenant: string) {
  if (workspace.tenantId === requestedTenant) {
    return true;
  }

  return workspace.tenantSlug.toLowerCase() === requestedTenant.toLowerCase();
}

function getRequestedTenantIdFromHeaders(request: FastifyRequest) {
  const raw = request.headers[TENANT_SELECTION_HEADER];
  if (Array.isArray(raw)) {
    return normalizeRequestedTenantId(raw[0]);
  }
  return normalizeRequestedTenantId(raw);
}

export async function listTenantWorkspacesForClerkUser(
  clerkUserId: string
): Promise<TenantWorkspace[]> {
  const rows = await prisma.$queryRaw<TenantUserRow[]>`
    SELECT
      tu."tenantId" AS "tenantId",
      tu."role" AS "role",
      t."slug" AS "tenantSlug",
      t."name" AS "tenantName"
    FROM "TenantUser" tu
    INNER JOIN "Tenant" t
      ON t."id" = tu."tenantId"
    WHERE tu."clerkUserId" = ${clerkUserId}
    ORDER BY tu."createdAt" ASC
  `;

  return rows.map((row) => ({
    tenantId: row.tenantId,
    role: row.role,
    tenantSlug: row.tenantSlug,
    tenantName: row.tenantName
  }));
}

export async function resolveTenantSelectionForClerkUser(input: {
  clerkUserId: string;
  requestedTenantId?: string | null;
}) {
  const workspaces = await listTenantWorkspacesForClerkUser(input.clerkUserId);

  if (workspaces.length === 0) {
    return {
      ok: false as const,
      reason: 'no_membership' as const,
      workspaces
    };
  }

  const requestedTenantId = normalizeRequestedTenantId(input.requestedTenantId);
  if (requestedTenantId) {
    const requestedWorkspace = workspaces.find((workspace) =>
      matchesRequestedWorkspace(workspace, requestedTenantId)
    );
    if (!requestedWorkspace) {
      return {
        ok: false as const,
        reason: 'forbidden_requested_tenant' as const,
        workspaces
      };
    }

    return {
      ok: true as const,
      workspace: requestedWorkspace,
      workspaces
    };
  }

  return {
    ok: true as const,
    workspace: workspaces[0],
    workspaces
  };
}

export async function resolveTenant(request: FastifyRequest, reply: FastifyReply) {
  const clerkUserId = request.clerkUserId;

  if (!clerkUserId) {
    unauthorized(reply);
    return false;
  }

  const selection = await resolveTenantSelectionForClerkUser({
    clerkUserId,
    requestedTenantId: getRequestedTenantIdFromHeaders(request)
  });

  if (!selection.ok && selection.reason === 'forbidden_requested_tenant') {
    forbiddenRequestedTenant(reply);
    return false;
  }

  if (!selection.ok) {
    forbiddenNoTenant(reply);
    return false;
  }

  request.tenantId = selection.workspace.tenantId;
  request.tenantRole = selection.workspace.role;
  return true;
}
