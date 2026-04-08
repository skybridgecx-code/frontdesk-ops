import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma, Weekday } from '@frontdesk/db';
import { businessIdParams } from '../lib/params.js';

const businessHoursItemSchema = z.object({
  weekday: z.nativeEnum(Weekday),
  openTime: z.string().nullable().optional(),
  closeTime: z.string().nullable().optional(),
  isClosed: z.boolean()
});

const putBusinessHoursBodySchema = z.object({
  items: z.array(businessHoursItemSchema).min(1).max(7)
});

export async function registerBusinessHoursRoutes(app: FastifyInstance) {
  app.get('/v1/businesses/:businessId/hours', async (request, reply) => {
    const { businessId } = businessIdParams.parse(request.params);

    const business = await prisma.business.findFirst({
      where: {
        id: businessId,
        ...(request.tenantId ? { tenantId: request.tenantId } : {})
      },
      select: { id: true }
    });

    if (!business) {
      return reply.notFound(`Business not found for id=${businessId}`);
    }

    const businessHours = await prisma.businessHours.findMany({
      where: { businessId },
      orderBy: { weekday: 'asc' },
      select: {
        id: true,
        weekday: true,
        openTime: true,
        closeTime: true,
        isClosed: true,
        updatedAt: true
      }
    });

    return {
      ok: true,
      businessHours
    };
  });

  app.put('/v1/businesses/:businessId/hours', async (request, reply) => {
    const { businessId } = businessIdParams.parse(request.params);
    const parsed = putBusinessHoursBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: parsed.error.flatten() });
    }

    const business = await prisma.business.findFirst({
      where: {
        id: businessId,
        ...(request.tenantId ? { tenantId: request.tenantId } : {})
      },
      select: { id: true }
    });

    if (!business) {
      return reply.notFound(`Business not found for id=${businessId}`);
    }

    for (const item of parsed.data.items) {
      await prisma.businessHours.upsert({
        where: {
          businessId_weekday: {
            businessId,
            weekday: item.weekday
          }
        },
        update: {
          openTime: item.isClosed ? null : (item.openTime ?? null),
          closeTime: item.isClosed ? null : (item.closeTime ?? null),
          isClosed: item.isClosed
        },
        create: {
          businessId,
          weekday: item.weekday,
          openTime: item.isClosed ? null : (item.openTime ?? null),
          closeTime: item.isClosed ? null : (item.closeTime ?? null),
          isClosed: item.isClosed
        }
      });
    }

    const businessHours = await prisma.businessHours.findMany({
      where: { businessId },
      orderBy: { weekday: 'asc' },
      select: {
        id: true,
        weekday: true,
        openTime: true,
        closeTime: true,
        isClosed: true,
        updatedAt: true
      }
    });

    return {
      ok: true,
      businessHours
    };
  });
}
