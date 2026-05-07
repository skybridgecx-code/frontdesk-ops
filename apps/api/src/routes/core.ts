import type { FastifyInstance } from 'fastify';
import { prisma } from '@frontdesk/db';
import { randomUUID } from 'node:crypto';
import {
  TENANT_SELECTION_HEADER,
  listTenantWorkspacesForClerkUser,
  resolveTenantSelectionForClerkUser
} from '../lib/tenant-resolver.js';

function toSlugBase(value: string) {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  return base.length > 0 ? base : 'tenant';
}

function createTenantSlug(clerkUserId: string) {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 8);
  return `${toSlugBase(clerkUserId)}-${suffix}`;
}

const TRIAL_LENGTH_DAYS = 14;

function getTrialEndsAt() {
  return new Date(Date.now() + TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000);
}

async function ensureBootstrapTenantForUser(clerkUserId: string) {
  const existingTenantUser = await prisma.tenantUser.findFirst({
    where: {
      clerkUserId
    },
    select: {
      tenantId: true
    }
  });

  if (existingTenantUser?.tenantId) {
    return existingTenantUser.tenantId;
  }

  const tenant = await prisma.tenant.upsert({
    where: {
      clerkUserId
    },
    update: {},
    create: {
      name: 'New User',
      slug: createTenantSlug(clerkUserId),
      clerkUserId,
      subscriptionStatus: 'trialing'
    },
    select: {
      id: true
    }
  });

  await prisma.$executeRaw`
    UPDATE "Tenant"
    SET "trialEndsAt" = COALESCE("trialEndsAt", ${getTrialEndsAt()})
    WHERE "id" = ${tenant.id}
      AND "subscriptionStatus" = 'trialing'
  `;

  const existingOwnerLink = await prisma.tenantUser.findFirst({
    where: {
      clerkUserId,
      tenantId: tenant.id
    },
    select: {
      id: true
    }
  });

  if (!existingOwnerLink) {
    await prisma.tenantUser.create({
      data: {
        clerkUserId,
        tenantId: tenant.id,
        role: 'owner'
      }
    });
  } else {
    await prisma.tenantUser.update({
      where: {
        id: existingOwnerLink.id
      },
      data: {
        role: 'owner'
      }
    });
  }

  return tenant.id;
}

export async function registerCoreRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    return {
      ok: true,
      timestamp: new Date().toISOString()
    };
  });

  app.get('/healthz', async () => {
    return {
      ok: true,
      timestamp: new Date().toISOString()
    };
  });

  app.get('/v1/ping', async () => {
    return {
      pong: true
    };
  });

  app.get('/v1/bootstrap', async (request) => {
    let tenantId = request.tenantId;
    let workspaces: Array<{ id: string; slug: string; name: string; role: string }> = [];
    let activeWorkspaceId: string | null = null;

    if (request.clerkUserId) {
      const requestedTenantHeader = request.headers[TENANT_SELECTION_HEADER];
      const requestedTenantId = Array.isArray(requestedTenantHeader)
        ? requestedTenantHeader[0]
        : requestedTenantHeader;

      let selection = await resolveTenantSelectionForClerkUser({
        clerkUserId: request.clerkUserId,
        requestedTenantId
      });

      if (!selection.ok && selection.reason === 'no_membership') {
        await ensureBootstrapTenantForUser(request.clerkUserId);
        selection = await resolveTenantSelectionForClerkUser({
          clerkUserId: request.clerkUserId,
          requestedTenantId
        });
      }

      if (selection.ok) {
        tenantId = selection.workspace.tenantId;
        activeWorkspaceId = selection.workspace.tenantId;
        workspaces = selection.workspaces.map((workspace) => ({
          id: workspace.tenantId,
          slug: workspace.tenantSlug,
          name: workspace.tenantName,
          role: workspace.role
        }));
      } else if (selection.reason === 'forbidden_requested_tenant' && selection.workspaces.length > 0) {
        tenantId = selection.workspaces[0].tenantId;
        activeWorkspaceId = selection.workspaces[0].tenantId;
        workspaces = selection.workspaces.map((workspace) => ({
          id: workspace.tenantId,
          slug: workspace.tenantSlug,
          name: workspace.tenantName,
          role: workspace.role
        }));
      } else {
        workspaces = (await listTenantWorkspacesForClerkUser(request.clerkUserId)).map((workspace) => ({
          id: workspace.tenantId,
          slug: workspace.tenantSlug,
          name: workspace.tenantName,
          role: workspace.role
        }));
      }
    }

    const tenant = tenantId
      ? await prisma.tenant.findUnique({
          where: {
            id: tenantId
          },
          select: {
            id: true,
            slug: true,
            name: true,
            businesses: {
              orderBy: {
                createdAt: 'asc'
              },
              select: {
                id: true,
                slug: true,
                name: true,
                vertical: true,
                timezone: true,
                locations: {
                  orderBy: {
                    createdAt: 'asc'
                  },
                  select: {
                    id: true,
                    name: true,
                    city: true,
                    state: true,
                    isPrimary: true
                  }
                },
                phoneNumbers: {
                  orderBy: {
                    createdAt: 'asc'
                  },
                  select: {
                    id: true,
                    e164: true,
                    label: true,
                    externalSid: true,
                    isActive: true
                  }
                },
                agentProfiles: {
                  orderBy: {
                    createdAt: 'asc'
                  },
                  select: {
                    id: true,
                    name: true,
                    channel: true,
                    language: true,
                    voiceName: true,
                    isActive: true
                  }
                }
              }
            }
          }
        })
      : await prisma.tenant.findFirst({
          where: {
            slug: 'demo-hvac'
          },
          select: {
            id: true,
            slug: true,
            name: true,
            businesses: {
              orderBy: {
                createdAt: 'asc'
              },
              select: {
                id: true,
                slug: true,
                name: true,
                vertical: true,
                timezone: true,
                locations: {
                  orderBy: {
                    createdAt: 'asc'
                  },
                  select: {
                    id: true,
                    name: true,
                    city: true,
                    state: true,
                    isPrimary: true
                  }
                },
                phoneNumbers: {
                  orderBy: {
                    createdAt: 'asc'
                  },
                  select: {
                    id: true,
                    e164: true,
                    label: true,
                    externalSid: true,
                    isActive: true
                  }
                },
                agentProfiles: {
                  orderBy: {
                    createdAt: 'asc'
                  },
                  select: {
                    id: true,
                    name: true,
                    channel: true,
                    language: true,
                    voiceName: true,
                    isActive: true
                  }
                }
              }
            }
          }
        });

    return {
      ok: true,
      tenant,
      workspaces,
      activeWorkspaceId
    };
  });
}
