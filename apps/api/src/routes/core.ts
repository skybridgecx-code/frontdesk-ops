import type { FastifyInstance } from 'fastify';
import { prisma } from '@frontdesk/db';

export async function registerCoreRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    return {
      ok: true,
      service: 'api'
    };
  });

  app.get('/v1/ping', async () => {
    return {
      pong: true
    };
  });

  app.get('/v1/bootstrap', async (request) => {
    const tenant = request.tenantId
      ? await prisma.tenant.findUnique({
          where: {
            id: request.tenantId
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
