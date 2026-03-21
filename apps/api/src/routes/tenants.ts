import type { FastifyInstance } from 'fastify';
import { prisma } from '@frontdesk/db';

export async function registerTenantRoutes(app: FastifyInstance) {
  app.get('/v1/tenants/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };

    const tenant = await prisma.tenant.findUnique({
      where: {
        slug
      },
      select: {
        id: true,
        slug: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        businesses: {
          orderBy: {
            createdAt: 'asc'
          },
          select: {
            id: true,
            slug: true,
            name: true,
            vertical: true,
            timezone: true
          }
        }
      }
    });

    if (!tenant) {
      return reply.notFound(`Tenant not found for slug=${slug}`);
    }

    return {
      ok: true,
      tenant
    };
  });
}
