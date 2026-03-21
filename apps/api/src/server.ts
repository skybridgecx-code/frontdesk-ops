import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { prisma } from '@frontdesk/db';

export async function buildServer() {
  const app = Fastify({
    logger: true
  });

  await app.register(cors, {
    origin: true
  });

  await app.register(sensible);

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

  app.get('/v1/bootstrap', async () => {
    const tenant = await prisma.tenant.findFirst({
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

  return app;
}
