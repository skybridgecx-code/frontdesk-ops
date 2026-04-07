import type { FastifyInstance } from 'fastify';
import { prisma } from '@frontdesk/db';
import { slugParams } from '../lib/params.js';

export async function registerTenantRoutes(app: FastifyInstance) {
  app.get('/v1/tenants/:slug', async (request, reply) => {
        const { slug } = slugParams.parse(request.params);

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
