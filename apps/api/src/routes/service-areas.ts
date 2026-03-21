import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@frontdesk/db';

const createServiceAreaBodySchema = z.object({
  label: z.string().min(1).max(120),
  city: z.string().max(120).nullable().optional(),
  state: z.string().max(80).nullable().optional(),
  postalCode: z.string().max(20).nullable().optional()
});

const updateServiceAreaBodySchema = z.object({
  label: z.string().min(1).max(120).optional(),
  city: z.string().max(120).nullable().optional(),
  state: z.string().max(80).nullable().optional(),
  postalCode: z.string().max(20).nullable().optional()
});

export async function registerServiceAreaRoutes(app: FastifyInstance) {
  app.get('/v1/businesses/:businessId/service-areas', async (request, reply) => {
    const { businessId } = request.params as { businessId: string };

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true }
    });

    if (!business) {
      return reply.notFound(`Business not found for id=${businessId}`);
    }

    const serviceAreas = await prisma.serviceArea.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        label: true,
        city: true,
        state: true,
        postalCode: true,
        updatedAt: true
      }
    });

    return {
      ok: true,
      serviceAreas
    };
  });

  app.post('/v1/businesses/:businessId/service-areas', async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    const parsed = createServiceAreaBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: parsed.error.flatten() });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true }
    });

    if (!business) {
      return reply.notFound(`Business not found for id=${businessId}`);
    }

    const serviceArea = await prisma.serviceArea.create({
      data: {
        businessId,
        label: parsed.data.label,
        city: parsed.data.city ?? null,
        state: parsed.data.state ?? null,
        postalCode: parsed.data.postalCode ?? null
      },
      select: {
        id: true,
        businessId: true,
        label: true,
        city: true,
        state: true,
        postalCode: true,
        createdAt: true
      }
    });

    return {
      ok: true,
      serviceArea
    };
  });

  app.patch('/v1/service-areas/:serviceAreaId', async (request, reply) => {
    const { serviceAreaId } = request.params as { serviceAreaId: string };
    const parsed = updateServiceAreaBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: parsed.error.flatten() });
    }

    const existing = await prisma.serviceArea.findUnique({
      where: { id: serviceAreaId },
      select: { id: true }
    });

    if (!existing) {
      return reply.notFound(`ServiceArea not found for id=${serviceAreaId}`);
    }

    const serviceArea = await prisma.serviceArea.update({
      where: { id: serviceAreaId },
      data: parsed.data,
      select: {
        id: true,
        businessId: true,
        label: true,
        city: true,
        state: true,
        postalCode: true,
        updatedAt: true
      }
    });

    return {
      ok: true,
      serviceArea
    };
  });
}
