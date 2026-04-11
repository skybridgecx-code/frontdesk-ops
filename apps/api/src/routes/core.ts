import type { FastifyInstance } from 'fastify';
import { prisma } from '@frontdesk/db';
import { randomUUID } from 'node:crypto';

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

async function ensureBootstrapTenantForUser(clerkUserId: string) {
  const existingTenantUser = await prisma.tenantUser.findUnique({
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
      clerkUserId
    },
    select: {
      id: true
    }
  });

  await prisma.tenantUser.upsert({
    where: {
      clerkUserId
    },
    update: {
      tenantId: tenant.id,
      role: 'owner'
    },
    create: {
      clerkUserId,
      tenantId: tenant.id,
      role: 'owner'
    }
  });

  return tenant.id;
}

export async function registerCoreRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
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

    if (!tenantId && request.clerkUserId) {
      tenantId = await ensureBootstrapTenantForUser(request.clerkUserId);
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
      tenant
    };
  });
}
