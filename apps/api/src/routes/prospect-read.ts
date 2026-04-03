import type { FastifyInstance } from 'fastify';
import { ProspectStatus, prisma } from '@frontdesk/db';
import { z } from 'zod';

const prospectReadQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(200).optional(),
    status: z.nativeEnum(ProspectStatus).optional()
  })
  .strict();

export async function registerProspectReadRoutes(app: FastifyInstance) {
  app.get('/v1/businesses/:businessId/prospects', async (request, reply) => {
    const { businessId } = request.params as { businessId: string };

    const parsed = prospectReadQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: parsed.error.flatten()
      });
    }

    const prospects = await prisma.prospect.findMany({
      where: {
        businessId,
        ...(parsed.data.status ? { status: parsed.data.status } : {})
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: parsed.data.limit ?? 50,
      select: {
        prospectSid: true,
        companyName: true,
        contactName: true,
        contactPhone: true,
        contactEmail: true,
        city: true,
        state: true,
        sourceLabel: true,
        status: true,
        priority: true,
        lastAttemptAt: true,
        nextActionAt: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return {
      ok: true,
      prospects
    };
  });

  app.get('/v1/businesses/:businessId/prospects/:prospectSid', async (request, reply) => {
    const { businessId, prospectSid } = request.params as {
      businessId: string;
      prospectSid: string;
    };

    const prospect = await prisma.prospect.findFirst({
      where: {
        businessId,
        prospectSid
      },
      select: {
        prospectSid: true,
        companyName: true,
        contactName: true,
        contactPhone: true,
        contactEmail: true,
        city: true,
        state: true,
        sourceLabel: true,
        status: true,
        priority: true,
        notes: true,
        nextActionAt: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!prospect) {
      return reply.notFound(`Prospect not found for businessId=${businessId} prospectSid=${prospectSid}`);
    }

    return {
      ok: true,
      prospect
    };
  });
}
